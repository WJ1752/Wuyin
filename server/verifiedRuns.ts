import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { CLASSES } from '../src/data/classes';
import type { ClassId } from '../src/core/types';

export interface VerifiedRun {
  runId: string;
  userId: string;
  characterId: string;
  name: string;
  classId: ClassId;
  level: number;
  stage: number;
  seconds: number;
  kills: number;
  setName: string | null;
}

/** Called only after the server has completed its own simulation, never from a save upload. */
export function recordVerifiedRun(db: DatabaseSync, run: VerifiedRun) {
  if (
    !CLASSES.some((entry) => entry.id === run.classId) ||
    !Number.isInteger(run.stage) ||
    run.stage < 1 ||
    run.stage > 150 ||
    !Number.isFinite(run.seconds) ||
    run.seconds <= 0 ||
    run.seconds > 300 ||
    !Number.isInteger(run.kills) ||
    run.kills < 0
  )
    throw new Error('服务器成绩无效。');
  db.prepare('INSERT OR IGNORE INTO verified_runs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
    run.runId,
    run.userId,
    run.characterId,
    run.name,
    run.classId,
    run.level,
    run.stage,
    run.seconds,
    run.kills,
    run.setName,
    Date.now(),
  );
}

export function registerVerifiedLeaderboard(app: FastifyInstance, db: DatabaseSync) {
  app.get('/api/leaderboard/verified', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    if (
      !CLASSES.some((entry) => entry.id === query.classId) ||
      Object.keys(query).some((key) => key !== 'classId')
    )
      return reply.code(400).send({ error: '请选择有效职业。', code: 'INVALID_CLASS' });
    const rows = db
      .prepare(
        `WITH ranked AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY user_id, set_name ORDER BY stage DESC, seconds, created_at, run_id) AS account_rank
      FROM verified_runs WHERE class_id = ?
    ) SELECT *, COUNT(*) OVER () AS total FROM ranked WHERE account_rank = 1
      ORDER BY stage DESC, seconds, created_at, run_id LIMIT 20`,
      )
      .all(String(query.classId));
    return {
      classId: query.classId,
      source: 'verified',
      entries: rows.map((row, index) => ({
        rank: index + 1,
        name: row.name,
        classId: row.class_id,
        level: row.level,
        stage: row.stage,
        seconds: row.seconds,
        kills: row.kills,
        date: row.created_at,
        setName: row.set_name,
      })),
      total: Number(rows[0]?.total ?? 0),
      updatedAt: Date.now(),
    };
  });
}
