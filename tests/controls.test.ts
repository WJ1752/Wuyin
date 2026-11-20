import assert from 'node:assert/strict';
import test from 'node:test';
import { GameEngine } from '../src/engine/GameEngine';
import { SKILLS } from '../src/data/skillTrees';
import { boundCamera } from '../src/render/viewport';
import { buildHarness } from './helpers/combatHarness';

function controls() {
  const engine: any = new GameEngine();
  engine.config = { preferences: undefined };
  engine.emit = () => {};
  return engine;
}

test('combat framing cannot reveal the blank space beyond the terrain at a map edge', () => {
  assert.equal(boundCamera(1350, 844, 900), 900);
  assert.equal(boundCamera(-720, 844, 900), -56);
  assert.equal(boundCamera(410, 844, 900), 410);
  assert.equal(boundCamera(690, 1800, 900), 900);
});

test('a slow visible frame advances the solo clock using bounded collision steps', () => {
  const engine = controls();
  const steps: number[] = [];
  engine.app = { ticker: { elapsedMS: 140, FPS: 7 } };
  engine.updateCamera = () => {};
  engine.update = (delta: number) => steps.push(delta);
  engine.tick();
  assert.ok(steps.every((delta) => delta > 0 && delta <= 1 / 30));
  assert.ok(Math.abs(steps.reduce((sum, delta) => sum + delta, 0) - 0.14) < 1e-8);
  engine.setPaused(true);
  const count = steps.length;
  engine.tick();
  assert.equal(steps.length, count);
});

test('touch dragging reaches full movement at the floating thumb radius and releases cleanly', () => {
  const engine = controls();
  engine.onPointerDown({
    button: 0,
    isPrimary: true,
    pointerType: 'touch',
    clientX: 100,
    clientY: 200,
    pointerId: 1,
  });
  engine.onPointerMove({ clientX: 114, clientY: 200, pointerId: 1 });
  assert.deepEqual(engine.dragMovement, { x: 0.5, y: 0 });
  engine.onPointerMove({ clientX: 128, clientY: 200, pointerId: 1 });
  assert.deepEqual(engine.dragMovement, { x: 1, y: 0 });
  engine.onPointerMove({ clientX: 200, clientY: 300, pointerId: 1 });
  assert.ok(Math.abs(Math.hypot(engine.dragMovement.x, engine.dragMovement.y) - 1) < 1e-10);
  engine.onPointerUp({ pointerId: 1 });
  assert.deepEqual(engine.dragMovement, { x: 0, y: 0 });
});

test('pausing and losing focus clear every movement source and wait for fresh gamepad input', () => {
  const engine = controls();
  engine.keys.add('w');
  engine.setMovement(1, 0);
  engine.onPointerDown({ button: 0, isPrimary: true, clientX: 0, clientY: 0, pointerId: 1 });
  engine.onPointerMove({ clientX: 65, clientY: 0, pointerId: 1 });
  engine.gamepadHeld.add(0);
  engine.setPaused(true);
  assert.equal(engine.paused, true);
  assert.equal(engine.keys.size, 0);
  assert.deepEqual(engine.movement, { x: 0, y: 0 });
  assert.deepEqual(engine.dragMovement, { x: 0, y: 0 });
  assert.equal(engine.drag, undefined);
  assert.equal(engine.gamepadHeld.size, 0);
  assert.equal(engine.gamepadBlocked, true);
  engine.setPaused(true);
  assert.equal(engine.paused, true, 'setting pause twice must not resume the game');
  engine.setPaused(false);
  engine.onPointerMove({ clientX: 130, clientY: 0, pointerId: 1 });
  assert.deepEqual(engine.dragMovement, { x: 0, y: 0 }, 'old drag must not resume');
  engine.onBlur();
  assert.equal(engine.paused, true);
});

test('another finger releasing or moving never cancels the battlefield drag or joystick', () => {
  const engine = controls();
  engine.setMovement(0, 1);
  engine.onPointerDown({ button: 0, isPrimary: true, clientX: 0, clientY: 0, pointerId: 7 });
  engine.onPointerMove({ clientX: 65, clientY: 0, pointerId: 7 });
  engine.onPointerMove({ clientX: -65, clientY: 0, pointerId: 8 });
  engine.onPointerUp({ pointerId: 8 });
  assert.deepEqual(engine.dragMovement, { x: 1, y: 0 });
  assert.equal(engine.drag.pointerId, 7);
  engine.onPointerUp({ pointerId: 7 });
  assert.deepEqual(engine.dragMovement, { x: 0, y: 0 });
  assert.deepEqual(engine.movement, { x: 0, y: 1 }, 'drag release must preserve joystick movement');
});

