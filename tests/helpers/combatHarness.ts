import { Container } from 'pixi.js';
import { createRng } from '../../src/core/random';
import type { SaveData } from '../../src/core/types';
import { MONSTERS } from '../../src/data/monsters';
import { STAGES } from '../../src/data/stages';
import { createMonsterBrain } from '../../src/engine/MonsterAI';
import { createBossBrain } from '../../src/engine/BossAI';
import { GameEngine } from '../../src/engine/GameEngine';
import { ProjectileSystem } from '../../src/engine/ProjectileSystem';
import { createCombatConfig, newSave, useGameStore } from '../../src/state/gameStore';

const noop = () => {};
const view = () => {
  const node: any = { x: 0, y: 0, alpha: 1, rotation: 0, children: [{ y: 0 }], skew: { y: 0 } };
  for (const key of [
    'clear',
    'rect',
    'fill',
    'stroke',
    'destroy',
    'attack',
    'update',
    'hit',
    'drawHealth',
  ])
    node[key] = () => node;
  node.position = { set: (x: number, y: number) => Object.assign(node, { x, y }) };
  node.scale = { set: noop };
  return node;
};

/** Same simulation and projectile collision code as the game; only drawing/audio are stubbed. */
export function buildHarness(build: string | SaveData, pieces = 4, stage = 71, training = true) {
  if (typeof build === 'string') {
    const originalRandom = Math.random;
    Math.random = createRng(8801);
    try {
      useGameStore.setState({ save: newSave(), labBackup: null });
      useGameStore.getState().activateBuild(build);
    } finally {
      Math.random = originalRandom;
    }
  }
  const save = structuredClone(typeof build === 'string' ? useGameStore.getState().save : build);
  if (typeof build === 'string') {
    // Laboratory comparisons keep item stats identical and vary only the active set identity.
    let remaining = pieces;
    for (const item of Object.values(save.equipment))
      if (item?.setId && --remaining < 0) delete item.setId;
  }
  save.selectedStage = stage;
  const config = { ...createCombatConfig(save), training };
  const engine: any = new GameEngine();
  engine.setupCharacter(config, { onSound: noop, onSnapshot: noop, onFinish: noop });
  Object.assign(engine, {
    initialized: true,
    random: createRng(4107),
    hero: view(),
    pet: view(),
    vfx: new Proxy({}, { get: () => noop }),
    numbers: { show: noop, tick: noop },
  });
  engine.projectiles = new ProjectileSystem(new Container());
  engine.makeZone = (
    x: number,
    y: number,
    radius: number,
    life: number,
    skill: any,
    multiplier = 1,
    pulseTimes?: number[],
    cast?: any,
  ) => {
    if (engine.zones.length > 35) return;
    engine.zones.push({
      x,
      y,
      radius,
      life,
      skill,
      multiplier,
      pulseTimes,
      cast,
      age: 0,
      tick: 0,
      pull: skill.effect === 'blackhole',
      view: view(),
    });
  };
  engine.drop = (kind: string, x: number, y: number, value = 0, item?: any) => {
    if (engine.orbs.length <= 180)
      engine.orbs.push({ kind, x, y, value, item, age: 0, view: view() });
  };
  let damage = 0;
  engine.spawn = (def: any, x: number, y: number, elite = false, boss = false, minion = false) => {
    const hpMax = def.hp * STAGES[stage - 1].hpMultiplier * (elite ? 5 : 1) * (minion ? 1.6 : 1);
    const enemy = {
      id: engine.nextId++,
      def,
      x,
      y,
      hp: hpMax,
      maxHp: hpMax,
      radius: boss ? 48 : def.radius,
      view: view(),
      elite,
      boss,
      minion,
      age: 0,
      attackTimer: 1 + engine.random(),
      stun: 0,
      slow: 0,
      poison: 0,
      poisonStacks: 0,
      vulnerability: 0,
      lastQuarter: 4,
      affix: Math.floor(engine.random() * 10),
      brain: boss ? undefined : createMonsterBrain(engine.nextId * 7307 + stage),
      bossBrain: boss ? createBossBrain() : undefined,
      shield: 0,
      shieldTime: 0,
    };
    let hp = enemy.hp;
    Object.defineProperty(enemy, 'hp', {
      get: () => hp,
      set: (next: number) => {
        damage += Math.max(0, Math.min(hp, hp - next));
        hp = next;
      },
    });
    engine.enemies.push(enemy);
    return enemy;
  };
  if (config.classId === 'necromancer') {
    for (let i = 0; i < (engine.set('inarius', 2) ? 16 : 10); i++) {
      const summon = view();
      engine.summons.push(summon);
      engine.summonStates.set(summon, {
        hp: config.stats.hp * 0.35,
        maxHp: config.stats.hp * 0.35,
        reviveIn: 0,
      });
      engine.reviveSummon(summon);
    }
  }
  if (config.classId === 'ranger' && config.skills.raven) engine.ravens = [view(), view()];
  return { engine, damage: () => damage, save };
}

export function measureBuild(setId: string, pieces: number, targets: number, seconds = 20) {
  const { engine, damage } = buildHarness(setId, pieces);
  engine.bossSpawned = true;
  for (let i = 0; i < targets; i++) {
    // Boss-sized, stationary targets. A small orbit exercises movement-triggered builds.
    const angle = (i * Math.PI * 2) / targets;
    engine.spawn(
      { ...MONSTERS[0], family: 'benchmark', behavior: 'dummy', hp: 1e12, attack: 0, speed: 0 },
      Math.cos(angle) * 60,
      Math.sin(angle) * 60,
      false,
      true,
    );
  }
  for (let frame = 0; frame < seconds * 30; frame++) {
    engine.x = Math.cos(frame / 30) * 12;
    engine.y = Math.sin(frame / 30) * 12;
    engine.movement = { x: 0.11, y: 0 };
    engine.update(1 / 30);
  }
  return { dps: damage() / seconds, resource: engine.resource, casts: engine.attackCount };
}

export function runRift(
  build: string | SaveData,
  stage = 71,
  observe?: { setup?: (engine: any) => void; frame?: (engine: any, dt: number) => void },
) {
  const { engine } = buildHarness(build, 4, stage, false);
  let won = false;
  engine.callbacks.onFinish = (result: any) => {
    won = result.won;
  };
  observe?.setup?.(engine);
  engine.startEncounter();
  while (!engine.finished && engine.elapsed < 300) {
    const target = engine.enemies
      .filter((e: any) => e.hp > 0)
      .sort((a: any, b: any) => engine.distance(a) - engine.distance(b))[0];
    if (target) {
      const distance = engine.distance(target);
      const angle = Math.atan2(target.y - engine.y, target.x - engine.x);
      // Identical simple policy: close to 60px, then orbit; no teleport or pylon advantage.
      engine.setMovement(
        Math.cos(angle + (distance < 65 ? Math.PI / 2 : 0)),
        Math.sin(angle + (distance < 65 ? Math.PI / 2 : 0)),
      );
    }
    engine.update(1 / 30);
    observe?.frame?.(engine, 1 / 30);
  }
  return {
    won,
    seconds: engine.elapsed,
    kills: engine.kills,
    hp: engine.hp / engine.config.stats.hp,
  };
}
