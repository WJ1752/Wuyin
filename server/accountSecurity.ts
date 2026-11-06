import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

interface User {
  id: string;
  username: string;
}
export function passwordHash(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}
const passwordValid = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= 12 && value.length <= 128;
const recoveryHash = (value: string) =>
  createHash('sha256').update(value.replaceAll('-', '').trim().toLowerCase()).digest('hex');
export function createRecoveryCode(db: DatabaseSync, userId: string) {
  const code = randomBytes(24).toString('hex').match(/.{8}/g)!.join('-');
  db.prepare(
    'INSERT INTO account_recovery VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET recovery_hash = excluded.recovery_hash',
  ).run(userId, recoveryHash(code));
  return code;
}

export function registerAccountSecurity(
  app: FastifyInstance,
  db: DatabaseSync,
  options: {
    getUser: (request: FastifyRequest) => User | null;
    beginSession: (
      user: User,
      request: FastifyRequest,
      reply: FastifyReply,
    ) => { user: User; csrfToken: string };
    clearSession: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => { user: null; csrfToken: string };
    sessionHash: (request: FastifyRequest) => string;
  },
) {
  const authorized = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = options.getUser(request);
    if (!user) {
      reply.code(401).send({ error: '请先登录账号。', code: 'AUTH_REQUIRED' });
      return null;
    }
    const body = request.body as Record<string, unknown> | null;
    const password = body?.currentPassword ?? body?.password;
    if (!passwordValid(password)) {
      reply.code(400).send({ error: '请输入当前密码。', code: 'INVALID_CREDENTIALS_FORMAT' });
      return null;
    }
    const row = db
      .prepare('SELECT password_salt, password_hash FROM users WHERE id = ?')
      .get(user.id)!;
    const candidate = await passwordHash(password, String(row.password_salt));
    if (!timingSafeEqual(candidate, Buffer.from(String(row.password_hash), 'hex'))) {
      reply.code(401).send({ error: '当前密码错误。', code: 'INVALID_CREDENTIALS' });
      return null;
    }
    // Hashing is asynchronous: another request may have removed the user meanwhile.
    if (!options.getUser(request)) {
      reply.code(401).send({ error: '登录已失效，请重新登录。', code: 'AUTH_REQUIRED' });
      return null;
    }
    return { user, body: body! };
  };
  const protectedRoute = {
    bodyLimit: 4096,
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  };
  app.post('/api/auth/password', protectedRoute, async (request, reply) => {
    const checked = await authorized(request, reply);
    if (!checked) return;
    if (!passwordValid(checked.body.newPassword))
      return reply
        .code(400)
        .send({ error: '新密码需为 12–128 位。', code: 'INVALID_CREDENTIALS_FORMAT' });
    const salt = randomBytes(16).toString('hex');
    const hash = await passwordHash(checked.body.newPassword, salt);
    if (!options.getUser(request))
      return reply.code(401).send({ error: '登录已失效，请重新登录。', code: 'AUTH_REQUIRED' });
    db.exec('BEGIN IMMEDIATE');
    try {
      const updated = db
        .prepare('UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?')
        .run(salt, hash.toString('hex'), checked.user.id);
      if (updated.changes !== 1) throw new Error('账号已不存在。');
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(checked.user.id);
      const result = options.beginSession(checked.user, request, reply);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
  app.post('/api/auth/recovery-code', protectedRoute, async (request, reply) => {
    const checked = await authorized(request, reply);
    if (!checked) return;
    return { recoveryCode: createRecoveryCode(db, checked.user.id) };
  });
  app.post('/api/auth/recover', protectedRoute, async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (
      !body ||
      typeof body.username !== 'string' ||
      !/^[A-Za-z0-9_-]{3,24}$/.test(body.username) ||
      !passwordValid(body.newPassword) ||
      typeof body.recoveryCode !== 'string' ||
      body.recoveryCode.length > 100
    )
      return reply.code(400).send({
        error: '请填写用户名、恢复码和 12–128 位新密码。',
        code: 'INVALID_CREDENTIALS_FORMAT',
      });
    const row = db
      .prepare(
        'SELECT u.id, u.username, r.recovery_hash FROM users u LEFT JOIN account_recovery r ON r.user_id = u.id WHERE u.username = ?',
      )
      .get(body.username);
    const supplied = recoveryHash(body.recoveryCode);
    const expected = String(row?.recovery_hash ?? '0'.repeat(64));
    if (
      !timingSafeEqual(Buffer.from(supplied, 'hex'), Buffer.from(expected, 'hex')) ||
      !row?.recovery_hash
    )
      return reply.code(401).send({ error: '用户名或恢复码无效。', code: 'INVALID_CREDENTIALS' });
    const salt = randomBytes(16).toString('hex');
    const hash = await passwordHash(body.newPassword, salt);
    db.exec('BEGIN IMMEDIATE');
    try {
      // Consume once: concurrent recovery attempts cannot both rotate credentials.
      const consumed = db
        .prepare('DELETE FROM account_recovery WHERE user_id = ? AND recovery_hash = ?')
        .run(String(row.id), expected);
      if (consumed.changes !== 1) {
        db.exec('ROLLBACK');
        return reply.code(401).send({ error: '用户名或恢复码无效。', code: 'INVALID_CREDENTIALS' });
      }
      db.prepare('UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?').run(
        salt,
        hash.toString('hex'),
        String(row.id),
      );
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(String(row.id));
      const recoveryCode = createRecoveryCode(db, String(row.id));
      const result = options.beginSession(
        { id: String(row.id), username: String(row.username) },
        request,
        reply,
      );
      db.exec('COMMIT');
      return { ...result, recoveryCode };
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  });
  app.post('/api/auth/sessions/revoke', protectedRoute, async (request, reply) => {
    const checked = await authorized(request, reply);
    if (!checked) return;
    const changed = db
      .prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?')
      .run(checked.user.id, options.sessionHash(request));
    return { revoked: Number(changed.changes) };
  });
  app.post('/api/auth/delete', protectedRoute, async (request, reply) => {
    const checked = await authorized(request, reply);
    if (!checked) return;
    if (checked.body.confirmation !== checked.user.username)
      return reply
        .code(400)
        .send({ error: '请输入完整账号名确认注销。', code: 'CONFIRMATION_REQUIRED' });
    db.prepare('DELETE FROM users WHERE id = ?').run(checked.user.id);
    return options.clearSession(request, reply);
  });
}
