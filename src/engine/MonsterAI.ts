import type { Element } from '../core/types';
import { SeededRandom } from '../core/random';

export interface MonsterAIInput {
  dt: number;
  time: number;
  id: number;
  behavior: string;
  family: string;
  x: number;
  y: number;
  playerX: number;
  playerY: number;
  hp: number;
  maxHp: number;
  attack: number;
  speed: number;
  elite: boolean;
  affix?: string;
  stunned: boolean;
}

export interface MonsterAttackArea {
  id: number;
  source: string;
  shape: 'circle' | 'line' | 'cone';
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  angle: number;
  radius: number;
  range: number;
  width: number;
  element: Element;
  color: number;
}

export type MonsterAIEvent =
  | (MonsterAttackArea & { kind: 'telegraph'; delay: number })
  | (MonsterAttackArea & {
      kind: 'strike';
      playerHit: boolean;
      damage: number;
      slow?: { ratio: number; duration: number };
    })
  | { kind: 'heal'; amount: number; radius: number }
  | { kind: 'shield'; amount: number; duration: number }
  | { kind: 'summon'; count: number; hpRatio: number }
  | { kind: 'teleport'; x: number; y: number }
  | { kind: 'selfDestruct' };

interface PendingAttack {
  area: MonsterAttackArea;
  remaining: number;
  damage: number;
  slow?: { ratio: number; duration: number };
  repeat?: { remaining: number; interval: number };
  selfDestruct?: boolean;
  chargeEnd?: { x: number; y: number };
}

export interface MonsterBrain {
  random: SeededRandom;
  attackTimer: number;
  affixTimer: number;
  specialTimer: number;
  reflectTimer: number;
  lastHp: number | undefined;
  mirrored: boolean;
  deathHandled: boolean;
  sequence: number;
  pending: PendingAttack[];
}

export function createMonsterBrain(seed: number): MonsterBrain {
  const random = new SeededRandom(seed);
  return {
    random,
    attackTimer: 0.7 + random.next(),
    affixTimer: 1.5 + random.next() * 2,
    specialTimer: 3 + random.next() * 2,
    reflectTimer: 0,
    lastHp: undefined,
    mirrored: false,
    deathHandled: false,
    sequence: 0,
    pending: [],
  };
}

const COLORS: Record<Element, number> = {
  physical: 0xd6b282,
  fire: 0xe99c63,
  ice: 0x9ad7ea,
  lightning: 0xc2e4ed,
  arcane: 0xc09be8,
  poison: 0xb5c789,
};
const angleDifference = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function attackContains(area: MonsterAttackArea, x: number, y: number): boolean {
  const dx = x - area.x,
    dy = y - area.y;
  const distance = Math.hypot(dx, dy);
  if (area.shape === 'circle') return distance <= area.radius;
  const difference = angleDifference(Math.atan2(dy, dx), area.angle);
  if (area.shape === 'cone') return distance <= area.range && Math.abs(difference) <= area.width;
  const along = dx * Math.cos(area.angle) + dy * Math.sin(area.angle);
  const across = Math.abs(-dx * Math.sin(area.angle) + dy * Math.cos(area.angle));
  return along >= -12 && along <= area.range && across <= area.width;
}

/** Pure simulation step. Emit visuals on telegraph; apply damage only on strike.playerHit.
 * `heal.radius > 0` heals nearby allies; radius 0 heals only this monster.
 * A dead molten monster must keep stepping until its queued explosion resolves.
 */
