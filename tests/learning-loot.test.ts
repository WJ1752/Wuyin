import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSES } from '../src/data/classes';
import { SKILLS } from '../src/data/skillTrees';
import { STAGES } from '../src/data/stages';
import { createRng } from '../src/core/random';
import {
  getLootProfile,
  RARITY_UNLOCK_STAGE,
  skillLearningStatus,
  type LootSource,
} from '../src/data/progression';
import { generateLoot } from '../src/engine/LootGenerator';
import { newSave, skillPoints, useGameStore, validateSave } from '../src/state/gameStore';
import type { RunResult } from '../src/core/types';

const clear = (stage: number): RunResult => ({
  won: true,
  stage,
  seconds: 120,
  kills: 0,
  gold: 0,
  shards: 0,
  items: [],
});

test('all reward sources respect rarity chapter gates and interpolate normalized probabilities', () => {
  const rng = createRng('chapter-loot');
  for (const source of ['world', 'boss', 'goblin', 'gamble'] as LootSource[]) {
    for (let stage = 1; stage <= 150; stage++) {
      const profile = getLootProfile(stage, source);
      assert.ok(Math.abs(Object.values(profile.chances).reduce((a, b) => a + b) - 1) < 1e-10);
      for (const [rarity, unlock] of Object.entries(RARITY_UNLOCK_STAGE))
        if (stage < unlock)
          assert.equal(profile.chances[rarity as keyof typeof profile.chances], 0);
      for (let sample = 0; sample < 8; sample++) {
        const item = generateLoot(CLASSES[sample % CLASSES.length].id, stage, { source, rng });
        assert.ok(stage >= RARITY_UNLOCK_STAGE[item.rarity], `${source}/${stage}: ${item.rarity}`);
      }
    }
  }
  assert.ok(getLootProfile(30).chances.legendary > getLootProfile(16).chances.legendary);
  assert.ok(getLootProfile(50).chances.set > getLootProfile(31).chances.set);
  assert.ok(getLootProfile(150).chances.primal > getLootProfile(71).chances.primal);
  assert.ok(STAGES[30].hpMultiplier < 30);
  assert.ok(STAGES[44].hpMultiplier < 100);
  assert.ok(STAGES.every((stage, i) => i === 0 || stage.hpMultiplier > STAGES[i - 1].hpMultiplier));
});

test('learning starts with one attack, gates ranks and parent branches, and refunds on reset', () => {
  useGameStore.setState({ save: newSave(), labBackup: null });
  assert.deepEqual(useGameStore.getState().save.skills, { hunting_arrow: 1 });
  assert.equal(skillPoints(useGameStore.getState().save), 0);
  useGameStore.getState().allocateSkill('arrow_rain');
  assert.equal(useGameStore.getState().save.skills.arrow_rain, undefined);
  const save = { ...useGameStore.getState().save, level: 5 };
  useGameStore.setState({ save });
  const movement = SKILLS.find((node) => node.classId === 'ranger' && node.kind === 'movement')!;
  useGameStore.getState().allocateSkill(movement.id);
  const legacy = useGameStore.getState().save;
  delete legacy.autoSkills[movement.id];
  useGameStore.setState({ save: validateSave(legacy) });
  useGameStore.getState().toggleAuto(movement.id);
  assert.equal(useGameStore.getState().save.autoSkills[movement.id], true);
  const branch = SKILLS.find((node) => node.id === 'split_arrow')!;
  assert.match(skillLearningStatus(save, branch).reason, /前置/);
  useGameStore.getState().allocateSkill('hunting_arrow');
  useGameStore.getState().allocateSkill('split_arrow');
  assert.equal(useGameStore.getState().save.skills.split_arrow, 1);
  useGameStore.getState().allocateSkill('hunting_arrow');
  assert.equal(useGameStore.getState().save.skills.hunting_arrow, 2);
  useGameStore.getState().toggleAuto('hunting_arrow');
  useGameStore.getState().resetSkills();
  assert.equal(skillPoints(useGameStore.getState().save), 8);
  assert.deepEqual(useGameStore.getState().save.skills, { hunting_arrow: 1 });
  assert.equal(useGameStore.getState().save.autoSkills.hunting_arrow, true);
  useGameStore.getState().selectClass('sorcerer');
  assert.equal(Object.keys(useGameStore.getState().save.skills).length, 1);
  assert.equal(useGameStore.getState().save.classId, 'sorcerer');
  assert.equal(useGameStore.getState().save.level, 1);
  useGameStore.getState().selectClass('ranger');
  assert.equal(useGameStore.getState().save.level, 5);
});

