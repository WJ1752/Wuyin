import assert from 'node:assert/strict';
import test from 'node:test';
import type { ClassId } from '../src/core/types';
import { SKILLS } from '../src/data/skillTrees';
import { GameEngine } from '../src/engine/GameEngine';
import { BuffManager } from '../src/engine/BuffAndPylon';
import { computeStats, newSave } from '../src/state/gameStore';

const skill = (id: string) => SKILLS.find((entry) => entry.id === id)!;
const noop = () => {};

test('settlement keeps an immutable loot list when frame-end pickups continue', () => {
  let result: { items: unknown[] } | undefined;
  const earned = [{ id: 'boss-loot' }];
  const engine = Object.assign(Object.create(GameEngine.prototype), {
    config: { stage: 1, training: false },
    finished: false,
    elapsed: 20,
    kills: 4,
    gold: 0,
    shards: 0,
    earned,
    emit: noop,
    callbacks: {
      onSound: noop,
      onFinish: (value: typeof result) => {
        result = value;
      },
    },
  });
  engine.finish(true);
  earned.push({ id: 'late-pickup' });
  assert.deepEqual(result?.items, [{ id: 'boss-loot' }]);
});

// Exercise the actual combat methods without a browser, renderer, ticker or assets.
function engineFor(classId: ClassId) {
  const save = newSave();
  save.classId = classId;
  const stats = { ...computeStats(save), attackSpeed: 1, critChance: 0, lifeOnHit: 0 };
  const projectiles: { id: string; options: Record<string, any> }[] = [];
  const hits: { damage: number; crit: boolean }[] = [];
  const zones: any[][] = [];
  const engine = Object.assign(Object.create(GameEngine.prototype), {
    config: {
      ...save,
      stats,
      stage: 1,
      training: true,
      petId: 'fox',
      skills: Object.fromEntries(SKILLS.filter((s) => s.classId === classId).map((s) => [s.id, 1])),
    },
    buffs: new BuffManager(),
    powers: new Map(),
    setCounts: new Map(),
    enemies: [],
    cooldowns: {},
    x: 0,
    y: 0,
    hp: stats.hp / 2,
    resource: 0,
    shield: 0,
    shieldTime: 0,
    elapsed: 0,
    attackStacks: 0,
    attackCount: 0,
    shadowCharges: 0,
    facing: 1,
    moving: false,
    movement: { x: 0, y: 0 },
    movementDirection: { x: 0, y: 0 },
    keys: new Set(),
    summons: [],
    summonStates: new Map(),
    enemyWarnings: new Map(),
    warningAnimations: new Map(),
    lastDamage: -10,
    random: () => 0.99,
    skills: [skill('hunting_arrow')],
    hero: { attack: noop },
    callbacks: { onSound: noop },
    vfx: { signature: noop, ring: noop, burst: noop, slash: noop, lightning: noop, meteor: noop },
    numbers: {
      show: (_x: number, _y: number, damage: number, crit: boolean) => hits.push({ damage, crit }),
    },
    projectiles: {
      spawn: (
        _x: number,
        _y: number,
        _angle: number,
        _color: number,
        id: string,
        options: Record<string, any>,
      ) => projectiles.push({ id, options }),
    },
    makeZone: (...args: any[]) => zones.push(args),
  });
  // Tests enable only the branch passives relevant to the case.
  engine.config.skills = {};
  return { engine, projectiles, hits, zones, stats };
}

function enemy(id: number, x: number, y = 0) {
  return {
    id,
    x,
    y,
    hp: 1e9,
    maxHp: 1e9,
    radius: 10,
    shield: 0,
    stun: 0,
    slow: 0,
    poison: 0,
    poisonStacks: 0,
    vulnerability: 0,
    elite: false,
    boss: false,
    minion: false,
    view: { hit: noop },
  };
}

test('movement uses each skill distance and duration, including arrow-key direction and boundary clamp', () => {
  for (const id of ['teleport', 'tumble', 'charge', 'blood_step', 'shadow_step']) {
    const definition = skill(id);
    const { engine, stats, zones } = engineFor(definition.classId);
    engine.keys.add('arrowdown');
    engine.perform(definition, false);
    assert.ok(Math.abs(engine.x) < 1e-8);
    assert.equal(engine.y, definition.radius);
    if (id === 'teleport') {
      assert.equal(engine.shield, stats.hp * 0.4);
      assert.equal(engine.shieldTime, 4);
      assert.equal(engine.buffs.has('invulnerable'), false);
      engine.updateShield(4);
      assert.equal(engine.shield, 0);
    } else {
      assert.equal(
        engine.buffs.snapshot().find((b: any) => b.name === '无敌').seconds,
        definition.duration,
      );
    }
    if (id === 'tumble') assert.ok(zones.length > 1);
  }
  const { engine } = engineFor('sorcerer');
  engine.x = 770;
  engine.perform(skill('teleport'), false);
  assert.equal(engine.x, 780);
});

