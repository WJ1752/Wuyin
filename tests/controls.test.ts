import assert from 'node:assert/strict';
import test from 'node:test';
import { GameEngine } from '../src/engine/GameEngine';
import { SKILLS } from '../src/data/skillTrees';
import { buildHarness } from './helpers/combatHarness';

function controls() {
  const engine: any = new GameEngine();
  engine.emit = () => {};
  return engine;
}

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
