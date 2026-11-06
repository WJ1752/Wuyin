import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { monitorEventLoopDelay } from 'node:perf_hooks';

export function registerOperations(
  app: FastifyInstance,
  db: DatabaseSync,
  getUser: (request: FastifyRequest) => { id: string } | null,
) {
  const startedAt = Date.now();
  const starts = new WeakMap<FastifyRequest, number>();
  const counts: Record<string, number> = {};
  const eventLoop = monitorEventLoopDelay({ resolution: 20 });
  eventLoop.enable();
  app.addHook('onClose', async () => eventLoop.disable());
  let requests = 0;
  let failures = 0;
  let totalMs = 0;
  let maxMs = 0;
  app.addHook('onRequest', async (request) => {
    starts.set(request, performance.now());
  });
  app.addHook('onResponse', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return;
    const ms = performance.now() - (starts.get(request) ?? performance.now());
    requests++;
    if (reply.statusCode >= 500) failures++;
    totalMs += ms;
    maxMs = Math.max(maxMs, ms);
    if (ms > 2000)
      request.log.warn(
        { route: request.routeOptions.url, durationMs: Math.round(ms) },
        'Slow API request',
      );
  });
  app.get('/api/operations/metrics', async (request, reply) => {
    const expected = process.env.OPERATIONS_TOKEN;
    const supplied = request.headers.authorization?.replace(/^Bearer /, '') ?? '';
    if (!expected || expected.length < 32)
      return reply.code(404).send({ error: '接口不存在。', code: 'NOT_FOUND' });
    const suppliedBytes = Buffer.from(supplied);
    const expectedBytes = Buffer.from(expected);
    if (
      suppliedBytes.length !== expectedBytes.length ||
      !timingSafeEqual(suppliedBytes, expectedBytes)
    )
      return reply.code(401).send({ error: '监测凭据无效。', code: 'AUTH_REQUIRED' });
    return {
      startedAt,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      requests,
      failures,
      latency: { meanMs: requests ? totalMs / requests : 0, maxMs },
      eventLoop: {
        meanMs: Number.isFinite(eventLoop.mean) ? eventLoop.mean / 1e6 : 0,
        p99Ms: eventLoop.percentile(99) / 1e6,
        maxMs: eventLoop.max / 1e6,
      },
      memory: {
        rssMB: process.memoryUsage().rss / 1048576,
        heapUsedMB: process.memoryUsage().heapUsed / 1048576,
      },
      events: { ...counts },
      pendingRewards: Number(
        db.prepare('SELECT COUNT(*) AS n FROM coop_results WHERE claimed_at IS NULL').get()!.n,
      ),
      feedback: Number(db.prepare('SELECT COUNT(*) AS n FROM player_feedback').get()!.n),
    };
  });
  app.post(
    '/api/feedback',
    { bodyLimit: 8192, config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = request.body as Record<string, unknown> | null;
      if (
        !body ||
        !['bug', 'suggestion', 'runtime', 'network'].includes(String(body.category)) ||
        typeof body.message !== 'string' ||
        body.message.trim().length < 5 ||
        body.message.length > 2000
      )
        return reply
          .code(400)
          .send({ error: '请填写 5–2000 字的问题说明。', code: 'INVALID_FEEDBACK' });
      const id = randomUUID();
      db.prepare('DELETE FROM player_feedback WHERE created_at < ?').run(
        Date.now() - 30 * 86400000,
      );
      db.prepare(
        'DELETE FROM player_feedback WHERE id IN (SELECT id FROM player_feedback ORDER BY created_at DESC LIMIT -1 OFFSET 9999)',
      ).run();
      db.prepare('INSERT INTO player_feedback VALUES (?, ?, ?, ?, ?)').run(
        id,
        getUser(request)?.id ?? null,
        String(body.category),
        body.message.trim(),
        Date.now(),
      );
      return reply.code(201).send({ id });
    },
  );
  return (event: string) => {
    counts[event] = (counts[event] ?? 0) + 1;
  };
}
