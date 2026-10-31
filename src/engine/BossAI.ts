import type { BossDef } from '../core/types';
import {
  attackContains,
  type MonsterAIEvent,
  type MonsterAIInput,
  type MonsterAttackArea,
} from './MonsterAI';

interface PendingBossAttack {
  area: MonsterAttackArea;
  remaining: number;
  multiplier: number;
  followup?: 'guards' | 'poison' | 'blink' | 'charge' | 'frost';
}
export interface BossBrain {
  cooldown: number;
  age: number;
  casts: number;
  sequence: number;
  enraged: boolean;
  shieldGranted: boolean;
  pending: PendingBossAttack[];
}
export function createBossBrain(): BossBrain {
  return {
    cooldown: 2,
    age: 0,
    casts: 0,
    sequence: 0,
    enraged: false,
    shieldGranted: false,
    pending: [],
  };
}

/** All eight guardians reuse the normal monster event protocol and captured-area collision. */
export function stepBossAI(brain: BossBrain, input: MonsterAIInput, boss: BossDef) {
  const events: MonsterAIEvent[] = [];
  const dt = Math.max(0, Math.min(0.1, input.dt));
  brain.age += dt;
  brain.cooldown -= dt;
  brain.enraged = brain.age >= 120 || (boss.id === 'mist_devourer' && input.hp / input.maxHp < 0.3);
  const angle = Math.atan2(input.playerY - input.y, input.playerX - input.x);
  const distance = Math.hypot(input.playerX - input.x, input.playerY - input.y);

  const schedule = (
    options: Partial<MonsterAttackArea>,
    multiplier: number,
    delay = 1.2,
    followup?: PendingBossAttack['followup'],
  ) => {
    const area: MonsterAttackArea = {
      id: input.id * 1000000 + ++brain.sequence,
      source: boss.id,
      shape: boss.telegraph,
      x: boss.telegraph === 'circle' ? input.playerX : input.x,
      y: boss.telegraph === 'circle' ? input.playerY : input.y,
      targetX: input.playerX,
      targetY: input.playerY,
      angle,
      radius: 95,
      range: 420,
      width: boss.telegraph === 'cone' ? 0.65 : 34,
      element: boss.element,
      color: 0xe77386,
      ...options,
    };
    events.push({ ...area, kind: 'telegraph', delay });
    brain.pending.push({ area, remaining: delay, multiplier, followup });
  };

  if (input.hp <= 0) {
    brain.pending.length = 0;
    return { velocity: { x: 0, y: 0 }, events };
  }
  for (let index = brain.pending.length - 1; index >= 0; index--) {
    const pending = brain.pending[index];
    pending.remaining -= dt;
    if (pending.remaining > 0) continue;
    brain.pending.splice(index, 1);
    const { area } = pending;
    events.push({
      ...area,
      kind: 'strike',
      playerHit: attackContains(area, input.playerX, input.playerY),
      damage: input.attack * pending.multiplier * (brain.enraged ? 1.5 : 1),
      ...(pending.followup === 'frost' ? { slow: { ratio: 0.6, duration: 3 } } : {}),
    });
    if (pending.followup === 'guards') events.push({ kind: 'summon', count: 3, hpRatio: 0.025 });
    if (pending.followup === 'poison') {
      // Four one-second ticks share a persistent marked pool after the root strike.
      for (let tick = 1; tick <= 4; tick++)
        schedule(
          {
            shape: 'circle',
            source: 'thorn_pool',
            x: area.targetX,
            y: area.targetY,
            radius: 90,
            color: 0xa8c173,
          },
          0.45,
          tick,
        );
    }
    if (pending.followup === 'blink')
      events.push({
        kind: 'teleport',
        x: Math.max(-760, Math.min(760, area.targetX + Math.cos(area.angle) * 190)),
        y: Math.max(-760, Math.min(760, area.targetY + Math.sin(area.angle) * 190)),
      });
    if (pending.followup === 'charge') {
      const x = Math.max(-760, Math.min(760, area.targetX)),
        y = Math.max(-760, Math.min(760, area.targetY));
      events.push({ kind: 'teleport', x, y });
      schedule(
        { shape: 'circle', source: 'blood_tide', x, y, radius: 135, color: 0xeb8492 },
        1.5,
        1.2,
      );
    }
  }
  if (!brain.shieldGranted && input.hp / input.maxHp < 0.5) {
    brain.shieldGranted = true;
    events.push({ kind: 'shield', amount: input.maxHp * 0.08, duration: 6 });
  }
  if (brain.cooldown <= 0 && !brain.pending.length && !input.stunned) {
    brain.casts++;
    brain.cooldown = brain.enraged ? 2.6 : 4.5;
    switch (boss.id) {
      case 'grave_king':
        schedule({}, 2.5, 1.2, brain.casts % 3 === 0 ? 'guards' : undefined);
        break;
      case 'thorn_matriarch':
        schedule({ width: 40 }, 1.9, 1.2, 'poison');
        break;
      case 'cinder_lord':
        schedule({ range: 280, width: 0.7 }, 2.5);
        if (input.hp / input.maxHp < 0.5)
          schedule({ range: 300, width: 0.7, angle: angle + 0.7 }, 2.5, 2.7);
        break;
      case 'void_abbess':
        schedule({ range: 600, width: 30 }, 2.3, 1.2, 'blink');
        break;
      case 'winter_wyrm':
        schedule({ range: 310, width: 0.75 }, 2.1, 1.2, 'frost');
        break;
      case 'blood_butcher':
        schedule({ range: Math.min(480, distance + 40), width: 40 }, 2.2, 1.2, 'charge');
        break;
      case 'storm_archon': {
        const radius = brain.casts % 4 === 0 ? 155 : 90;
        schedule({ radius }, 2.2);
        for (let i = 0; i < 6; i++) {
          const theta = (i * Math.PI) / 3;
          schedule(
            {
              radius: 28,
              x: input.playerX + Math.cos(theta) * radius,
              y: input.playerY + Math.sin(theta) * radius,
            },
            0.8,
          );
        }
        break;
      }
      case 'mist_devourer':
        schedule({ radius: brain.enraged ? 145 : 100 }, brain.enraged ? 3 : 2.5);
        break;
    }
  }
  const moving = !brain.pending.length && !input.stunned && distance > 110;
  const speed = input.speed * (brain.enraged ? 1.25 : 1);
  return {
    velocity: { x: moving ? Math.cos(angle) * speed : 0, y: moving ? Math.sin(angle) * speed : 0 },
    events,
  };
}