test('charge strikes along its path and blood step heals only when crossing an enemy', () => {
  const { engine } = engineFor('barbarian');
  const onPath = enemy(1, 100),
    offPath = enemy(2, 100, 80);
  engine.enemies = [onPath, offPath];
  engine.perform(skill('charge'), false);
  assert.ok(onPath.hp < onPath.maxHp);
  assert.equal(offPath.hp, offPath.maxHp);
  assert.ok(onPath.x > 100);
  for (const crossing of [false, true]) {
    const { engine: blood, stats } = engineFor('necromancer');
    if (crossing) blood.enemies = [enemy(1, 100)];
    const before = blood.hp;
    blood.perform(skill('blood_step'), false);
    assert.equal(blood.hp, before + (crossing ? stats.hp * 0.05 : 0));
  }
});

test('electrocute hits three targets and wolf claw makes three strikes at the configured attack speed', () => {
  const { engine } = engineFor('sorcerer');
  engine.enemies = Array.from({ length: 5 }, (_, i) => enemy(i, 40 + i * 10));
  engine.perform(skill('electrocute'), false);
  assert.equal(engine.enemies.filter((e: any) => e.hp < e.maxHp).length, 3);
  assert.equal(engine.resource, 12);
  const { engine: wolf, hits } = engineFor('druid');
  wolf.buffs.add('wolf', '狼人', 15);
  wolf.enemies = [enemy(1, 40)];
  wolf.perform(skill('storm_claw'), false);
  assert.equal(hits.length, 4); // One wolf lightning trigger plus the three claw strikes.
  assert.equal(wolf.cooldowns.storm_claw, 0.6 / 1.6);
  assert.equal(wolf.resource, 12);
});

test('split projectiles share one resource grant and magic missiles restore the configured amount', () => {
  for (const [id, passive, count, recovery] of [
    ['hunting_arrow', 'split_arrow', 3, 12],
    ['magic_missile', '', 3, 15],
    ['flying_blade', 'return_blade', 3, 15],
  ] as const) {
    const { engine, projectiles } = engineFor(skill(id).classId);
    if (passive) engine.config.skills[passive] = 1;
    engine.perform(skill(id), false);
    assert.equal(projectiles.length, count);
    const target = enemy(1, 30);
    for (const p of projectiles)
      engine.hit(target, skill(p.id), p.options.multiplier, true, false, p.options.cast);
    assert.equal(engine.resource, recovery);
  }
});

test('bulwark explodes once on expiry and control durations, armor reduction and shadow critical stay scoped', () => {
  const { engine, hits } = engineFor('druid');
  const target = enemy(1, 50);
  engine.enemies = [target];
  engine.perform(skill('earthen_bulwark'), false);
  assert.equal(target.hp, target.maxHp);
  engine.updateShield(4.9);
  assert.equal(target.hp, target.maxHp);
  engine.updateShield(0.1);
  assert.ok(target.hp < target.maxHp);
  const after = target.hp;
  engine.updateShield(1);
  assert.equal(target.hp, after);
  engine.perform(skill('hurricane_break'), true);
  assert.deepEqual(target.armorReduction, { value: 0.35, expires: 4 });
  engine.perform(skill('shadow_step'), false);
  assert.equal(hits.at(-1)!.crit, true);
  engine.hit(target, skill('storm_claw'));
  assert.equal(hits.at(-1)!.crit, false);
  engine.perform(skill('iron_hook'), true);
  assert.equal(target.stun, 2);
  engine.perform(skill('decrepify'), true);
  assert.equal(target.curse, 6);
  assert.equal(target.slowRatio, 0.6);
});

