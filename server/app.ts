import Fastify, { type FastifyError, type FastifyReply, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import csrf from '@fastify/csrf-protection';
import rateLimit from '@fastify/rate-limit';
import serveStatic from '@fastify/static';
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { openDatabase } from './database';
import { registerCommunity } from './community';
import { MAX_IMPORT_BYTES, validateAccountSave } from '../src/state/saveData';
import type { AccountData } from '../src/core/types';

export interface AppOptions {
  dbPath?: string;
  origins?: string[];
  secureCookies?: boolean;
  staticDir?: string;
  logger?: boolean;
  sessionTtlMs?: number;
  trustProxy?: number | false;
}
interface User {
  id: string;
  username: string;
}
interface UserRow extends User {
  password_salt: string;
  password_hash: string;
}
interface SaveRow {
  account_json: string | null;
  revision: number;
  updated_at: number | null;
}
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
function passwordHash(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolveHash, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolveHash(key);
    });
  });
}
function credentials(body: unknown) {
  if (
    !isObject(body) ||
    typeof body.username !== 'string' ||
    !/^[A-Za-z0-9_-]{3,24}$/.test(body.username) ||
    typeof body.password !== 'string' ||
    body.password.length < 12 ||
    body.password.length > 128
  )
    return null;
  return { username: body.username, password: body.password };
}

