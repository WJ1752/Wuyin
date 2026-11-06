import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/engine/GameEngine';
import { createCombatConfig, newSave, useGameStore } from '../src/state/gameStore';
import { SKILLS } from '../src/data/skillTrees';
import { MONSTERS } from '../src/data/monsters';
import type { ChallengeId, CombatConfig, RunResult } from '../src/core/types';

function lab(build: string): CombatConfig {
  useGameStore.setState({
    save: newSave(),
    labBackup: null,
    inCombat: false,
    cloudTransition: false,
  });
  useGameStore.getState().activateBuild(build);
  const config = createCombatConfig(useGameStore.getState().save);
  config.stage = 1;
  config.autoSkills = Object.fromEntries(SKILLS.map((skill) => [skill.id, false]));
  config.stats.dodge = 0;
  return config;
}

function start(config: CombatConfig) {
  let result: RunResult | undefined;
  const engine = new GameEngine();
  engine.initHeadless(config, {
    onSound() {},
    onSnapshot() {},
    onFinish(value) {
      result = value;
    },
  });
  // Fixtures control world state; damage, skills, objectives and fixed-step
  // progression always execute the production engine methods.
  const state = engine as any;
  state.enemies = [];
  state.spawnTimer = Infinity;
  return { engine, state, result: () => result };
}

function dummy(state: any, hp = 1e20, elite = false, minion = false) {
  return state.spawn(
    { ...MONSTERS[0], family: 'dummy', behavior: 'dummy', hp, attack: 0, speed: 0 },
    state.x + 60,
    state.y,
    elite,
    false,
    minion,
  );
}

test('combat reports actual life lost without overkill and preserve incoming damage sources', () => {
  const { engine, state } = start({ ...lab('stormcaller'), training: true });
  const enemy = dummy(state, 7);
  const skill = SKILLS.find((node) => node.id === 'hunting_arrow')!;
  state.hit(enemy, skill, 100, false);
  assert.equal(state.snapshot().stats.damageDealt, 7);
  assert.equal(state.snapshot().stats.damageBySkill.hunting_arrow, 7);
  state.hit(enemy, skill, 100, false);
  assert.equal(state.snapshot().stats.damageDealt, 7);
  state.hp = 23;
  state.takeDamage(1e20, '守关首领 · 重击');
  assert.equal(state.snapshot().stats.damageTaken, 23);
  assert.equal(state.snapshot().stats.damageBySource['守关首领 · 重击'], 23);
  engine.destroy();
});

test('resource-starved time requires a ready enabled core and respects free casting', () => {
  const config = lab('marauder');
  config.stats.resourceRegen = 0;
  config.autoSkills.rapid_fire = true;
  const { engine, state } = start({ ...config, training: true });
  dummy(state);
  state.resource = 0;
  for (let frame = 0; frame < 15; frame++) engine.stepHeadless();
  const starved = state.snapshot().stats.resourceStarvedSeconds;
  assert.ok(Math.abs(starved - 0.5) < 1e-6);
  state.buffs.add('channeling', '引导圣坛', 10);
  for (let frame = 0; frame < 15; frame++) engine.stepHeadless();
  assert.equal(state.snapshot().stats.resourceStarvedSeconds, starved);
  assert.ok(state.snapshot().stats.casts > 0);
  engine.destroy();
});

test('pursuit counts elite leaders and gates the guardian until three are defeated', () => {
  const config = lab('stormcaller');
  config.challenge = { id: 'pursuit', key: '2026-11-06:pursuit' };
  const { engine, state, result } = start(config);
  state.progress = 100;
  engine.stepHeadless();
  assert.equal(state.bossSpawned, false);
  for (const [elite, minion] of [
    [false, false],
    [true, true],
    [true, false],
    [true, false],
  ]) {
    const enemy = dummy(state, 1, elite, minion);
    state.hit(enemy, SKILLS[0], 100, false);
  }
  assert.equal(state.snapshot().objective.progress, 2);
  engine.stepHeadless();
  assert.equal(state.bossSpawned, false);
  state.hit(dummy(state, 1, true), SKILLS[0], 100, false);
  engine.stepHeadless();
  assert.equal(state.bossSpawned, true);
  const boss = state.enemies.find((enemy: any) => enemy.boss);
  state.hit(boss, SKILLS[0], 1e20, false);
  assert.equal(result()?.challenge?.completed, true);
  engine.destroy();
});

test('ward requires eighteen living seconds inside the circle and hazards require six resolved waves', () => {
  for (const id of ['ward', 'hazards'] as ChallengeId[]) {
    const config = lab('stormcaller');
    config.challenge = { id, key: `2026-11-06:${id}` };
    const { engine, state } = start(config);
    state.progress = 100;
    if (id === 'ward') {
      state.x = 200;
      for (let frame = 0; frame < 90; frame++) engine.stepHeadless();
      assert.equal(state.snapshot().objective.progress, 0);
      state.x = 0;
      for (let frame = 0; frame < 530; frame++) engine.stepHeadless();
      assert.equal(state.bossSpawned, false);
      for (let frame = 0; frame < 12; frame++) engine.stepHeadless();
      assert.equal(state.snapshot().objective.progress, 18);
    } else {
      for (let frame = 0; frame < 24 * 30; frame++) engine.stepHeadless();
      assert.equal(state.snapshot().objective.progress, 5);
      assert.equal(state.bossSpawned, false);
      for (let frame = 0; frame < 3 * 30; frame++) engine.stepHeadless();
      assert.equal(state.snapshot().objective.progress, 6);
    }
    assert.equal(state.bossSpawned, true);
    engine.destroy();
  }
});

test('manual charge gives whirlwind four tracking tornadoes for a bounded window', () => {
  const { engine, state } = start({ ...lab('wasteland'), training: true });
  const skill = SKILLS.find((node) => node.id === 'whirlwind')!;
  const target = dummy(state);
  const release = () => {
    state.zones = [];
    state.projectiles.items = [];
    target.x = state.x + 300;
    target.y = state.y;
    state.makeZone(state.x, state.y, 100, 6, skill);
    state.updateZones(1.01);
    return state.projectiles.items.filter((projectile: any) => projectile.skillId === 'whirlwind');
  };
  assert.equal(release().filter((projectile: any) => projectile.homing).length, 1);
  state.cast('charge');
  assert.equal(release().filter((projectile: any) => projectile.homing).length, 4);
  state.elapsed = state.chargeWindow + 0.01;
  assert.equal(release().filter((projectile: any) => projectile.homing).length, 1);
  engine.destroy();
});

test('manual blood step gives poison scythe an extra stack only during its four-second window', () => {
  const { engine, state } = start({ ...lab('trang_oul'), training: true });
  const enemy = dummy(state);
  const scythe = SKILLS.find((node) => node.id === 'death_scythe')!;
  const stacks = () => {
    enemy.poison = 0;
    enemy.poisonStacks = 0;
    state.hit(enemy, scythe, 1, false);
    return enemy.poisonStacks;
  };
  assert.equal(stacks(), 1);
  state.cast('blood_step');
  assert.equal(stacks(), 2);
  state.elapsed = state.bloodWindow + 0.01;
  assert.equal(stacks(), 1);
  engine.destroy();
});
