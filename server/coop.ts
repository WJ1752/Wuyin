import { randomBytes, randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { CoopFrame, CoopInput } from '../src/core/coop';
import type { CoopRoom, CoopRoomMember } from '../src/core/coopRoom';
import type { AccountData, CombatSnapshot, RunResult } from '../src/core/types';
import { createCombatConfig } from '../src/state/gameStore';
import { newSave, validateSave } from '../src/state/saveData';
import { SKILLS } from '../src/data/skillTrees';
import { BOSSES, MONSTERS } from '../src/data/monsters';
import { PYLONS } from '../src/engine/BuffAndPylon';

const WAIT_TTL = 45000;
const HOST_TTL = 15000;
const RETAIN_MS = 120000;
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const nonnegative = (value: unknown): value is number => finite(value) && value >= 0;
const sequence = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;
const position = (value: unknown) => finite(value) && Math.abs(value) <= 100000;
const pylons = new Set<string>(PYLONS.map((pylon) => pylon.id));
const monsters = new Set([...MONSTERS, ...BOSSES].map((monster) => monster.id));
monsters.add('treasure_goblin');
interface Member extends CoopRoomMember {
  userId: string;
  session: string;
  lastSeen: number;
  inputAt: number;
  input: CoopInput;
}
interface Room {
  code: string;
  hostId: string;
  status: CoopRoom['status'];
  stage: number;
  seed: number;
  members: Member[];
  reason?: string;
  snapshot?: CoopFrame;
  endedAt?: number;
}

function validInput(value: unknown, member: Member): value is CoopInput {
  if (
    !object(value) ||
    Object.keys(value).some(
      (key) => !['sequence', 'movement', 'casts', 'commands', 'autoSkills', 'pylon'].includes(key),
    )
  )
    return false;
  const learned = new Set(
    SKILLS.filter(
      (skill) =>
        skill.classId === member.classId &&
        skill.kind !== 'passive' &&
        (member.config.skills[skill.id] ?? 0) > 0,
    ).map((skill) => skill.id),
  );
  return (
    sequence(value.sequence) &&
    object(value.movement) &&
    finite(value.movement.x) &&
    finite(value.movement.y) &&
    Math.abs(value.movement.x) <= 1 &&
    Math.abs(value.movement.y) <= 1 &&
    Array.isArray(value.casts) &&
    value.casts.length <= 6 &&
    value.casts.every((id) => typeof id === 'string' && learned.has(id)) &&
    (value.commands === undefined ||
      (Array.isArray(value.commands) &&
        value.commands.length <= 12 &&
        value.commands.every(
          (command) =>
            object(command) &&
            sequence(command.sequence) &&
            typeof command.id === 'string' &&
            (learned.has(command.id) ||
              (command.id.startsWith('pylon:') && pylons.has(command.id.slice(6)))),
        ))) &&
    (value.autoSkills === undefined ||
      (object(value.autoSkills) &&
        Object.keys(value.autoSkills).length <= SKILLS.length &&
        Object.entries(value.autoSkills).every(
          ([id, enabled]) =>
            SKILLS.some((skill) => skill.id === id) && typeof enabled === 'boolean',
        ))) &&
    (value.pylon === undefined || (typeof value.pylon === 'string' && pylons.has(value.pylon)))
  );
}
function validSnapshot(value: unknown): value is CombatSnapshot {
  if (!object(value)) return false;
  return (
    [
      'hp',
      'maxHp',
      'resource',
      'maxResource',
      'progress',
      'seconds',
      'kills',
      'combo',
      'fps',
    ].every((key) => nonnegative(value[key])) &&
    typeof value.paused === 'boolean' &&
    typeof value.finished === 'boolean' &&
    object(value.cooldowns) &&
    Object.values(value.cooldowns).every(nonnegative) &&
    Array.isArray(value.buffs) &&
    value.buffs.length <= 100 &&
    value.buffs.every(
      (buff) =>
        object(buff) &&
        typeof buff.name === 'string' &&
        typeof buff.color === 'string' &&
        nonnegative(buff.seconds),
    ) &&
    Array.isArray(value.pylons) &&
    value.pylons.length <= 4 &&
    value.pylons.every(
      (pylon) =>
        object(pylon) &&
        pylons.has(String(pylon.id)) &&
        typeof pylon.name === 'string' &&
        typeof pylon.used === 'boolean',
    ) &&
    (value.boss === undefined ||
      (object(value.boss) &&
        typeof value.boss.name === 'string' &&
        nonnegative(value.boss.hp) &&
        nonnegative(value.boss.maxHp)))
  );
}
// Bound the entire relay tree, including optional fields, before it reaches another renderer.
function bounded(value: unknown, depth = 0): boolean {
  if (depth > 16) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.length <= 4000;
  if (Array.isArray(value))
    return value.length <= 1200 && value.every((entry) => bounded(entry, depth + 1));
  return (
    object(value) &&
    Object.keys(value).length <= 300 &&
    Object.entries(value).every(
      ([key, entry]) =>
        key.length <= 100 &&
        !['__proto__', 'constructor', 'prototype'].includes(key) &&
        bounded(entry, depth + 1),
    )
  );
}
function validResult(value: unknown, member: Member, room: Room): value is RunResult {
  if (
    !object(value) ||
    typeof value.won !== 'boolean' ||
    value.stage !== room.stage ||
    value.partySize !== room.members.length ||
    !['seconds', 'kills', 'gold', 'shards'].every((key) => nonnegative(value[key])) ||
    !Array.isArray(value.items) ||
    value.items.length > 240
  )
    return false;
  try {
    validateSave({ ...newSave(member.classId), inventory: value.items });
    return true;
  } catch {
    return false;
  }
}
function validFrame(value: unknown, room: Room): value is CoopFrame {
  if (
    !object(value) ||
    !bounded(value) ||
    !sequence(value.sequence) ||
    !nonnegative(value.elapsed) ||
    !nonnegative(value.progress) ||
    !sequence(value.kills)
  )
    return false;
  const ids = new Set(room.members.map((member) => member.id));
  if (
    !Array.isArray(value.actors) ||
    value.actors.length !== ids.size ||
    !value.actors.every(
      (actor) =>
        object(actor) &&
        typeof actor.id === 'string' &&
        ids.delete(actor.id) &&
        position(actor.x) &&
        position(actor.y) &&
        finite(actor.facing) &&
        typeof actor.moving === 'boolean' &&
        nonnegative(actor.downSeconds) &&
        validSnapshot(actor.snapshot),
    )
  )
    return false;
  const array = (key: string, max: number, valid: (entry: Record<string, unknown>) => boolean) =>
    Array.isArray(value[key]) &&
    value[key].length <= max &&
    value[key].every((entry) => object(entry) && valid(entry));
  if (
    !array(
      'enemies',
      150,
      (enemy) =>
        sequence(enemy.id) &&
        monsters.has(String(enemy.defId)) &&
        position(enemy.x) &&
        position(enemy.y) &&
        finite(enemy.hp) &&
        nonnegative(enemy.maxHp) &&
        ['elite', 'boss', 'minion'].every((key) => typeof enemy[key] === 'boolean'),
    ) ||
    !array(
      'projectiles',
      1000,
      (projectile) =>
        position(projectile.x) &&
        position(projectile.y) &&
        finite(projectile.angle) &&
        sequence(projectile.color),
    ) ||
    !array(
      'zones',
      200,
      (zone) =>
        position(zone.x) && position(zone.y) && nonnegative(zone.radius) && sequence(zone.color),
    ) ||
    !array(
      'orbs',
      1200,
      (orb) =>
        position(orb.x) &&
        position(orb.y) &&
        ['health', 'progress', 'gold', 'item'].includes(String(orb.kind)),
    ) ||
    !array(
      'warnings',
      200,
      (warning) =>
        sequence(warning.id) &&
        position(warning.x) &&
        position(warning.y) &&
        ['radius', 'range', 'width'].every((key) => nonnegative(warning[key])) &&
        finite(warning.angle) &&
        ['circle', 'cone', 'line'].includes(String(warning.shape)) &&
        sequence(warning.color),
    ) ||
    !array('pylons', 4, (pylon) => pylons.has(String(pylon.id)) && typeof pylon.used === 'boolean')
  )
    return false;
  if (value.results !== undefined) {
    if (
      !object(value.results) ||
      Object.keys(value.results).length !== room.members.length ||
      !room.members.every((member) =>
        validResult((value.results as Record<string, unknown>)[member.id], member, room),
      )
    )
      return false;
    const results = Object.values(value.results) as RunResult[];
    if (
      results.some(
        (result) =>
          result.won !== results[0].won ||
          result.seconds !== results[0].seconds ||
          result.kills !== results[0].kills,
      )
    )
      return false;
  }
  return true;
}

/** Ephemeral, session-bound rooms reuse existing auth, CSRF and validated cloud characters. */
export function registerCoop(
  app: FastifyInstance,
  db: DatabaseSync,
  options: {
    getUser: (request: FastifyRequest) => { id: string } | null;
    sessionHash: (request: FastifyRequest) => string;
  },
) {
  const rooms = new Map<string, Room>();
  const membership = new Map<string, string>();
  let lastSweep = 0;
  const error = (reply: FastifyReply, status: number, code: string, message: string) =>
    reply.code(status).send({ error: message, code });
  const rate = (max: number) => ({
    rateLimit: {
      max,
      timeWindow: '1 minute',
      keyGenerator: (request: FastifyRequest) => options.getUser(request)?.id ?? request.ip,
    },
  });
  const sessionActive = (member: Member, now: number) =>
    !!db
      .prepare('SELECT 1 FROM sessions WHERE token_hash = ? AND user_id = ? AND expires_at > ?')
      .get(member.session, member.userId, now);
  const remove = (room: Room, member: Member) => {
    room.members = room.members.filter((entry) => entry !== member);
    membership.delete(member.userId);
  };
  const abort = (room: Room, reason: string, now: number) => {
    room.status = 'aborted';
    room.reason = reason;
    room.endedAt = now;
    room.snapshot = undefined;
  };
  const prune = (room: Room, now: number) => {
    if (room.status === 'waiting') {
      for (const member of [...room.members]) {
        if (now - member.lastSeen <= WAIT_TTL && sessionActive(member, now)) continue;
        if (member.id === room.hostId) abort(room, '房主已离开，房间已关闭。', now);
        else remove(room, member);
      }
    } else if (room.status === 'playing') {
      const host = room.members.find((member) => member.id === room.hostId)!;
      if (now - host.lastSeen > HOST_TTL || !sessionActive(host, now))
        abort(room, '房主连接中断，本次远征已终止，不结算奖励。', now);
      else if (now - host.inputAt > 5000 && room.snapshot) {
        // The host may be alive while its simulation is no longer producing frames.
        abort(room, '房主战场同步中断，请重新组队。', now);
      }
    }
    if (room.endedAt && now - room.endedAt > RETAIN_MS) {
      for (const member of room.members) membership.delete(member.userId);
      rooms.delete(room.code);
    }
  };
  const sweep = (now: number) => {
    if (now - lastSweep < 30000) return;
    lastSweep = now;
    for (const room of rooms.values()) prune(room, now);
  };
  const current = (request: FastifyRequest, reply: FastifyReply) => {
    const user = options.getUser(request);
    if (!user) {
      error(reply, 401, 'AUTH_REQUIRED', '请先登录并同步云端角色，再组队爬塔。');
      return null;
    }
    const now = Date.now();
    sweep(now);
    const code = membership.get(user.id);
    const room = code ? rooms.get(code) : undefined;
    if (room) prune(room, now);
    const member = room?.members.find((entry) => entry.userId === user.id);
    if (member && member.session !== options.sessionHash(request)) {
      error(reply, 409, 'ROOM_SESSION', '此账号已在另一会话中组队，请先离开原房间。');
      return null;
    }
    return { user, room: room && rooms.has(room.code) ? room : undefined, member, now };
  };
  const profile = (userId: string, stage: number) => {
    const row = db.prepare('SELECT account_json FROM saves WHERE user_id = ?').get(userId);
    if (!row?.account_json) return null;
    const account = JSON.parse(String(row.account_json)) as AccountData;
    const character = account.characters.find((entry) => entry.id === account.activeCharacterId);
    if (!character || stage > character.save.highestStage) return null;
    return { character, config: { ...createCombatConfig(character.save, account.stash), stage } };
  };
  const view = (room: Room, self: Member, now: number): CoopRoom => ({
    code: room.code,
    hostId: room.hostId,
    selfId: self.id,
    status: room.status,
    stage: room.stage,
    seed: room.seed,
    members: room.members.map(
      ({
        userId: _userId,
        session: _session,
        lastSeen,
        inputAt: _inputAt,
        input: _input,
        ...member
      }) => ({ ...member, connected: now - lastSeen < 5000 }),
    ),
    ...(room.reason ? { reason: room.reason } : {}),
    ...(room.snapshot ? { snapshot: room.snapshot } : {}),
    ...(room.status === 'playing'
      ? {
          inputs: Object.fromEntries(
            room.members.map((member) => [
              member.id,
              now - member.inputAt <= 500
                ? member.input
                : { sequence: member.input.sequence, movement: { x: 0, y: 0 }, casts: [] },
            ]),
          ),
        }
      : {}),
  });
  const response = (room: Room, member: Member, now: number) => ({ room: view(room, member, now) });
  const memberOnly = (request: FastifyRequest, reply: FastifyReply) => {
    const state = current(request, reply);
    if (!state) return null;
    if (!state.room || !state.member) {
      error(reply, 404, 'ROOM_NOT_FOUND', '房间已关闭，请重新组队。');
      return null;
    }
    return { ...state, room: state.room, member: state.member };
  };
  app.get('/api/coop/room', { config: rate(120) }, async (request, reply) => {
    const state = current(request, reply);
    if (!state) return;
    if (!state.room || !state.member) return { room: null };
    state.member.lastSeen = state.now;
    return response(state.room, state.member, state.now);
  });
  app.post('/api/coop/create', { bodyLimit: 1024, config: rate(12) }, async (request, reply) => {
    const state = current(request, reply);
    if (!state) return;
    if (state.room) return error(reply, 409, 'ALREADY_IN_ROOM', '请先离开当前房间。');
    const body = request.body;
    if (
      !object(body) ||
      Object.keys(body).some((key) => key !== 'stage') ||
      !Number.isInteger(body.stage) ||
      Number(body.stage) < 1 ||
      Number(body.stage) > 150
    )
      return error(reply, 400, 'INVALID_STAGE', '请选择1至150层秘境。');
    const stage = Number(body.stage);
    const saved = profile(state.user.id, stage);
    if (!saved)
      return error(
        reply,
        409,
        'CLOUD_CHARACTER_REQUIRED',
        '请先同步云端角色，并选择该角色已解锁的层数。',
      );
    if (rooms.size >= 1024) return error(reply, 503, 'ROOM_CAPACITY', '远征房间暂满，请稍后重试。');
    let code = '';
    do {
      code = randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
    } while (rooms.has(code));
    const member: Member = {
      id: randomUUID(),
      userId: state.user.id,
      session: options.sessionHash(request),
      characterId: saved.character.id,
      name: saved.character.name,
      classId: saved.config.classId,
      level: saved.config.level,
      config: saved.config,
      ready: true,
      connected: true,
      lastSeen: state.now,
      inputAt: state.now,
      input: { sequence: 0, movement: { x: 0, y: 0 }, casts: [] },
    };
    const room: Room = {
      code,
      hostId: member.id,
      status: 'waiting',
      stage,
      seed: randomBytes(4).readUInt32BE(),
      members: [member],
    };
    rooms.set(code, room);
    membership.set(state.user.id, code);
    return reply.code(201).send(response(room, member, state.now));
  });
  app.post('/api/coop/join', { bodyLimit: 1024, config: rate(30) }, async (request, reply) => {
    const state = current(request, reply);
    if (!state) return;
    const body = request.body;
    if (
      !object(body) ||
      Object.keys(body).some((key) => key !== 'code') ||
      typeof body.code !== 'string' ||
      !/^[A-Fa-f0-9]{6}$/.test(body.code)
    )
      return error(reply, 400, 'INVALID_ROOM_CODE', '请输入六位远征房间码。');
    const code = body.code.toUpperCase();
    if (state.room)
      return state.room.code === code
        ? response(state.room, state.member!, state.now)
        : error(reply, 409, 'ALREADY_IN_ROOM', '请先离开当前房间。');
    const room = rooms.get(code);
    if (room) prune(room, state.now);
    if (!room || !rooms.has(code))
      return error(reply, 404, 'ROOM_NOT_FOUND', '房间不存在或已关闭。');
    if (room.status !== 'waiting')
      return error(reply, 409, 'ROOM_STARTED', '远征已开始或结束，请等待房主重新建房。');
    if (room.members.length >= 4) return error(reply, 409, 'ROOM_FULL', '房间已满，最多四位旅人。');
    const saved = profile(state.user.id, room.stage);
    if (!saved)
      return error(
        reply,
        409,
        'CLOUD_CHARACTER_REQUIRED',
        '请先同步云端角色，且所有队员都需解锁当前层数。',
      );
    const member: Member = {
      id: randomUUID(),
      userId: state.user.id,
      session: options.sessionHash(request),
      characterId: saved.character.id,
      name: saved.character.name,
      classId: saved.config.classId,
      level: saved.config.level,
      config: saved.config,
      ready: false,
      connected: true,
      lastSeen: state.now,
      inputAt: state.now,
      input: { sequence: 0, movement: { x: 0, y: 0 }, casts: [] },
    };
    room.members.push(member);
    membership.set(state.user.id, code);
    return response(room, member, state.now);
  });
  app.post('/api/coop/ready', { bodyLimit: 1024, config: rate(60) }, async (request, reply) => {
    const state = memberOnly(request, reply);
    if (!state) return;
    const { room, member, now } = state;
    if (room.status !== 'waiting')
      return error(reply, 409, 'ROOM_STARTED', '远征开始后不能修改准备状态。');
    const body = request.body;
    if (
      !object(body) ||
      Object.keys(body).some((key) => key !== 'ready') ||
      typeof body.ready !== 'boolean'
    )
      return error(reply, 400, 'INVALID_READY', '准备状态无效。');
    const saved = profile(member.userId, room.stage);
    if (!saved)
      return error(reply, 409, 'CLOUD_CHARACTER_REQUIRED', '请先同步已解锁当前层数的角色。');
    Object.assign(member, {
      characterId: saved.character.id,
      name: saved.character.name,
      classId: saved.config.classId,
      level: saved.config.level,
      config: saved.config,
      ready: body.ready,
      lastSeen: now,
    });
    return response(room, member, now);
  });
  app.post('/api/coop/start', { bodyLimit: 1024, config: rate(30) }, async (request, reply) => {
    const state = memberOnly(request, reply);
    if (!state) return;
    const { room, member, now } = state;
    if (member.id !== room.hostId)
      return error(reply, 403, 'HOST_REQUIRED', '只有房主可以开始远征。');
    if (room.status !== 'waiting')
      return error(reply, 409, 'ROOM_STARTED', '此房间的远征已开始或结束。');
    for (const entry of room.members) {
      if (!entry.ready || now - entry.lastSeen >= 5000)
        return error(reply, 409, 'NOT_READY', '请等待所有队员在线并准备。');
      const saved = profile(entry.userId, room.stage);
      if (
        !saved ||
        saved.character.id !== entry.characterId ||
        JSON.stringify(saved.config) !== JSON.stringify(entry.config)
      ) {
        entry.ready = false;
        return error(reply, 409, 'CHARACTER_CHANGED', '队员角色或配装已改变，请同步后重新准备。');
      }
    }
    room.status = 'playing';
    for (const entry of room.members) entry.inputAt = now;
    return response(room, member, now);
  });
  app.post(
    '/api/coop/exchange',
    { bodyLimit: 256 * 1024, config: rate(900) },
    async (request, reply) => {
      const state = memberOnly(request, reply);
      if (!state) return;
      const { room, member, now } = state;
      const body = request.body;
      if (!object(body) || Object.keys(body).some((key) => !['input', 'snapshot'].includes(key)))
        return error(reply, 400, 'INVALID_EXCHANGE', '战场同步数据无效。');
      if (room.status === 'waiting')
        return error(reply, 409, 'ROOM_NOT_STARTED', '请等待房主开始远征。');
      if (body.snapshot !== undefined && member.id !== room.hostId)
        return error(reply, 403, 'HOST_REQUIRED', '仅房主可提交战场快照。');
      if (body.input !== undefined && !validInput(body.input, member))
        return error(reply, 400, 'INVALID_INPUT', '战场输入无效。');
      if (body.snapshot !== undefined && !validFrame(body.snapshot, room))
        return error(reply, 400, 'INVALID_FRAME', '战场快照格式或结算无效。');
      member.lastSeen = now;
      if (room.status === 'playing') {
        if (
          body.input !== undefined &&
          (body.input as CoopInput).sequence > member.input.sequence
        ) {
          member.input = body.input as CoopInput;
          member.inputAt = now;
        }
        if (
          body.snapshot !== undefined &&
          (!room.snapshot || (body.snapshot as CoopFrame).sequence > room.snapshot.sequence)
        ) {
          room.snapshot = body.snapshot as CoopFrame;
          member.inputAt = now;
          if (room.snapshot.results) {
            room.status = 'finished';
            room.endedAt = now;
          }
        }
      }
      return response(room, member, now);
    },
  );
  app.post('/api/coop/leave', { bodyLimit: 1024, config: rate(60) }, async (request, reply) => {
    const state = current(request, reply);
    if (!state) return;
    const { room, member, now } = state;
    if (!room || !member) return { room: null };
    if (room.status === 'playing')
      abort(
        room,
        member.id === room.hostId
          ? '房主已离开，本次远征终止，不结算奖励。'
          : `${member.name}已离队，本次远征终止，不结算奖励。`,
        now,
      );
    else if (room.status === 'waiting' && member.id === room.hostId)
      abort(room, '房主已关闭房间。', now);
    remove(room, member);
    if (!room.members.length) rooms.delete(room.code);
    return { room: null };
  });
}