test('poison scythe improves only damage over time and corroded fang settles the stored poison including stacks', () => {
  const { engine } = engineFor('necromancer');
  engine.config.skills.poison_scythe = 1;
  engine.powers.set('corroded_fang', 1);
  const target = enemy(1, 50);
  engine.enemies = [target];
  assert.equal(engine.resolveSkill(skill('death_scythe')).multiplier, 5.6);
  engine.hit(target, skill('death_scythe'));
  assert.equal(target.poison, 5);
  assert.equal(target.poisonSkill.multiplier * 0.4, 0.35 * 1.5);
  target.poisonStacks = 3;
  const calls: any[][] = [];
  const hit = engine.hit.bind(engine);
  engine.hit = (...args: any[]) => {
    calls.push(args);
    hit(...args);
  };
  engine.perform(skill('death_scythe'), true);
  const settlement = calls.find((call) => call[4] === true)!;
  assert.equal(settlement[2], 5 * 0.4 * 4);
  assert.equal(settlement[3], false);
  assert.equal(target.poison, 5);
  const stats = engine.config.stats;
  engine.config.skills.overwhelming_essence = 1;
  engine.powers.set('reilena', 0.005);
  const originalMax = stats.maxResource;
  engine.applyStaticPowers();
  assert.equal(stats.independent.at(-1), (originalMax + 40) * 0.005);
});

function summonAt(x: number, y = 0) {
  return { x, y, visible: true, alpha: 0.65, attack: noop, update: noop, scale: { set: noop } };
}

test('summons share monster attack geometry, stop while dead, and Rathma revives deaths and self-explosions immediately', () => {
  const { engine } = engineFor('necromancer');
  const inside = summonAt(20),
    outside = summonAt(120);
  engine.summons = [inside, outside];
  for (const summon of engine.summons)
    engine.summonStates.set(summon, { hp: 100, maxHp: 100, reviveIn: 0 });
  const strike = {
    id: 1,
    kind: 'strike',
    source: 'slam',
    shape: 'circle',
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    radius: 40,
    range: 100,
    width: 20,
    angle: 0,
    element: 'physical',
    color: 0xffffff,
    damage: 100000,
    playerHit: false,
  };
  engine.handleEnemyEvent(enemy(1, 50), strike);
  assert.equal(engine.summonStates.get(inside).hp, 0);
  assert.equal(inside.visible, false);
  assert.equal(engine.summonStates.get(outside).hp, 100);
  const deadX = inside.x;
  engine.updateSummons(1);
  assert.equal(inside.x, deadX);
  assert.equal(inside.visible, false);
  engine.updateSummons(2);
  assert.equal(engine.summonStates.get(inside).hp, 100);
  assert.equal(inside.visible, true);
  engine.setCounts.set('rathma', 2);
  inside.x = 20;
  inside.y = 0;
  engine.handleEnemyEvent(enemy(1, 50), strike);
  assert.equal(engine.summonStates.get(inside).hp, 100);
  assert.equal(inside.visible, true);
  inside.x = 350;
  outside.x = 400;
  const target = enemy(2, 400);
  engine.enemies = [target];
  engine.perform(skill('command_skeletons'), true);
  assert.ok(
    target.hp < target.maxHp,
    'explosions originate from the skeletons away from the player',
  );
  assert.ok(engine.summons.every((summon: any) => engine.summonStates.get(summon).hp === 100));
  assert.ok(engine.summons.every((summon: any) => summon.visible));
  engine.setCounts.clear();
  engine.perform(skill('command_skeletons'), true);
  assert.ok(engine.summons.every((summon: any) => engine.summonStates.get(summon).hp === 0));
});

test('Endless Depths emits one immediate explosion and two delayed explosions at the rolled multiplier', () => {
  for (const id of ['frozen_orb', 'frost_nova']) {
    const { engine, hits } = engineFor('sorcerer');
    const target = enemy(1, 40);
    engine.enemies = [target];
    engine.powers.set('endless_depths', 0.7);
    engine.zones = [];
    engine.makeZone = (
      x: number,
      y: number,
      radius: number,
      life: number,
      definition: any,
      multiplier: number,
      pulseTimes: number[],
    ) => {
      engine.zones.push({
        x,
        y,
        radius,
        life,
        age: 0,
        skill: definition,
        multiplier,
        pulseTimes,
        view: { destroy: noop },
      });
    };
    if (id === 'frost_nova') engine.perform(skill(id), false);
    else engine.explode(0, 0, 150, skill(id), 1);
    assert.equal(hits.length, 1);
    const base = hits[0].damage;
    engine.updateZones(0.19);
    assert.equal(hits.length, 1);
    engine.updateZones(0.02);
    assert.equal(hits.length, 2);
    assert.ok(Math.abs(hits[1].damage - base * 0.7) <= 1);
    engine.updateZones(0.2);
    assert.equal(hits.length, 3);
    assert.ok(Math.abs(hits[2].damage - base * 0.7) <= 1);
    assert.equal(engine.zones.length, 0);
    engine.updateZones(1);
    assert.equal(hits.length, 3);
  }
});