test('shortcuts respect editable controls, dialogs, browser modifiers and focused button space', () => {
  const engine = controls();
  const casts: string[] = [];
  engine.skills = SKILLS.filter(
    (skill) => skill.classId === 'barbarian' && skill.kind !== 'passive',
  );
  engine.cast = (id: string) => casts.push(id);
  const key = (value: string, options: Record<string, unknown> = {}) =>
    engine.onKeyDown({
      key: value,
      repeat: false,
      target: null,
      preventDefault() {},
      ...options,
    });
  key('w', { ctrlKey: true });
  key('1', { target: { closest: () => ({}) } });
  key(' ', {
    target: { closest: (selector: string) => (selector.startsWith('button') ? {} : null) },
  });
  assert.equal(engine.keys.size, 0);
  assert.deepEqual(casts, []);
  engine.hasInputDialog = () => true;
  key('Escape');
  assert.equal(engine.paused, false, 'Escape must belong to the visible dialog');
  engine.hasInputDialog = () => false;
  key('1');
  key('1', { repeat: true });
  assert.equal(casts.length, 1, 'holding a number key must not repeatedly cast');
  engine.setPaused(true);
  key('w');
  assert.equal(engine.keys.size, 0);
});

test('displayed resource costs match the actual discounted and free meteor cast', () => {
  const { engine } = buildHarness('tal_rasha');
  const meteor = SKILLS.find((skill) => skill.id === 'meteor')!;
  engine.powers.set('grand_vizier', 1);
  const cost = meteor.cost * 0.5;
  assert.equal(engine.getSkillCost('meteor'), cost);
  engine.resource = cost;
  engine.cast('meteor');
  assert.equal(engine.resource, 0);
  assert.ok(engine.cooldowns.meteor > 0);
  delete engine.cooldowns.meteor;
  engine.buffs.add('channeling', '引能', 5);
  assert.equal(engine.getSkillCost('meteor'), 0);
  engine.cast('meteor');
  assert.equal(engine.resource, 0);
  assert.ok(engine.cooldowns.meteor > 0);
});

test('custom physical keys replace defaults and release movement after key-up', () => {
  const engine = controls();
  engine.config.preferences = { keyBindings: { up: 'KeyI', skill1: 'KeyJ' } };
  engine.skills = [SKILLS.find((skill) => skill.id === 'hunting_arrow')!];
  const casts: string[] = [];
  engine.cast = (id: string) => casts.push(id);
  const press = (key: string, code: string) =>
    engine.onKeyDown({ key, code, target: null, repeat: false, preventDefault() {} });
  press('w', 'KeyW');
  assert.equal(engine.keys.size, 0, 'the replaced default must not keep moving');
  press('i', 'KeyI');
  assert.ok(engine.keys.has('w'));
  engine.onKeyUp({ key: 'i', code: 'KeyI' });
  assert.equal(engine.keys.size, 0);
  press('j', 'KeyJ');
  assert.deepEqual(casts, ['hunting_arrow']);
});

test('a tap picks an enemy in canvas coordinates, while dragging preserves that choice', () => {
  const engine = controls();
  const canvas = { getBoundingClientRect: () => ({ left: 20, top: 40, width: 400, height: 200 }) };
  engine.app = { canvas, screen: { width: 800, height: 400 } };
  engine.world.toLocal = (point: { x: number; y: number }) => point;
  engine.enemies = [{ id: 7, radius: 14, hp: 8, view: { x: 100, y: 100 } }];
  const pointer = {
    button: 0,
    isPrimary: true,
    pointerId: 2,
    clientX: 70,
    clientY: 83,
    target: canvas,
  };
  engine.onPointerDown(pointer);
  engine.onPointerUp({ ...pointer, type: 'pointerup' });
  assert.equal(engine.focusId, 7);
  engine.onPointerDown(pointer);
  engine.onPointerMove({ ...pointer, clientX: 162 });
  engine.onPointerUp({ ...pointer, type: 'pointerup', clientX: 162 });
  assert.equal(engine.focusId, 7);
  const empty = { ...pointer, clientX: 162 };
  engine.onPointerDown(empty);
  engine.onPointerUp({ ...empty, type: 'pointerup' });
  assert.equal(engine.focusId, undefined);
});

test('a manual cast buffered at the end of its cooldown fires once and is cancelled on pause', () => {
  const { engine } = buildHarness('tal_rasha');
  engine.cooldowns.meteor = 0.12;
  const before = engine.report.casts;
  engine.cast('meteor');
  assert.equal(engine.report.casts, before);
  engine.updateActor(0.13);
  engine.updateActor(0.02);
  assert.equal(engine.report.casts, before + 1);
  engine.cooldowns.meteor = 0.12;
  engine.cast('meteor');
  engine.setPaused(true);
  assert.equal(engine.bufferedSkill, undefined);
});
