import assert from 'node:assert/strict';
import test from 'node:test';
import type { Stats } from '../src/core/types';
import { SLOTS } from '../src/core/types';
import { CLASSES, SKILLS, LEGENDARIES, SETS, AFFIXES } from '../src/data/index';
import { calculateDamage, formatBigNumber, mitigateDamage } from '../src/engine/CombatSystem';
import { selectAutoCast } from '../src/engine/AutoCastAI';
import { generateLoot } from '../src/engine/LootGenerator';
import { newSave, validateSave } from '../src/state/gameStore';
import { runRift } from './helpers/combatHarness';

const stats: Stats = {
  hp: 1000,
  attack: 100,
  armor: 0,
  mainStat: 100,
  critChance: 0.1,
  critDamage: 1.5,
  attackSpeed: 1,
  moveSpeed: 220,
  cooldown: 0,
  elementDamage: 0.25,
  eliteDamage: 0.4,
  regen: 0,
  resourceRegen: 8,
  areaDamage: 0,
  damageReduction: 0,
  dodge: 0,
  pickupRadius: 85,
  lifeOnHit: 0,
  thorns: 0,
  penetration: 0,
  bonusDamage: 0.5,
  independent: [0.2],
  maxResource: 100,
  luck: 0,
};

test('all five newly created characters can reach and defeat the first guardian in starter gear', () => {
  for (const hero of CLASSES) {
    const result = runRift(newSave(hero.id), 1);
    assert.ok(result.won, `${hero.name} failed after ${result.seconds}s and ${result.kills} kills`);
  }
});

test('damage multiplies each distinct damage bucket and only enables conditional buckets when applicable', () => {
  assert.equal(
    calculateDamage({ stats, multiplier: 2, elite: true, crit: true, independent: [0.5, 2] }),
    14175,
  );
  assert.equal(calculateDamage({ stats, multiplier: 2 }), 900);
  assert.equal(calculateDamage({ stats, multiplier: 2, armor: 100 }), 450);
  assert.equal(
    calculateDamage({ stats: { ...stats, penetration: 0.5 }, multiplier: 2, armor: 100 }),
    600,
  );
  assert.equal(calculateDamage({ stats, multiplier: 2, vulnerability: 0.5 }), 1350);
});

test('defense and large-number labels preserve the documented thresholds', () => {
  assert.equal(mitigateDamage(100, { ...stats, armor: 0, damageReduction: 0.4 }), 60);
  assert.ok(mitigateDamage(100, { ...stats, armor: 200 }) < 100);
  assert.equal(formatBigNumber(9999), '9999');
  assert.equal(formatBigNumber(10000), '1.0万');
  assert.equal(formatBigNumber(100000000), '1.00亿');
  assert.equal(formatBigNumber(1e12), '1.00兆');
  assert.equal(formatBigNumber(1e16), '1.00京');
});

test('auto-cast prioritizes survival, burst, control, core and basic resource generation', () => {
  const skills = SKILLS.filter(
    (skill) => skill.classId === 'barbarian' && !skill.parent && skill.kind !== 'passive',
  );
  const base = {
    hpRatio: 0.5,
    nearby: 4,
    enemies: 6,
    elite: true,
    resource: 100,
    free: false,
    cooldowns: {},
    auto: {},
  };
  assert.equal(selectAutoCast(skills, base)?.id, 'war_cry');
  assert.equal(selectAutoCast(skills, { ...base, hpRatio: 1, nearby: 1 })?.id, 'berserker');
  assert.equal(
    selectAutoCast(skills, { ...base, hpRatio: 1, nearby: 1, elite: false, enemies: 2 })?.id,
    'iron_hook',
  );
  const resourceSkills = skills.filter((skill) => skill.kind === 'basic' || skill.kind === 'core');
  assert.equal(selectAutoCast(resourceSkills, { ...base, hpRatio: 1, nearby: 1 })?.id, 'whirlwind');
  assert.equal(selectAutoCast(resourceSkills, { ...base, resource: 0 })?.id, 'frenzy');
  assert.equal(
    selectAutoCast(resourceSkills, { ...base, resource: 0, free: true })?.id,
    'whirlwind',
  );
});

test('manual skill settings and cooldowns prevent unwanted auto-casts', () => {
  const charge = SKILLS.find((skill) => skill.id === 'charge')!;
  const state = {
    hpRatio: 0.2,
    nearby: 3,
    enemies: 5,
    elite: true,
    resource: 100,
    free: false,
    cooldowns: {},
    auto: {},
  };
  assert.equal(selectAutoCast([charge], state), undefined);
  assert.equal(selectAutoCast([charge], { ...state, auto: { charge: true } })?.id, 'charge');
  assert.equal(
    selectAutoCast([charge], { ...state, auto: { charge: true }, cooldowns: { charge: 2 } }),
    undefined,
  );
  const hammer = SKILLS.find((skill) => skill.id === 'ancestor_hammer')!;
  assert.equal(selectAutoCast([hammer], { ...state, auto: { ancestor_hammer: false } }), undefined);
});

test('auto-cast uses the actual reduced skill cost while preserving resource limits', () => {
  const meteor = SKILLS.find((skill) => skill.id === 'meteor')!;
  const state = {
    hpRatio: 1,
    nearby: 1,
    enemies: 1,
    elite: true,
    resource: meteor.cost / 2,
    free: false,
    cooldowns: {},
    auto: {},
  };
  assert.equal(selectAutoCast([meteor], state), undefined);
  assert.equal(
    selectAutoCast([meteor], { ...state, costs: { meteor: meteor.cost / 2 } })?.id,
    'meteor',
  );
  assert.equal(
    selectAutoCast([meteor], { ...state, costs: { meteor: meteor.cost / 2 }, resource: 0 }),
    undefined,
  );
});

test('all legendary primal items retain their identity, max power and 130% affixes through save validation', () => {
  const save = newSave();
  for (const legendary of LEGENDARIES) {
    const item = generateLoot(legendary.classId ?? 'ranger', 100, {
      legendaryId: legendary.id,
      slot: legendary.slot,
      primal: true,
      rng: () => 0.999,
    });
    assert.equal(item.legendaryId, legendary.id);
    assert.equal(item.slot, legendary.slot);
    assert.equal(item.rarity, 'primal');
    assert.equal(item.power, legendary.max);
    assert.equal(item.affixes.length, 4);
    assert.equal(new Set(item.affixes.map((affix) => affix.id)).size, 4);
    for (const affix of item.affixes)
      assert.equal(affix.value, AFFIXES.find((def) => def.id === affix.id)!.max * 1.3);
    save.inventory.push(item);
  }
  assert.equal(validateSave(save).inventory.length, 45);
});

test('requested gambling slots are honored and set duplicate protection chooses a missing part', () => {
  for (const character of CLASSES) {
    for (const slot of SLOTS) {
      const item = generateLoot(character.id, 5, { slot, gambling: true, rng: () => 0.1 });
      assert.equal(item.slot, slot);
      if (item.setId)
        assert.equal(SETS.find((set) => set.id === item.setId)!.classId, character.id);
      if (item.legendaryId) {
        const legendary = LEGENDARIES.find((def) => def.id === item.legendaryId)!;
        assert.ok(!legendary.classId || legendary.classId === character.id);
      }
    }
  }
  const item = generateLoot('ranger', 10, {
    setId: 'stormcaller',
    ownedSetPieces: ['head', 'chest', 'hands', 'legs'].map((slot) => `stormcaller:${slot}`),
    rng: () => 0.999,
  });
  assert.equal(item.slot, 'feet');
  assert.equal(item.setId, 'stormcaller');
});
