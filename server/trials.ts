import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { CoopInput } from '../src/core/coop';
import type { CoopRoom } from '../src/core/coopRoom';
import type { AccountData, CombatConfig, RunResult } from '../src/core/types';
import { SETS } from '../src/data/sets';
import { GameEngine } from '../src/engine/GameEngine';
import { createCombatConfig, useGameStore } from '../src/state/gameStore';
import { newSave } from '../src/state/saveData';
import { getPreferences } from '../src/core/preferences';
import { createRng } from '../src/core/random';
import { validCoopInput } from './coop';
import { recordVerifiedRun } from './verifiedRuns';

interface Trial {
  userId: string;
  room: CoopRoom;
  engine: GameEngine;
  input?: CoopInput;
  inputAt: number;
  lastSeen: number;
  clock: number;
  remaining: number;
  endedAt?: number;
}

/** Reuse the same laboratory builder without reading or mutating any player's save. */
export function officialTrialConfig(setId: string): CombatConfig {
  const definition = SETS.find((set) => set.id === setId);
  if (!definition) throw new Error('无效的官方流派。');
  const previous = useGameStore.getState();
  const previousRandom = Math.random;
  try {
    Math.random = createRng(8801);
    useGameStore.setState({
      save: newSave(definition.classId),
      labBackup: null,
      inCombat: false,
      cloudTransition: false,
    });
    useGameStore.getState().activateBuild(setId);
    return {
      ...createCombatConfig(structuredClone(useGameStore.getState().save)),
      stage: 150,
      seed: 4107,
      preferences: getPreferences({
        quality: 'low',
        effects: 'reduced',
        damageNumbers: 'off',
        screenShake: false,
      }),
    };
  } finally {
    Math.random = previousRandom;
    useGameStore.setState(previous, true);
  }
}