test('chapter set gifts also avoid pieces picked up during the same rift', () => {
  const save = newSave();
  save.level = 20;
  save.highestStage = 31;
  save.progression!.claimedMilestones = ['ranger:4', 'ranger:8', 'ranger:16'];
  useGameStore.setState({ save, labBackup: null });
  const drop = generateLoot('ranger', 31, { setId: 'stormcaller', slot: 'head' });
  useGameStore.getState().completeRun({ ...clear(31), items: [drop] });
  const parts = useGameStore
    .getState()
    .save.inventory.filter((item) => item.setId === 'stormcaller');
  assert.equal(parts.length, 2);
  assert.equal(new Set(parts.map((item) => item.slot)).size, 2);
});

test('legacy saves preserve gear and currency while migrating automatic skills to a legal learning path', () => {
  const old = newSave();
  delete old.progression;
  old.skills = Object.fromEntries(
    SKILLS.filter((node) => node.classId === old.classId).map((node) => [node.id, 5]),
  );
  old.equipment.weapon = generateLoot('ranger', 100, { legendaryId: 'dawn', primal: true });
  const migrated = validateSave(old);
  assert.deepEqual(migrated.skills, { hunting_arrow: 1 });
  assert.deepEqual(migrated.equipment, JSON.parse(JSON.stringify(old.equipment)));
  assert.equal(migrated.gold, old.gold);
  assert.deepEqual(validateSave(migrated), migrated);
  assert.throws(() => validateSave({ ...migrated, skills: old.skills }), /技能分配/);
});

test('chapter gifts are once per class, skip duplicates and celebrate two/four equipped pieces', () => {
  const save = newSave();
  save.level = 20;
  save.highestStage = 45;
  save.autoSalvage = true;
  useGameStore.setState({ save, labBackup: null });
  useGameStore.getState().selectProgressionSet('marauder');
  for (const stage of [4, 8, 16, 31, 35, 40, 45]) useGameStore.getState().completeRun(clear(stage));
  const inventory = useGameStore.getState().save.inventory;
  assert.equal(inventory.length, 7);
  assert.equal(inventory.find((item) => item.rarity === 'legendary')?.legendaryId, 'yang');
  const parts = inventory.filter((item) => item.setId === 'marauder');
  assert.equal(parts.length, 4);
  assert.equal(new Set(parts.map((item) => item.slot)).size, 4);
  for (const [i, item] of parts.entries()) {
    useGameStore.getState().equip(item.id);
    if (i === 1) assert.match(useGameStore.getState().notice, /双件共鸣/);
    if (i === 3) assert.match(useGameStore.getState().notice, /四件成型/);
  }
  useGameStore.getState().completeRun(clear(45));
  assert.equal(useGameStore.getState().save.inventory.length, 3);
  assert.equal(useGameStore.getState().save.progression!.claimedMilestones.length, 7);
});

test('gambling uses cleared difficulty instead of level or unlocked stage and pending gifts survive a full bag', () => {
  const save = newSave();
  save.level = 100;
  save.highestStage = 150;
  save.shards = 500;
  useGameStore.setState({ save, labBackup: null });
  useGameStore.getState().gamble('head', 10);
  assert.ok(
    useGameStore
      .getState()
      .lastGamble.every((item) => ['common', 'uncommon'].includes(item.rarity)),
  );
  const full = useGameStore.getState().save;
  full.inventory = Array.from({ length: 240 }, () => generateLoot('ranger', 1));
  useGameStore.setState({ save: full });
  useGameStore.getState().completeRun(clear(4));
  assert.equal(useGameStore.getState().save.progression!.claimedMilestones.length, 0);
  useGameStore.getState().salvage(useGameStore.getState().save.inventory[0].id);
  const clears = useGameStore.getState().save.clears;
  useGameStore.getState().claimJourneyRewards();
  useGameStore.getState().claimJourneyRewards();
  assert.equal(useGameStore.getState().save.clears, clears);
  assert.equal(useGameStore.getState().save.inventory.length, 240);
  assert.deepEqual(useGameStore.getState().save.progression!.claimedMilestones, ['ranger:4']);
});
