import assert from 'node:assert/strict';
import test from 'node:test';
import { MONSTERS } from '../src/data/monsters';
import { buildHarness } from './helpers/combatHarness';
import { GameEngine } from '../src/engine/GameEngine';
import { createCombatConfig, newSave } from '../src/state/gameStore';
import type { RunResult } from '../src/core/types';

test('hosted headless parties clear one shared world and settle independent rewards', () => {
  const members = (['ranger', 'sorcerer'] as const).map((classId, i) => ({
    id: `p${i}`,
    name: `队员${i}`,
    config: createCombatConfig(newSave(classId)),
  }));
  const engine = new GameEngine();
  let result: RunResult | undefined;
  engine.initHeadlessCoop(members, 4107, {
    onSound() {},
    onSnapshot() {},
    onFinish(value) {
      result = value;
    },
  });
  try {
    for (let sequence = 1; sequence <= 9000 && !result; sequence++) {
      const frame = engine.headlessFrame('p0');
      for (const actor of frame.actors) {
        const target = frame.enemies
          .filter((enemy) => enemy.hp > 0)
          .sort(
            (a, b) =>
              Math.hypot(a.x - actor.x, a.y - actor.y) - Math.hypot(b.x - actor.x, b.y - actor.y),
          )[0];
        const angle = target
          ? Math.atan2(target.y - actor.y, target.x - actor.x) +
            (Math.hypot(target.x - actor.x, target.y - actor.y) < 65 ? Math.PI / 2 : 0)
          : 0;
        engine.receiveCoopInput(actor.id, {
          sequence,
          movement: target ? { x: Math.cos(angle), y: Math.sin(angle) } : { x: 0, y: 0 },
          casts: [],
        });
      }
      engine.stepHeadless();
    }
    assert.equal(result?.won, true);
    const final = engine.headlessFrame('p0');
    assert.equal(final.actors.length, 2);
    assert.equal(Object.keys(final.results!).length, 2);
    assert.equal(final.results!.p0.partySize, 2);
    assert.equal(final.results!.p0.kills, final.results!.p1.kills);
    const first = new Set(final.results!.p0.items.map((item) => item.id));
    assert.ok(final.results!.p0.items.length > 0 && final.results!.p1.items.length > 0);
    assert.ok(final.results!.p1.items.every((item) => !first.has(item.id)));
  } finally {
    engine.destroy();
  }
});

function party(size = 2) {
  const host = buildHarness('wasteland', 4, 1, false).engine;
  host.coop = { localId: 'p0', hostId: 'p0', members: [] };
  host.bossSpawned = true;
  host.spawnTimer = 999;
  const actors = [host];
  for (let i = 1; i < size; i++) {
    const guest = buildHarness('tal_rasha', 4, 1, false).engine;
    host.linkCoopActor(guest);
    actors.push(guest);
  }
  actors.forEach((actor, index) => {
    host.coopActors.set(`p${index}`, actor);
    host.coop.members.push({ id: `p${index}`, name: `队员${index}`, config: actor.config });
    actor.config.autoSkills = Object.fromEntries(
      actor.skills.map((skill: any) => [skill.id, false]),
    );
    actor.periodicTimer = 999;
  });
  return { host, actors };
}

test('cooperative actors use one enemy world, shared kill credit and independent class loot', () => {
  const {
    host,
    actors: [, guest],
  } = party(2);
  assert.equal(guest.enemies, host.enemies);
  const enemy = host.spawn(MONSTERS[0], 80, 0, true);
  enemy.hp = 0;
  guest.kill(enemy);
  host.kill(enemy);
  assert.equal(host.kills, 1, 'one enemy must never grant duplicate team credit');
  assert.equal(guest.kills, host.kills);
  assert.equal(host.earned.length, 1);
  assert.equal(guest.earned.length, 1);
  assert.notEqual(host.earned[0].id, guest.earned[0].id, 'each player owns a separate item');
});

test('remote manual casts execute the existing skill once, ACK commands and reject stale input', () => {
  const {
    host,
    actors: [, guest],
  } = party();
  host.spawn(
    { ...MONSTERS[0], behavior: 'dummy', family: 'benchmark', hp: 1e20, attack: 0, speed: 0 },
    80,
    0,
  );
  const skill = guest.skills.find((skill: any) => skill.kind === 'basic');
  const input = {
    sequence: 3,
    movement: { x: 1, y: 0 },
    casts: [],
    commands: [{ sequence: 1, id: skill.id }],
  };
  host.receiveCoopInput('p1', input);
  host.updateCoop(0.05);
  assert.equal(guest.attackCount, 1);
  assert.ok(guest.x > 0, 'remote controls move the remote actor');
  assert.ok(guest.cooldowns[skill.id] > 0, 'the real skill cooldown was applied');
  host.receiveCoopInput('p1', { ...input, sequence: 4 });
  host.updateCoop(0.05);
  assert.equal(guest.attackCount, 1, 'an unacknowledged command can be resent safely');
  assert.equal(host.coopFrame().actors.find((actor: any) => actor.id === 'p1').inputSequence, 1);
  host.receiveCoopInput('p1', { ...input, sequence: 2, movement: { x: -1, y: 0 } });
  assert.equal(host.coopControls.get('p1').input.sequence, 4);
  host.coopControls.get('p1').receivedAt -= 1000;
  const before = guest.x;
  host.updateCoop(0.05);
  assert.equal(guest.x, before, 'a lost connection must release remote movement');
});