export function stepMonsterAI(
  brain: MonsterBrain,
  input: MonsterAIInput,
): { velocity: { x: number; y: number }; events: MonsterAIEvent[] } {
  const events: MonsterAIEvent[] = [];
  const dt = Math.max(0, Math.min(0.1, input.dt));
  const distance = Math.hypot(input.playerX - input.x, input.playerY - input.y);
  const angle = Math.atan2(input.playerY - input.y, input.playerX - input.x);
  const affix = input.elite ? input.affix : undefined;
  const previousHp = brain.lastHp ?? input.hp;
  brain.lastHp = input.hp;
  brain.attackTimer -= dt;
  brain.affixTimer -= dt;
  brain.specialTimer -= dt;
  brain.reflectTimer -= dt;

  function schedule(
    source: string,
    element: Element,
    multiplier: number,
    delay: number,
    options: Partial<MonsterAttackArea> = {},
    extras: Partial<PendingAttack> = {},
  ) {
    const area: MonsterAttackArea = {
      id: input.id * 100000 + ++brain.sequence,
      source,
      shape: 'circle',
      x: input.playerX,
      y: input.playerY,
      targetX: input.playerX,
      targetY: input.playerY,
      angle,
      radius: 55,
      range: 360,
      width: 25,
      element,
      color: COLORS[element],
      ...options,
    };
    events.push({ ...area, kind: 'telegraph', delay });
    brain.pending.push({ area, remaining: delay, damage: input.attack * multiplier, ...extras });
  }

  // Captured attack origins allow movement to evade all telegraphed abilities.
  for (let i = brain.pending.length - 1; i >= 0; i--) {
    const pending = brain.pending[i];
    pending.remaining -= dt;
    if (pending.remaining > 0) continue;
    const playerHit = attackContains(pending.area, input.playerX, input.playerY);
    events.push({
      ...pending.area,
      kind: 'strike',
      playerHit,
      damage: pending.damage,
      slow: pending.slow,
    });
    if (playerHit && affix === 'vampiric')
      events.push({ kind: 'heal', amount: pending.damage * 0.3, radius: 0 });
    if (pending.chargeEnd) events.push({ kind: 'teleport', ...pending.chargeEnd });
    if (pending.selfDestruct) events.push({ kind: 'selfDestruct' });
    if (pending.repeat && pending.repeat.remaining > pending.repeat.interval) {
      pending.repeat.remaining -= pending.repeat.interval;
      pending.remaining = pending.repeat.interval;
      events.push({ ...pending.area, kind: 'telegraph', delay: pending.repeat.interval });
    } else brain.pending.splice(i, 1);
  }

  if (input.hp <= 0) {
    if (!brain.deathHandled) {
      brain.deathHandled = true;
      if (affix === 'molten')
        schedule('molten_death', 'fire', 2.5, 1.2, { x: input.x, y: input.y, radius: 115 });
    }
    return { velocity: { x: 0, y: 0 }, events };
  }

  if (affix === 'reflect' && previousHp > input.hp && brain.reflectTimer <= 0) {
    brain.reflectTimer = 0.5;
    schedule('reflect', 'physical', 0.1, 0, { x: input.playerX, y: input.playerY, radius: 12 });
  }
  if (affix === 'illusionist' && !brain.mirrored && input.hp <= input.maxHp * 0.5) {
    brain.mirrored = true;
    events.push({ kind: 'summon', count: 2, hpRatio: 0.25 });
  }

  if (!input.stunned && brain.affixTimer <= 0) {
    switch (affix) {
      case 'molten':
        brain.affixTimer = 1;
        schedule(
          'molten_trail',
          'fire',
          0.4,
          0.5,
          { x: input.x, y: input.y, radius: 40 },
          { repeat: { remaining: 3, interval: 1 } },
        );
        break;
      case 'frozen':
        brain.affixTimer = 5;
        schedule('frozen', 'ice', 1.2, 1.2, { radius: 75 }, { slow: { ratio: 1, duration: 1 } });
        break;
      case 'arcane': {
        brain.affixTimer = 6;
        // Six sequential spokes form a rotating, dodgeable three-second beam.
        for (let ray = 0; ray < 6; ray++)
          schedule('arcane', 'arcane', 0.5, 1.2 + ray * 0.5, {
            shape: 'line',
            x: input.x,
            y: input.y,
            angle: angle + (ray * Math.PI) / 5,
            range: 260,
            width: 17,
          });
        break;
      }
      case 'shielding':
        brain.affixTimer = 8;
        events.push({ kind: 'shield', amount: input.maxHp * 0.2, duration: 3 });
        break;
      case 'jailer':
        brain.affixTimer = 7;
        schedule(
          'jailer',
          'arcane',
          0.2,
          1.2,
          { radius: 85 },
          { slow: { ratio: 0.6, duration: 2 } },
        );
        break;
      case 'plagued':
        brain.affixTimer = 4;
        schedule(
          'plagued',
          'poison',
          0.35,
          0.6,
          { x: input.x, y: input.y, radius: 90 },
          { repeat: { remaining: 5, interval: 1 } },
        );
        break;
      default:
        brain.affixTimer = 1;
    }
  }

  let behavior = input.behavior;
  if (behavior === 'explode') behavior = 'bomber';
  if (behavior === 'ranged' && input.family === 'shaman') behavior = 'shaman';
  if (behavior === 'ranged' && input.family === 'cultist') behavior = 'healer';
  if (behavior === 'ambush' || (behavior === 'ranged' && input.family === 'eye'))
    behavior = 'teleporter';
  const ranged = ['ranged', 'shaman', 'healer', 'teleporter'].includes(behavior);
  const speed = input.speed * (affix === 'fast' ? 1.45 : 1);
  let movementAngle = angle;
  let movement = distance > (ranged ? 270 : 38) ? 1 : 0;
  if (ranged && distance < 160) movement = -1;
  if (behavior === 'swarm') movementAngle += Math.sin(input.time * 3 + input.id) * 0.5;
  if (input.stunned) movement = 0;

  if (!input.stunned && brain.specialTimer <= 0) {
    if (behavior === 'healer') {
      brain.specialTimer = 6;
      events.push({ kind: 'heal', amount: input.maxHp * 0.12, radius: 220 });
    } else if (behavior === 'teleporter') {
      brain.specialTimer = 6;
      const side = angle + ((brain.random.next() < 0.5 ? -1 : 1) * Math.PI) / 2;
      events.push({
        kind: 'teleport',
        x: Math.max(-780, Math.min(780, input.playerX + Math.cos(side) * 220)),
        y: Math.max(-780, Math.min(780, input.playerY + Math.sin(side) * 220)),
      });
    } else brain.specialTimer = 3;
  }

  if (!input.stunned && brain.attackTimer <= 0) {
    const cadence = affix === 'fast' ? 0.8 : 1;
    if (ranged && distance < 430) {
      brain.attackTimer = (behavior === 'shaman' ? 3.5 : 2.4) * cadence;
      const element =
        behavior === 'shaman'
          ? 'ice'
          : behavior === 'teleporter'
            ? 'arcane'
            : input.family === 'imp'
              ? 'fire'
              : 'physical';
      schedule(
        behavior,
        element,
        1,
        0.75,
        { shape: 'line', x: input.x, y: input.y, width: 16, range: Math.min(440, distance + 60) },
        behavior === 'shaman' ? { slow: { ratio: 0.45, duration: 2 } } : {},
      );
    } else if (behavior === 'bomber' && distance < 80) {
      brain.attackTimer = 999;
      movement = 0;
      schedule(
        'bomber',
        'poison',
        2,
        1.2,
        { x: input.x, y: input.y, radius: 105 },
        { selfDestruct: true },
      );
    } else if (behavior === 'charge' && distance > 80 && distance < 320) {
      brain.attackTimer = 4.5 * cadence;
      movement = 0;
      schedule(
        'charge',
        'physical',
        1.5,
        1.2,
        { shape: 'line', x: input.x, y: input.y, range: distance + 35, width: 32 },
        { chargeEnd: { x: input.playerX, y: input.playerY } },
      );
    } else if (behavior === 'slam' && distance < 135) {
      brain.attackTimer = 3 * cadence;
      schedule('slam', input.family === 'golem' ? 'fire' : 'physical', 1.6, 1.2, {
        x: input.x,
        y: input.y,
        radius: 135,
      });
    } else if (behavior === 'pull' && distance < 230) {
      brain.attackTimer = 4 * cadence;
      schedule(
        'pull',
        'physical',
        1.2,
        1.2,
        { shape: 'cone', x: input.x, y: input.y, range: 230, width: 0.5 },
        { slow: { ratio: 0.65, duration: 2 } },
      );
    } else if (!ranged && behavior !== 'bomber' && distance < 55) {
      brain.attackTimer = 1.5 * cadence;
      schedule('melee', 'physical', 1, 0.25, { x: input.x, y: input.y, radius: 62 });
    }
  }
  // Charging and self-detonating creatures stay in their announced origin.
  if (brain.pending.some((p) => p.selfDestruct || p.chargeEnd)) movement = 0;
  return {
    velocity: {
      x: Math.cos(movementAngle) * speed * movement,
      y: Math.sin(movementAngle) * speed * movement,
    },
    events,
  };
}
