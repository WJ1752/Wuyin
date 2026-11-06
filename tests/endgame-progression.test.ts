import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newSave,
  newAccountSave,
  validateSave,
  useGameStore,
  applyRunResult,
  createCombatConfig,
} from '../src/state/gameStore';
import {
  skillPointBudget,
  nextSkillPointLevel,
  recommendedSkills,
  skillLearningStatus,
} from '../src/data/progression';
import { CHALLENGES, getChallengeOffer } from '../src/data/challenges';
import { SKILLS } from '../src/data/skillTrees';
import { SETS } from '../src/data/sets';
import { generateLoot } from '../src/engine/LootGenerator';
import type { RunResult } from '../src/core/types';

test('skill choices retain the opening pace and continue through level 100 without maxing every branch', () => {
  assert.equal(skillPointBudget(15), 29);
  assert.equal(skillPointBudget(99), 49);
  assert.equal(skillPointBudget(100), 50);
  assert.equal(nextSkillPointLevel(15), 20);
  assert.equal(nextSkillPointLevel(99), 100);
  assert.equal(nextSkillPointLevel(100), null);
  for (const set of SETS) {
    const save = newSave(set.classId);
    save.level = 100;
    save.progression!.targetSetId = set.id;
    save.skills = recommendedSkills(save);
    const spent = Object.values(save.skills).reduce((sum, rank) => sum + rank, 0);
    assert.ok(spent <= 50);
    assert.equal(save.skills[set.skillId], 5);
    if (set.classId === 'ranger')
      assert.ok(save.skills.night_hunt >= 1, 'resource and cooldown loop must remain learned');
    assert.ok(
      SKILLS.some((node) => node.classId === set.classId && (save.skills[node.id] ?? 0) < 5),
    );
    assert.doesNotThrow(() => validateSave(save));
    for (const node of SKILLS.filter((node) => node.classId === set.classId)) {
      const rank = save.skills[node.id] ?? 0;
      if (rank) {
        const before = { ...save, skills: { ...save.skills, [node.id]: rank - 1 } };
        assert.ok(skillLearningStatus(before, node).canLearn, `${set.id}: ${node.id}`);
      }
    }
  }
});

test('old builds migrate skill budgets once while preserving equipment and resources', () => {
  const save = newSave('barbarian');
  save.level = 100;
  delete save.progression!.skillBudgetVersion;
  save.progression!.targetSetId = 'wasteland';
  save.skills = Object.fromEntries(
    SKILLS.filter((node) => node.classId === save.classId).map((node) => [node.id, 5]),
  );
  save.equipment.weapon = generateLoot('barbarian', 100, {
    legendaryId: 'bulkathos',
    primal: true,
  });
  const restored = validateSave(save);
  assert.deepEqual(restored.equipment, JSON.parse(JSON.stringify(save.equipment)));
  assert.equal(restored.gold, save.gold);
  assert.equal(restored.skills.whirlwind, 5);
  assert.ok(Object.values(restored.skills).reduce((sum, rank) => sum + rank, 0) <= 50);
  assert.deepEqual(validateSave(restored), restored);
  assert.throws(() =>
    validateSave({ ...save, progression: { ...save.progression!, skillBudgetVersion: 2 } }),
  );
});

test('daily challenges rotate, enforce unlocks, and settle each entered run and first-win reward once', () => {
  const save = newSave();
  assert.equal(getChallengeOffer(save).available, false);
  save.progression!.clearedStage = 20;
  save.highestStage = 23;
  const days = [0, 1, 2].map(
    (offset) => getChallengeOffer(save, Date.UTC(2026, 10, 6 + offset)).id,
  );
  assert.equal(new Set(days).size, 3);
  const offer = getChallengeOffer(save);
  save.progression!.challenges = {
    claimed: [],
    best: {},
    pending: { id: offer.id, key: offer.key, stage: offer.stage },
  };
  const beforeGold = save.gold;
  const result: RunResult = {
    won: true,
    stage: offer.stage,
    seconds: 45,
    kills: 0,
    gold: 100,
    shards: 10,
    items: [],
    challenge: { id: offer.id, key: offer.key, completed: true },
  };
  applyRunResult(save, result);
  assert.equal(save.gold, beforeGold + 100 + offer.reward.gold);
  assert.equal(save.highestStage, 23);
  assert.equal(save.runRecords?.length ?? 0, 0);
  assert.deepEqual(save.progression!.challenges.claimed, [offer.key]);
  const settled = JSON.stringify(save);
  applyRunResult(save, result);
  assert.equal(JSON.stringify(save), settled);
  save.progression!.challenges.pending = { id: offer.id, key: offer.key, stage: offer.stage };
  applyRunResult(save, result);
  assert.equal(save.gold, beforeGold + 200 + offer.reward.gold);
  assert.doesNotThrow(() => validateSave(save));
  assert.throws(() =>
    validateSave({
      ...save,
      progression: { ...save.progression!, challenges: { claimed: ['2026-02-30:ward'], best: {} } },
    }),
  );
});

test('challenge entry and lab builds use the same legal progression APIs', () => {
  const save = newSave();
  save.progression!.clearedStage = 20;
  save.highestStage = 23;
  const account = newAccountSave(save);
  useGameStore.setState({
    accounts: account.accounts,
    activeAccountId: account.activeAccountId,
    save,
    inCombat: false,
    labBackup: null,
    cloudTransition: false,
  });
  const offer = getChallengeOffer(save);
  const other = CHALLENGES.find((challenge) => challenge.id !== offer.id)!;
  assert.equal(useGameStore.getState().beginChallenge(other.id), false);
  assert.equal(useGameStore.getState().beginChallenge(offer.id), true);
  const config = createCombatConfig(useGameStore.getState().save);
  assert.equal(config.challenge?.key, offer.key);
  useGameStore.getState().cancelChallenge();
  assert.equal(createCombatConfig(useGameStore.getState().save).challenge, undefined);
  useGameStore.getState().activateBuild('wasteland');
  const lab = useGameStore.getState().save;
  assert.ok(Object.values(lab.skills).reduce((sum, rank) => sum + rank, 0) <= 50);
  useGameStore.getState().leaveLab();
});