test('shared attacks hit every player inside the telegraph and spare players outside', () => {
  const { host, actors } = party(4);
  actors.forEach((actor, index) => {
    actor.x = index === 3 ? 500 : index * 10;
    actor.y = 0;
    actor.config.stats.dodge = 0;
  });
  const before = actors.map((actor) => actor.hp);
  const enemy = host.spawn(MONSTERS[0], 0, 0);
  host.handleEnemyEvent(enemy, {
    kind: 'strike',
    id: 1,
    source: 'test',
    shape: 'circle',
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    angle: 0,
    radius: 100,
    range: 100,
    width: 100,
    element: 'physical',
    color: 0xffffff,
    playerHit: true,
    damage: 100,
  });
  for (let i = 0; i < 3; i++) assert.ok(actors[i].hp < before[i]);
  assert.equal(actors[3].hp, before[3]);
});

test('downed members revive after eight shared seconds; full wipe ends the party', () => {
  const {
    host,
    actors: [, guest],
  } = party();
  guest.hp = 0;
  guest.coopDownSeconds = 8;
  for (let i = 0; i < 159; i++) host.updateCoop(0.05);
  assert.equal(guest.hp, 0);
  host.updateCoop(0.05);
  host.updateCoop(0.05);
  assert.ok(guest.hp >= guest.config.stats.hp * 0.5);
  assert.equal(host.finished, false);
  host.hp = guest.hp = 0;
  host.coopDownSeconds = guest.coopDownSeconds = 8;
  let result: any;
  host.callbacks.onFinish = (value: any) => {
    result = value;
  };
  host.updateCoop(0.05);
  assert.equal(result.won, false);
  assert.equal(result.partySize, 2);
});

test('boss victory publishes every personal result once before the local finish callback', () => {
  const { host, actors } = party(4);
  const events: string[] = [];
  host.coop.onFrame = () => events.push('frame');
  host.callbacks.onFinish = () => events.push('finish');
  const boss = host.spawn(MONSTERS[0], 0, 0, false, true);
  boss.hp = 0;
  actors[2].kill(boss);
  assert.deepEqual(events, ['frame', 'finish']);
  assert.equal(Object.keys(host.coopResults).length, 4);
  for (const result of Object.values(host.coopResults) as any[]) {
    assert.equal(result.won, true);
    assert.equal(result.partySize, 4);
    assert.ok(result.items.length >= 4);
    assert.equal(result.gold, host.gold);
  }
  host.finishCoop(true);
  assert.equal(events.length, 2, 'replayed finish cannot grant another reward');
});

test('a one-FPS background host advances real time using collision-safe fixed steps', () => {
  const { host } = party();
  const steps: number[] = [];
  const update = host.updateCoop.bind(host);
  host.updateCoop = (dt: number) => {
    steps.push(dt);
    update(dt);
  };
  host.coopWallClock = 1000;
  host.setPaused(true);
  host.advanceCoopClock(2000);
  host.advanceCoopClock(3000);
  assert.ok(
    Math.abs(host.elapsed - 2) < 1e-8,
    'background rendering and a local menu cannot slow team time',
  );
  assert.ok(steps.length >= 60);
  assert.ok(steps.every((dt) => dt > 0 && dt <= 1 / 30 + 1e-8));
  host.advanceCoopClock(13000);
  assert.ok(
    Math.abs(host.elapsed - 4) < 1e-8,
    'long suspension catches up at most two seconds in one callback',
  );
});

test('background guests immediately publish neutral controls and keep producing input heartbeats', () => {
  const { host: guest } = party();
  const sent: any[] = [];
  guest.coop = {
    localId: 'p0',
    hostId: 'p1',
    members: [],
    onInput: (input: any) => sent.push(input),
  };
  guest.coopWallClock = 1000;
  guest.setMovement(1, 0);
  guest.queueCoopCommand('magic_missile');
  guest.onBlur();
  assert.deepEqual(sent.at(-1).movement, { x: 0, y: 0 });
  assert.deepEqual(sent.at(-1).commands, []);
  const first = sent.at(-1).sequence;
  guest.advanceCoopClock(2000);
  assert.ok(sent.at(-1).sequence > first, 'input heartbeats are independent of the render ticker');
  assert.deepEqual(sent.at(-1).movement, { x: 0, y: 0 });
});
