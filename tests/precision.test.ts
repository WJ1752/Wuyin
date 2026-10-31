import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateExactDamage, calculateDamage } from '../src/engine/CombatSystem';
import { computeStats, newSave } from '../src/state/gameStore';

test('very large damage multiplies decimal ratios once using BigInt', () => {
  const stats = {
    ...computeStats(newSave()),
    attack: 10000000000000000,
    mainStat: 0,
    bonusDamage: 0,
    elementDamage: 0,
    independent: [0.25, 0.5],
  };
  const input = { stats, multiplier: 1.1 };
  assert.equal(calculateExactDamage(input), 20625000000000000n);
  assert.equal(calculateDamage(input), Number(20625000000000000n));
});
