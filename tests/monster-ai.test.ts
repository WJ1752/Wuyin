import assert from 'node:assert/strict';
import test from 'node:test';
import { SeededRandom } from '../src/core/random';
import { createMonsterBrain, stepMonsterAI, type MonsterAIInput } from '../src/engine/MonsterAI';

const input: MonsterAIInput = {
  dt: 0.1,
  time: 0,
  id: 1,
  behavior: 'slam',
  family: 'golem',
  x: 0,
  y: 0,
  playerX: 80,
  playerY: 0,
  hp: 100,
  maxHp: 100,
  attack: 20,
  speed: 50,
  elite: false,
  stunned: false,
};

test('seeded random sequences resume from saved state without changing the source list', () => {
  const first = new SeededRandom('mist-seed'),
    second = new SeededRandom('mist-seed');
  assert.deepEqual(Array.from({ length: 8 }, first.next), Array.from({ length: 8 }, second.next));
  const checkpoint = first.state;
  const next = first.next();
  first.state = checkpoint;
  assert.equal(first.next(), next);
  const original = [1, 2, 3, 4, 5];
  assert.deepEqual([...first.shuffle(original)].sort(), original);
  assert.deepEqual(original, [1, 2, 3, 4, 5]);
});

test('a telegraphed slam resolves after its windup and can be evaded', () => {
  const brain = createMonsterBrain(1);
  brain.attackTimer = 0;
  const start = stepMonsterAI(brain, input);
  const warning = start.events.find((event) => event.kind === 'telegraph');
  assert.ok(warning);
  assert.equal(warning.delay, 1.2);
  assert.equal(
    start.events.some((event) => event.kind === 'strike'),
    false,
  );
  const strikes = [];
  for (let tick = 0; tick < 13; tick++)
    strikes.push(
      ...stepMonsterAI(brain, { ...input, playerX: 300, time: (tick + 1) * 0.1 }).events.filter(
        (event) => event.kind === 'strike',
      ),
    );
  assert.equal(strikes.length, 1);
  assert.equal(strikes[0].playerHit, false);
});

test('elite shielding, reflection and illusions produce mechanical events with bounded cadence', () => {
  const shield = createMonsterBrain(1);
  shield.affixTimer = 0;
  assert.ok(
    stepMonsterAI(shield, { ...input, elite: true, affix: 'shielding' }).events.some(
      (event) => event.kind === 'shield' && event.amount === 20 && event.duration === 3,
    ),
  );
  const illusion = createMonsterBrain(2);
  const wounded = { ...input, elite: true, affix: 'illusionist', hp: 45 };
  assert.ok(
    stepMonsterAI(illusion, wounded).events.some(
      (event) => event.kind === 'summon' && event.count === 2 && event.hpRatio === 0.25,
    ),
  );
  assert.equal(
    stepMonsterAI(illusion, wounded).events.some((event) => event.kind === 'summon'),
    false,
  );
  const reflect = createMonsterBrain(3);
  reflect.lastHp = 100;
  const struck = { ...input, elite: true, affix: 'reflect', hp: 90 };
  const reflected = stepMonsterAI(reflect, struck);
  assert.ok(
    reflected.events.some((event) => event.kind === 'telegraph' && event.source === 'reflect'),
  );
  const follow = stepMonsterAI(reflect, { ...struck, hp: 80 });
  assert.ok(
    follow.events.some(
      (event) => event.kind === 'strike' && event.source === 'reflect' && event.damage === 2,
    ),
  );
  assert.equal(
    follow.events.some((event) => event.kind === 'telegraph' && event.source === 'reflect'),
    false,
  );
});