export async function createApp(options: AppOptions = {}) {
  const app = Fastify({
    logger: options.logger
      ? { redact: ['req.headers.cookie', 'req.headers.authorization', 'req.body.password'] }
      : false,
    bodyLimit: 1024 * 1024,
    // Only a configured reverse proxy should be trusted; never trust arbitrary forwarding headers.
    trustProxy: options.trustProxy ? (_address, hop) => hop < Number(options.trustProxy) : false,
  });
  const db = openDatabase(options.dbPath ?? resolve('data/wuyin.sqlite'));
  app.addHook('onClose', async () => db.close());
  const secure = options.secureCookies ?? process.env.NODE_ENV === 'production';
  const sessionCookie = secure ? '__Host-wuyin-session' : 'wuyin-session';
  const csrfCookie = secure ? '__Host-wuyin-csrf' : 'wuyin-csrf';
  const sessionTtl = options.sessionTtlMs ?? 30 * 24 * 60 * 60 * 1000;
  if (!Number.isFinite(sessionTtl) || sessionTtl <= 0) throw new Error('会话有效期配置无效。');
  const origins = new Set(
    options.origins ?? [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ],
  );
  for (const origin of origins) {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin)
      throw new Error('APP_ORIGINS 必须是完整的 HTTP(S) 来源，不含路径或通配符。');
  }
  const cookieSecret = db.prepare('SELECT value FROM metadata WHERE key = ?').get('cookie_secret')!
    .value as string;
  const cookieOptions = { path: '/', httpOnly: true, sameSite: 'strict' as const, secure };
  await app.register(cookie, { secret: cookieSecret });
  await app.register(csrf, {
    cookieKey: csrfCookie,
    cookieOpts: { ...cookieOptions, signed: true },
    getToken: (request) => request.headers['x-csrf-token'] as string,
  });
  await app.register(rateLimit, { global: true, max: 180, timeWindow: '1 minute' });
  app.addHook('onRequest', (request, reply, done) => {
    if (!request.url.startsWith('/api/')) return done();
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    const origin = request.headers.origin;
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
    if ((origin && !origins.has(origin)) || (write && !origin)) {
      reply.code(403).send({ error: '请求来源不受信任。', code: 'ORIGIN_REJECTED' });
      return;
    }
    if (write) app.csrfProtection(request, reply, done);
    else done();
  });
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const status = typeof error.statusCode === 'number' ? error.statusCode : 500;
    if (error.code?.startsWith('FST_CSRF_'))
      return reply.code(403).send({ error: '安全令牌失效，请刷新后重试。', code: 'CSRF_INVALID' });
    if (status === 429)
      return reply.code(429).send({ error: '操作过于频繁，请稍后重试。', code: 'RATE_LIMITED' });
    if (status === 413)
      return reply.code(413).send({ error: '请求数据过大。', code: 'PAYLOAD_TOO_LARGE' });
    if (status >= 400 && status < 500)
      return reply.code(status).send({ error: '请求格式无效。', code: 'BAD_REQUEST' });
    // Do not log bodies, credentials, cookie values, or database statements.
    request.log.error({ requestId: request.id, code: error.code }, 'API request failed');
    return reply.code(500).send({ error: '服务暂时不可用，请稍后重试。', code: 'INTERNAL_ERROR' });
  });
  const getUser = (request: FastifyRequest): User | null => {
    const token = request.cookies[sessionCookie];
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    const now = Date.now();
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
    const user = db
      .prepare(
        'SELECT u.id, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > ?',
      )
      .get(tokenHash(token), now) as unknown as User | undefined;
    return user ? { id: user.id, username: user.username } : null;
  };
  const revokeSession = (request: FastifyRequest) => {
    const token = request.cookies[sessionCookie];
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash(token));
  };
  const rotateCsrf = (request: FastifyRequest, reply: FastifyReply) => {
    delete request.cookies[csrfCookie];
    return reply.generateCsrf();
  };
  const beginSession = (user: User, request: FastifyRequest, reply: FastifyReply) => {
    revokeSession(request);
    const token = randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
      tokenHash(token),
      user.id,
      Date.now() + sessionTtl,
    );
    reply.setCookie(sessionCookie, token, {
      ...cookieOptions,
      maxAge: Math.floor(sessionTtl / 1000),
    });
    return {
      user: { id: user.id, username: user.username },
      csrfToken: rotateCsrf(request, reply),
    };
  };
  const getSave = (user: User) => {
    const row = db
      .prepare('SELECT account_json, revision, updated_at FROM saves WHERE user_id = ?')
      .get(user.id) as unknown as SaveRow;
    return {
      account: row.account_json ? (JSON.parse(row.account_json) as AccountData) : null,
      revision: row.revision,
      updatedAt: row.updated_at,
    };
  };
  // Missing usernames still perform scrypt to avoid a cheap credential-enumeration path.
  const dummySalt = randomBytes(16).toString('hex');
  const dummyHash = await passwordHash(randomBytes(32).toString('base64url'), dummySalt);

  app.get('/api/health', async () => {
    db.prepare('SELECT 1').get();
    return { ok: true };
  });
  app.get('/api/session', async (request, reply) => ({
    user: getUser(request),
    csrfToken: reply.generateCsrf(),
  }));
  app.post(
    '/api/auth/register',
    { bodyLimit: 4096, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const input = credentials(request.body);
      if (!input)
        return reply.code(400).send({
          error: '用户名需为 3–24 位字母、数字、下划线或连字符；密码需为 12–128 位。',
          code: 'INVALID_CREDENTIALS_FORMAT',
        });
      const salt = randomBytes(16).toString('hex');
      const hash = (await passwordHash(input.password, salt)).toString('hex');
      const user = { id: randomUUID(), username: input.username };
      db.exec('BEGIN IMMEDIATE');
      try {
        if (db.prepare('SELECT id FROM users WHERE username = ?').get(input.username)) {
          db.exec('ROLLBACK');
          return reply
            .code(409)
            .send({ error: '该用户名已被使用。', code: 'USERNAME_UNAVAILABLE' });
        }
        db.prepare(
          'INSERT INTO users(id, username, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
        ).run(user.id, user.username, salt, hash, Date.now());
        db.prepare('INSERT INTO saves(user_id) VALUES (?)').run(user.id);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return reply.code(201).send(beginSession(user, request, reply));
    },
  );
  app.post(
    '/api/auth/login',
    { bodyLimit: 4096, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const input = credentials(request.body);
      if (!input)
        return reply
          .code(400)
          .send({ error: '用户名或密码格式无效。', code: 'INVALID_CREDENTIALS_FORMAT' });
      const user = db
        .prepare('SELECT * FROM users WHERE username = ?')
        .get(input.username) as unknown as UserRow | undefined;
      const candidate = await passwordHash(input.password, user?.password_salt ?? dummySalt);
      const expected = user ? Buffer.from(user.password_hash, 'hex') : dummyHash;
      if (!timingSafeEqual(candidate, expected) || !user)
        return reply.code(401).send({ error: '用户名或密码错误。', code: 'INVALID_CREDENTIALS' });
      return beginSession(user, request, reply);
    },
  );
  app.post('/api/auth/logout', async (request, reply) => {
    revokeSession(request);
    reply.clearCookie(sessionCookie, cookieOptions);
    return { user: null, csrfToken: rotateCsrf(request, reply) };
  });
  app.get('/api/save', async (request, reply) => {
    const user = getUser(request);
    if (!user) return reply.code(401).send({ error: '请先登录账号。', code: 'AUTH_REQUIRED' });
    return getSave(user);
  });
  app.put('/api/save', { bodyLimit: MAX_IMPORT_BYTES }, async (request, reply) => {
    const user = getUser(request);
    if (!user) return reply.code(401).send({ error: '请先登录账号。', code: 'AUTH_REQUIRED' });
    const body = request.body;
    if (
      !isObject(body) ||
      !isObject(body.account) ||
      !Number.isSafeInteger(body.revision) ||
      Number(body.revision) < 0
    )
      return reply.code(400).send({ error: '存档或版本号无效。', code: 'INVALID_SAVE' });
    if (body.account.id !== user.id)
      return reply.code(401).send({
        error: '服务器会话已切换，请重新登录此存档所属账号。',
        code: 'ACCOUNT_MISMATCH',
      });
    let account: AccountData;
    try {
      account = validateAccountSave({
        format: 'mist-continent-accounts',
        version: 1,
        accounts: [{ ...body.account, id: user.id, name: user.username }],
        activeAccountId: user.id,
        lastSaved: Date.now(),
      }).accounts[0];
    } catch {
      return reply
        .code(400)
        .send({ error: '存档未通过角色、装备或容量校验。', code: 'INVALID_SAVE' });
    }
    const result = db
      .prepare(
        'UPDATE saves SET account_json = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?',
      )
      .run(JSON.stringify(account), Date.now(), user.id, Number(body.revision));
    if (result.changes !== 1) {
      const current = getSave(user);
      return reply.code(409).send({
        error: '云端已被其他设备更新，请读取最新存档后再保存。',
        code: 'SAVE_CONFLICT',
        revision: current.revision,
      });
    }
    return getSave(user);
  });
  registerCommunity(app, db, {
    getUser,
    sessionHash: (request) => tokenHash(request.cookies[sessionCookie] ?? ''),
    publicIdKey: cookieSecret,
  });
  if (options.staticDir) await app.register(serveStatic, { root: resolve(options.staticDir) });
  app.setNotFoundHandler((request, reply) => {
    if (options.staticDir && request.method === 'GET' && !request.url.startsWith('/api/'))
      return reply.sendFile('index.html');
    return reply.code(404).send({ error: '接口不存在。', code: 'NOT_FOUND' });
  });
  await app.ready();
  return app;
}
