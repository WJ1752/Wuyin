import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../src/data/classes';
import { LEGENDARIES } from '../src/data/legendaries';
import { SETS } from '../src/data/sets';
import { createRng } from '../src/core/random';
import { SLOTS, type Item, type Rarity } from '../src/core/types';
import { getLootProfile, RARITY_UNLOCK_STAGE, type LootSource } from '../src/data/progression';
import { generateLoot } from '../src/engine/LootGenerator';

const itemClass = (item: Item) =>
  SETS.find((set) => set.id === item.setId)?.classId ??
  LEGENDARIES.find((legendary) => legendary.id === item.legendaryId)?.classId;

test('all reward curves introduce new tiers gently and improve without probability cliffs', () => {
  const rarities = Object.keys(RARITY_UNLOCK_STAGE) as Rarity[];
  for (const source of ['world', 'boss', 'goblin', 'gamble'] as LootSource[]) {
    for (let stage = 2; stage <= 150; stage++) {
      const previous = getLootProfile(stage - 1, source).chances;
      const current = getLootProfile(stage, source).chances;
      for (const [index, rarity] of rarities.entries()) {
        assert.ok(
          Math.abs(current[rarity] - previous[rarity]) < 0.07,
          `${source}/${stage}/${rarity}: probability cliff`,
        );
        const tail = rarities.slice(index);
        assert.ok(
          tail.reduce((sum, tier) => sum + current[tier] - previous[tier], 0) >= -1e-10,
          `${source}/${stage}/${rarity}: progression regressed`,
        );
        if (stage === RARITY_UNLOCK_STAGE[rarity]) {
          assert.equal(previous[rarity], 0);
          assert.ok(current[rarity] > 0 && current[rarity] <= 0.03);
        }
      }
    }
  }
});

test('seeded natural drops favor the current class while supporting all four alternate classes', () => {
  for (const hero of CLASSES) {
    const rng = createRng(`smart-loot:${hero.id}`);
    const counts = Object.fromEntries(CLASSES.map((entry) => [entry.id, 0]));
    const rarities = Object.fromEntries(
      Object.keys(RARITY_UNLOCK_STAGE).map((entry) => [entry, 0]),
    );
    let universalLegendaries = 0;
    for (let sample = 0; sample < 8000; sample++) {
      const item = generateLoot(hero.id, 100, { rng });
      const owner = itemClass(item);
      if (owner) counts[owner]++;
      else if (item.legendaryId) universalLegendaries++;
      rarities[item.rarity]++;
    }
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    assert.ok(universalLegendaries > 500, 'universal relic pool remains available');
    for (const entry of CLASSES) {
      const share = counts[entry.id] / total;
      assert.ok(
        entry.id === hero.id ? share > 0.76 && share < 0.84 : share > 0.025 && share < 0.075,
        `${hero.id} -> ${entry.id}: ${share}`,
      );
    }
    const profile = getLootProfile(100).chances;
    for (const rarity of Object.keys(profile) as Rarity[])
      assert.ok(
        Math.abs(rarities[rarity] / 8000 - profile[rarity]) < 0.025,
        `${hero.id}/${rarity}: output diverged from advertised probability`,
      );
  }
});

test('bosses and goblins share smart loot while gambling and named rewards remain targeted', () => {
  for (const source of ['boss', 'goblin'] as LootSource[]) {
    const rng = createRng(`smart-loot:${source}`);
    let foreign = 0;
    for (let sample = 0; sample < 2000; sample++) {
      const item = generateLoot('ranger', 100, { source, rarity: 'set', rng });
      if (itemClass(item) !== 'ranger') foreign++;
    }
    assert.ok(foreign > 330 && foreign < 470);
  }
  const rng = createRng('targeted-loot');
  for (const hero of CLASSES) {
    for (const slot of SLOTS) {
      for (let sample = 0; sample < 50; sample++) {
        const item = generateLoot(hero.id, 100, { slot, source: 'gamble', rng });
        assert.equal(item.slot, slot);
        assert.ok(!itemClass(item) || itemClass(item) === hero.id);
      }
    }
    const target = SETS.find((set) => set.classId === hero.id)!;
    const set = generateLoot(hero.id, 31, {
      setId: target.id,
      ownedSetPieces: ['head', 'chest', 'hands', 'legs'].map((slot) => `${target.id}:${slot}`),
      rng: () => 0.99,
    });
    assert.equal(set.setId, target.id);
    assert.equal(set.slot, 'feet');
    const relic = LEGENDARIES.find((legendary) => legendary.classId === hero.id)!;
    assert.equal(
      generateLoot(hero.id, 71, { legendaryId: relic.id, primal: true, rng: () => 0.99 })
        .legendaryId,
      relic.id,
    );
  }
});
