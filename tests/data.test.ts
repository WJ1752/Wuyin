import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CLASSES,
  SKILLS,
  SETS,
  LEGENDARIES,
  AFFIXES,
  GEMS,
  GEM_LEVEL_NAMES,
  PETS,
  MONSTERS,
  BOSSES,
  ELITE_AFFIXES,
  STAGES,
  THEMES,
  PYLONS,
  PRIMAL_RULES,
  RIFT_RULES,
} from '../src/data/index';
import { SLOTS } from '../src/core/types';

test('content catalog contains the required complete, uniquely identified roster', () => {
  const catalogs = [
    [CLASSES, 5],
    [SKILLS, 75],
    [SETS, 15],
    [LEGENDARIES, 45],
    [GEMS, 5],
    [PETS, 6],
    [MONSTERS, 24],
    [BOSSES, 8],
    [ELITE_AFFIXES, 10],
    [PYLONS, 4],
  ] as const;
  for (const [catalog, count] of catalogs) {
    assert.equal(catalog.length, count);
    assert.equal(new Set(catalog.map((entry) => entry.id)).size, count);
    for (const entry of catalog) assert.ok(entry.name.trim());
  }
  assert.equal(GEM_LEVEL_NAMES.length, 10);
  assert.equal(THEMES.length, 4);
  assert.equal(new Set(MONSTERS.map((monster) => monster.family)).size, 24);
  assert.equal(new Set(AFFIXES.map((affix) => affix.id)).size, AFFIXES.length);
});

test('every class has five tiers, valid parent branches, three builds and seven signature legendaries', () => {
  for (const character of CLASSES) {
    const skills = SKILLS.filter((skill) => skill.classId === character.id);
    assert.equal(skills.length, 15);
    assert.deepEqual([...new Set(skills.map((skill) => skill.tier))].sort(), [1, 2, 3, 4, 5]);
    assert.equal(skills.filter((skill) => skill.kind !== 'passive').length, 8);
    assert.equal(skills.filter((skill) => skill.kind === 'ultimate').length, 1);
    assert.equal(skills.filter((skill) => skill.tier === 5).length, 3);
    assert.equal(SETS.filter((set) => set.classId === character.id).length, 3);
    assert.equal(LEGENDARIES.filter((item) => item.classId === character.id).length, 7);
    for (const skill of skills) {
      assert.ok(skill.description.length > 12);
      assert.ok(skill.effect);
      assert.ok(
        [skill.multiplier, skill.cost, skill.cooldown, skill.duration, skill.radius].every(
          (value) => Number.isFinite(value) && value >= 0,
        ),
      );
      if (skill.parent) {
        const parent = skills.find((candidate) => candidate.id === skill.parent);
        assert.ok(parent, `${skill.id} references a missing or cross-class parent`);
        assert.equal(skill.kind, 'passive');
        assert.notEqual(parent.kind, 'passive');
        assert.ok(parent.tier <= skill.tier);
      }
    }
  }
  assert.equal(LEGENDARIES.filter((item) => !item.classId).length, 10);
});

test('builds reference own-class skills and use independent bonus ratios', () => {
  const bonuses = [6.5, 9, 7.2, 7.5, 9.6, 3, 0.8, 7, 9, 8.5, 7.8, 2, 2, 7.6, 7.2];
  SETS.forEach((set, index) => {
    assert.equal(SKILLS.find((skill) => skill.id === set.skillId)?.classId, set.classId);
    assert.equal(set.effect, set.id);
    assert.equal(set.multiplier, bonuses[index]);
    assert.ok(set.two.length > 10 && set.four.length > 10 && set.lore.length > 10);
  });
  assert.equal(1 + SETS.find((set) => set.id === 'stormcaller')!.multiplier, 7.5);
});

test('legendary rolls, affixes and gems have bounded numeric definitions', () => {
  for (const item of LEGENDARIES) {
    assert.ok(SLOTS.includes(item.slot));
    assert.ok(item.min > 0 && item.max >= item.min);
    assert.equal(item.effect, item.id);
    assert.ok(item.description.length > 12 && item.lore.length > 12);
    if (item.classId) assert.ok(CLASSES.some((character) => character.id === item.classId));
  }
  for (const affix of AFFIXES) {
    assert.ok(affix.min > 0 && affix.max >= affix.min && affix.weight > 0);
    if (affix.unit === '%') assert.ok(affix.max < 1, `${affix.id} must store fractional ratios`);
  }
  for (const gem of GEMS) {
    assert.ok(AFFIXES.some((affix) => affix.id === gem.stat));
    assert.ok(gem.value > 0 && gem.value < 1);
  }
  assert.equal(PRIMAL_RULES.affixMultiplier, 1.3);
  assert.equal(PRIMAL_RULES.baseChance, 0.08);
  assert.equal(PRIMAL_RULES.maxChance, 0.15);
  assert.equal(PRIMAL_RULES.legendaryPowerAtMax, true);
});

test('150 stages increase smoothly and cover all difficulty bands', () => {
  assert.equal(STAGES.length, 150);
  assert.equal(STAGES[0].hpMultiplier, 1);
  STAGES.forEach((stage, index) => {
    assert.equal(stage.level, index + 1);
    assert.ok(stage.theme >= 0 && stage.theme < THEMES.length);
    assert.ok([stage.hpMultiplier, stage.damageMultiplier, stage.reward].every(Number.isFinite));
    if (index) {
      assert.ok(stage.hpMultiplier > STAGES[index - 1].hpMultiplier);
      assert.ok(stage.damageMultiplier > STAGES[index - 1].damageMultiplier);
      assert.ok(stage.reward > STAGES[index - 1].reward);
      const growth = stage.hpMultiplier / STAGES[index - 1].hpMultiplier;
      assert.ok(growth >= 1.08 - 1e-10 && growth <= 1.16 + 1e-10);
      if (index > 1)
        assert.ok(
          growth + 1e-10 >= STAGES[index - 1].hpMultiplier / STAGES[index - 2].hpMultiplier,
        );
    }
  });
  assert.equal(STAGES[14].difficulty, '普通');
  assert.equal(STAGES[15].difficulty, '困难');
  assert.equal(STAGES[30].difficulty, '大师');
  assert.equal(STAGES[50].difficulty, '折磨 I');
  assert.equal(STAGES[149].difficulty, '折磨 XVI');
  assert.equal(RIFT_RULES.timeLimit, 300);
  assert.equal(RIFT_RULES.eliteOrbs * RIFT_RULES.orbProgress, 36);
});
