import assert from 'node:assert/strict';
import test from 'node:test';
import { SKILLS } from '../src/data/skillTrees';
import { SETS } from '../src/data/sets';
import { MONSTERS } from '../src/data/monsters';
import { selectAutoCast } from '../src/engine/AutoCastAI';
import { buildHarness, measureBuild } from './helpers/combatHarness';

test('all fifteen four-piece builds gain meaningful sustained damage with identical item stats', () => {
  const damage: number[] = [];
  for (const set of SETS) {
    const two = measureBuild(set.id, 2, 1);
    const four = measureBuild(set.id, 4, 1);
    damage.push(four.dps);
    assert.ok(
      Number.isFinite(four.dps) && four.dps > two.dps * 1.5,
      `${set.name}: ${two.dps} → ${four.dps}`,
    );
    assert.ok(four.casts > 10 && four.resource >= 0, `${set.name} must keep casting legally`);
  }
  assert.ok(
    Math.max(...damage) / Math.min(...damage) < 16,
    'Single-target build spread exceeded its calibrated budget',
  );
});

test('archon stacks only come from beams, cap at sixty and reset on the next transformation', () => {
  const { engine } = buildHarness('vyr');
  const target = engine.spawn({ ...MONSTERS[0], hp: 1e12 }, 60, 0, false, true);
  engine.buffs.add('archon', '执政官', 15);
  engine.hit(
    target,
    SKILLS.find((skill) => skill.id === 'meteor'),
  );
  assert.equal(engine.laserStacks, 0);
  for (let i = 0; i < 30; i++)
    engine.perform(
      SKILLS.find((skill) => skill.id === 'electrocute'),
      true,
    );
  assert.equal(engine.laserStacks, 60);
  engine.perform(
    SKILLS.find((skill) => skill.id === 'archon'),
    true,
  );
  assert.equal(engine.laserStacks, 0);
});

test('build focus selects beam or thorns skills while respecting manual mode and cooldowns', () => {
  const state = {
    hpRatio: 1,
    nearby: 1,
    enemies: 1,
    elite: true,
    resource: 200,
    free: false,
    cooldowns: {},
    auto: {},
    focus: 'war_cry',
  };
  const skills = SKILLS.filter((skill) => ['frenzy', 'whirlwind', 'war_cry'].includes(skill.id));
  assert.equal(selectAutoCast(skills, state)?.id, 'war_cry');
  assert.equal(selectAutoCast(skills, { ...state, auto: { war_cry: false } })?.id, 'whirlwind');
  assert.equal(selectAutoCast(skills, { ...state, cooldowns: { war_cry: 2 } })?.id, 'whirlwind');
});

test('four-piece war cry detonates one physical thorns hit per enemy without triggering itself', () => {
  const { engine } = buildHarness('immortal_thorns');
  engine.spawn({ ...MONSTERS[0], hp: 1e12 }, 60, 0, false, true);
  const hits: any[] = [];
  const hit = engine.hit.bind(engine);
  engine.hit = (enemy: any, skill: any, ...args: any[]) => {
    hits.push(skill);
    return hit(enemy, skill, ...args);
  };
  engine.perform(
    SKILLS.find((skill) => skill.id === 'war_cry'),
    true,
  );
  assert.equal(hits.length, 1);
  assert.equal(hits[0].effect, 'thorns');
  assert.equal(hits[0].element, 'physical');
  assert.equal(hits[0].kind, 'passive');
});

test('meteor fire ground distributes its damage budget over its lifetime', () => {
  const { engine } = buildHarness('tal_rasha');
  let budget = 0;
  engine.area = (_x: number, _y: number, _r: number, _skill: any, multiplier: number) => {
    budget += multiplier;
  };
  engine.makeZone(
    0,
    0,
    100,
    3,
    SKILLS.find((skill) => skill.id === 'meteor'),
  );
  for (let frame = 0; frame < 91; frame++) engine.updateZones(1 / 30);
  assert.ok(budget >= 0.9 && budget <= 1.1, `Ground dealt ${budget} impact budgets`);
});