export function registerTrials(
  app: FastifyInstance,
  db: DatabaseSync,
  options: {
    getUser: (request: FastifyRequest) => { id: string; username: string } | null;
    event?: (event: string) => void;
  },
) {
  const trials = new Map<string, Trial>();
  const configured = Number(process.env.MAX_OFFICIAL_TRIALS ?? 4);
  const capacity =
    Number.isInteger(configured) && configured >= 1 && configured <= 16 ? configured : 4;
  const finish = (trial: Trial, result: RunResult) => {
    if (trial.room.status !== 'playing') return;
    trial.room.status = 'finished';
    trial.endedAt = Date.now();
    if (result.won) {
      const member = trial.room.members[0];
      recordVerifiedRun(db, {
        runId: trial.room.runId,
        userId: trial.userId,
        characterId: member.characterId,
        name: member.name,
        classId: member.classId,
        level: member.level,
        stage: 150,
        seconds: result.seconds,
        kills: result.kills,
        setName:
          SETS.find(
            (set) =>
              Object.values(member.config.equipment).filter((item) => item?.setId === set.id)
                .length >= 2,
          )?.name ?? null,
      });
    }
    options.event?.(result.won ? 'trial_won' : 'trial_failed');
  };
  const timer = setInterval(() => {
    const now = performance.now();
    for (const [userId, trial] of trials) {
      if (trial.endedAt) {
        if (Date.now() - trial.endedAt > 120000) {
          trial.engine.destroy();
          trials.delete(userId);
        }
        continue;
      }
      if (Date.now() - trial.lastSeen > 30000) {
        trial.room.status = 'aborted';
        trial.room.reason = '连接中断超过 30 秒，试炼已结束。';
        trial.endedAt = Date.now();
        options.event?.('trial_disconnected');
        continue;
      }
      trial.remaining += Math.min(200, Math.max(0, now - trial.clock));
      trial.clock = now;
      try {
        while (trial.remaining >= 1000 / 30 && trial.room.status === 'playing') {
          trial.engine.stepHeadless(Date.now() - trial.inputAt <= 500 ? trial.input : undefined);
          trial.remaining -= 1000 / 30;
        }
      } catch {
        trial.room.status = 'aborted';
        trial.room.reason = '试炼模拟异常，未写入成绩；请重新挑战。';
        trial.endedAt = Date.now();
        options.event?.('trial_error');
      }
    }
  }, 1000 / 30);
  timer.unref();
  app.addHook('onClose', async () => {
    clearInterval(timer);
    for (const trial of trials.values()) trial.engine.destroy();
    trials.clear();
  });
  const current = (request: FastifyRequest, reply: import('fastify').FastifyReply) => {
    const user = options.getUser(request);
    if (!user) {
      reply.code(401).send({ error: '请先登录云账号。', code: 'AUTH_REQUIRED' });
      return null;
    }
    return { user, trial: trials.get(user.id) };
  };
  const view = (trial: Trial) => {
    trial.lastSeen = Date.now();
    trial.room.inputSequenceBase = trial.input?.sequence ?? 0;
    trial.room.commandSequenceBase = Math.max(
      0,
      ...(trial.input?.commands ?? []).map((command) => command.sequence),
      trial.room.snapshot?.actors[0]?.inputSequence ?? 0,
    );
    if (trial.room.status !== 'aborted') {
      const frame = trial.engine.headlessFrame(trial.room.selfId);
      if (frame.results)
        frame.results = Object.fromEntries(
          Object.entries(frame.results).map(([id, result]) => [
            id,
            { ...result, gold: 0, shards: 0, items: [] },
          ]),
        );
      trial.room.snapshot = frame;
    }
    return { room: trial.room };
  };
  app.post(
    '/api/trials/start',
    {
      bodyLimit: 1024,
      config: {
        rateLimit: {
          max: 6,
          timeWindow: '1 minute',
          keyGenerator: (request) => options.getUser(request)?.id ?? request.ip,
        },
      },
    },
    async (request, reply) => {
      const state = current(request, reply);
      if (!state) return;
      const body = request.body as Record<string, unknown> | null;
      const set = SETS.find((definition) => definition.id === body?.setId);
      if (!set || !body || Object.keys(body).some((key) => key !== 'setId'))
        return reply.code(400).send({ error: '请选择官方试炼流派。', code: 'INVALID_BUILD' });
      if (state.trial?.room.status === 'playing')
        return reply
          .code(409)
          .send({ error: '已有进行中的试炼，可返回继续。', code: 'TRIAL_ACTIVE' });
      if (
        [...trials.values()].filter((trial) => trial.room.status === 'playing').length >= capacity
      )
        return reply
          .code(503)
          .send({ error: '试炼席位暂满，请稍后再试。', code: 'TRIAL_CAPACITY' });
      const saved = db
        .prepare('SELECT account_json FROM saves WHERE user_id = ?')
        .get(state.user.id);
      if (!saved?.account_json)
        return reply
          .code(409)
          .send({ error: '请先创建并同步云角色。', code: 'CLOUD_CHARACTER_REQUIRED' });
      const account = JSON.parse(String(saved.account_json)) as AccountData;
      const character = account.characters.find((entry) => entry.id === account.activeCharacterId)!;
      const config = officialTrialConfig(set.id);
      const actorId = randomUUID();
      const room: CoopRoom = {
        runId: randomUUID(),
        code: 'TRIAL',
        hostId: 'server',
        selfId: actorId,
        status: 'playing',
        stage: 150,
        seed: 4107,
        members: [
          {
            id: actorId,
            characterId: character.id,
            name: character.name,
            classId: set.classId,
            level: 100,
            ready: true,
            connected: true,
            config,
          },
        ],
      };
      const engine = new GameEngine();
      const trial: Trial = {
        userId: state.user.id,
        room,
        engine,
        inputAt: 0,
        lastSeen: Date.now(),
        clock: performance.now(),
        remaining: 0,
      };
      try {
        engine.initHeadless(config, {
          onSnapshot: () => {},
          onSound: () => {},
          onFinish: (result) => finish(trial, result),
        });
      } catch (error) {
        engine.destroy();
        throw error;
      }
      state.trial?.engine.destroy();
      trials.set(state.user.id, trial);
      options.event?.('trial_started');
      return reply.code(201).send(view(trial));
    },
  );
  app.get(
    '/api/trials/state',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const state = current(request, reply);
      if (!state) return;
      return state.trial ? view(state.trial) : { room: null };
    },
  );
  app.post(
    '/api/trials/exchange',
    {
      bodyLimit: 8192,
      config: {
        rateLimit: {
          max: 900,
          timeWindow: '1 minute',
          keyGenerator: (request) => options.getUser(request)?.id ?? request.ip,
        },
      },
    },
    async (request, reply) => {
      const state = current(request, reply);
      if (!state) return;
      if (!state.trial)
        return reply.code(404).send({ error: '试炼已结束，请重新挑战。', code: 'TRIAL_NOT_FOUND' });
      const body = request.body as Record<string, unknown> | null;
      if (
        !body ||
        Object.keys(body).some((key) => key !== 'input') ||
        (body.input !== undefined && !validCoopInput(body.input, state.trial.room.members[0]))
      )
        return reply
          .code(400)
          .send({ error: '试炼操作无效，不能提交战场或成绩。', code: 'INVALID_INPUT' });
      if (
        body.input &&
        (!state.trial.input || (body.input as CoopInput).sequence > state.trial.input.sequence)
      ) {
        state.trial.input = body.input as CoopInput;
        state.trial.inputAt = Date.now();
      }
      return view(state.trial);
    },
  );
  app.post('/api/trials/leave', { bodyLimit: 1024 }, async (request, reply) => {
    const state = current(request, reply);
    if (!state) return;
    state.trial?.engine.destroy();
    trials.delete(state.user.id);
    return { room: null };
  });
}
