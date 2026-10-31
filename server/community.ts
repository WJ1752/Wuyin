import { createHmac } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type {
  AccountData,
  ClassId,
  Item,
  LeaderboardResponse,
  LobbyActivity,
  LobbyPlayer,
  LobbyResponse,
} from '../src/core/types';
import { CLASSES } from '../src/data/classes';
import { SETS } from '../src/data/sets';

const TTL_MS = 45000;
const activities: LobbyActivity[] = [
  'town',
  'forge',
  'skills',
  'stash',
  'cube',
  'pets',
  'gamble',
  'rift',
];
interface PresenceRow {
  user_id: string;
  x: number;
  y: number;
  activity: LobbyActivity;
  updated_at: number;
  account_json: string;
}

/** Public profiles are derived from the validated cloud save, never a heartbeat payload. */
export function registerCommunity(
  app: FastifyInstance,
  db: DatabaseSync,
  options: {
    getUser: (request: FastifyRequest) => { id: string } | null;
    sessionHash: (request: FastifyRequest) => string;
    publicIdKey: string;
  },
) {
  const player = (row: PresenceRow, viewerId?: string): LobbyPlayer | null => {
    const account = JSON.parse(row.account_json) as AccountData;
    const character = account.characters.find((entry) => entry.id === account.activeCharacterId);
    if (!character) return null;
    const save = character.save;
    return {
      id: createHmac('sha256', options.publicIdKey)
        .update(row.user_id)
        .digest('base64url')
        .slice(0, 20),
      name: character.name,
      classId: save.classId,
      level: save.level,
      x: row.x,
      y: row.y,
      activity: row.activity,
      updatedAt: row.updated_at,
      isSelf: row.user_id === viewerId,
      equipment: Object.values(save.equipment)
        .filter((item): item is Item => !!item)
        .map(({ slot, name, rarity, level, setId, legendaryId }) => ({
          slot,
          name,
          rarity,
          level,
          setId,
          legendaryId,
        })),
      achievements: {
        clears: save.clears,
        clearedStage:
          save.progression?.clearedStage ??
          Math.max(0, ...(save.runRecords ?? []).map((run) => run.stage)),
        kills: save.kills,
      },
    };
  };
  const prune = (now: number) => {
    db.prepare(
      'DELETE FROM lobby_presence WHERE updated_at <= ? OR session_hash IN (SELECT token_hash FROM sessions WHERE expires_at <= ?)',
    ).run(now - TTL_MS, now);
  };
  const presenceQuery = `SELECT p.user_id, p.x, p.y, p.activity, p.updated_at, s.account_json
    FROM lobby_presence p JOIN saves s ON s.user_id = p.user_id WHERE s.account_json IS NOT NULL`;

  app.get(
    '/api/lobby',
    { config: { rateLimit: { max: 90, timeWindow: '1 minute' } } },
    async (request): Promise<LobbyResponse> => {
      const now = Date.now();
      const viewer = options.getUser(request);
      prune(now);
      const rows = db
        .prepare(`${presenceQuery} ORDER BY p.updated_at DESC, p.user_id LIMIT 100`)
        .all() as unknown as PresenceRow[];
      const count = db.prepare('SELECT COUNT(*) AS total FROM lobby_presence').get()!
        .total as number;
      return {
        players: rows
          .map((row) => player(row, viewer?.id))
          .filter((entry): entry is LobbyPlayer => !!entry),
        onlineCount: count,
        serverTime: now,
        ttlMs: TTL_MS,
      };
    },
  );
  app.post(
    '/api/lobby/heartbeat',
    {
      bodyLimit: 1024,
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
          keyGenerator: (request) => options.getUser(request)?.id ?? request.ip,
        },
      },
    },
    async (request, reply) => {
      const user = options.getUser(request);
      if (!user)
        return reply
          .code(401)
          .send({ error: '登录并同步云端角色后可进入在线大厅。', code: 'AUTH_REQUIRED' });
      const body = request.body as Record<string, unknown> | null;
      if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).some((key) => !['x', 'y', 'activity'].includes(key)) ||
        typeof body.x !== 'number' ||
        !Number.isFinite(body.x) ||
        body.x < 0 ||
        body.x > 1 ||
        typeof body.y !== 'number' ||
        !Number.isFinite(body.y) ||
        body.y < 0 ||
        body.y > 1 ||
        (body.activity !== undefined && !activities.includes(body.activity as LobbyActivity))
      )
        return reply
          .code(400)
          .send({ error: '大厅位置或交互状态无效。', code: 'INVALID_PRESENCE' });
      const saved = db.prepare('SELECT account_json FROM saves WHERE user_id = ?').get(user.id);
      if (!saved?.account_json)
        return reply
          .code(409)
          .send({ error: '请先创建或同步云端角色，再加入大厅。', code: 'CLOUD_SAVE_REQUIRED' });
      const now = Date.now();
      prune(now);
      db.prepare(
        `INSERT INTO lobby_presence(user_id, session_hash, x, y, activity, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET session_hash = excluded.session_hash, x = excluded.x,
      y = excluded.y, activity = excluded.activity, updated_at = excluded.updated_at`,
      ).run(
        user.id,
        options.sessionHash(request),
        body.x,
        body.y,
        (body.activity as LobbyActivity | undefined) ?? 'town',
        now,
      );
      const row = db
        .prepare(`${presenceQuery} AND p.user_id = ?`)
        .get(user.id) as unknown as PresenceRow;
      return { player: player(row, user.id), ttlMs: TTL_MS };
    },
  );
  app.post(
    '/api/lobby/leave',
    { bodyLimit: 1024, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const user = options.getUser(request);
      if (!user) return reply.code(401).send({ error: '请先登录账号。', code: 'AUTH_REQUIRED' });
      db.prepare('DELETE FROM lobby_presence WHERE user_id = ? AND session_hash = ?').run(
        user.id,
        options.sessionHash(request),
      );
      return { ok: true };
    },
  );

  app.get(
    '/api/leaderboard',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const query = request.query as Record<string, unknown>;
      const classId = query.classId;
      if (
        typeof classId !== 'string' ||
        !CLASSES.some((entry) => entry.id === classId) ||
        Object.keys(query).some((key) => key !== 'classId')
      )
        return reply.code(400).send({ error: '请选择有效职业。', code: 'INVALID_CLASS' });
      // SQLite projects only public record fields. Large inventories never leave the database.
      const rows = db
        .prepare(
          `WITH candidates AS (
      SELECT s.user_id, json_extract(c.value, '$.name') AS name,
        json_extract(r.value, '$.build.level') AS level,
        json_extract(r.value, '$.stage') AS stage,
        json_extract(r.value, '$.seconds') AS seconds,
        json_extract(r.value, '$.kills') AS kills,
        json_extract(r.value, '$.date') AS date,
        json_extract(r.value, '$.build.equipment') AS equipment,
        ROW_NUMBER() OVER (PARTITION BY s.user_id ORDER BY
          json_extract(r.value, '$.stage') DESC, json_extract(r.value, '$.seconds') ASC,
          json_extract(r.value, '$.date') ASC, c.key ASC, r.key ASC) AS account_rank
      FROM saves s, json_each(s.account_json, '$.characters') c,
        json_each(c.value, '$.save.runRecords') r
      WHERE s.account_json IS NOT NULL AND json_extract(r.value, '$.build.classId') = ?
        AND json_extract(r.value, '$.seconds') > 0
    ) SELECT *, COUNT(*) OVER () AS total FROM candidates WHERE account_rank = 1
      ORDER BY stage DESC, seconds ASC, date ASC, user_id ASC LIMIT 20`,
        )
        .all(classId) as unknown as {
        name: string;
        level: number;
        stage: number;
        seconds: number;
        kills: number;
        date: number;
        equipment: string;
        total: number;
      }[];
      const result: LeaderboardResponse = {
        classId: classId as ClassId,
        entries: rows.map((row, index) => {
          const counts = new Map<string, number>();
          for (const item of Object.values(JSON.parse(row.equipment) as Record<string, Item>))
            if (item?.setId) counts.set(item.setId, (counts.get(item.setId) ?? 0) + 1);
          const primary = [...counts]
            .filter(([, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
          return {
            rank: index + 1,
            name: row.name,
            classId: classId as ClassId,
            level: row.level,
            stage: row.stage,
            seconds: row.seconds,
            kills: row.kills,
            date: row.date,
            setName: SETS.find((set) => set.id === primary)?.name ?? null,
          };
        }),
        total: rows[0]?.total ?? 0,
        source: 'cloud',
        updatedAt: Date.now(),
      };
      return result;
    },
  );
}
