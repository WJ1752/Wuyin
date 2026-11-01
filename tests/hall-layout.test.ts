import assert from 'node:assert/strict';
import test from 'node:test';
import { clampHallPosition, HALL_LAYOUT, HALL_NPCS } from '../src/data/npcHall';

type Point = { x: number; y: number };
type Area = { left: number; right: number; top: number; bottom: number };
const within = (point: Point, area: Area) =>
  point.x >= area.left && point.x <= area.right && point.y >= area.top && point.y <= area.bottom;

test('outer-ring services leave the portal plaza and north-south route clear and remain reachable', () => {
  const { portal, portalPlaza, spawn, centralClear, northSouthPath, bounds } = HALL_LAYOUT;
  assert.ok(within(portal, centralClear));
  assert.ok(within(portal, northSouthPath));
  assert.ok(within(portalPlaza, centralClear));
  assert.ok(within(portalPlaza, northSouthPath));
  assert.deepEqual(clampHallPosition(portalPlaza.x, portalPlaza.y), portalPlaza);
  assert.ok(within(spawn, northSouthPath));
  assert.deepEqual(clampHallPosition(spawn.x, spawn.y), spawn);
  const services = HALL_NPCS.map((npc) => npc.panel).sort();
  assert.deepEqual(services, ['cube', 'forge', 'gamble', 'leaderboard', 'pets', 'skills', 'stash']);
  for (const npc of HALL_NPCS) {
    assert.ok(within(npc, bounds), `${npc.id} feet must stay on the walkable plane`);
    assert.ok(!within(npc, centralClear), `${npc.id} must leave the portal plaza open`);
    assert.ok(!within(npc, northSouthPath), `${npc.id} must leave the central route open`);
    assert.deepEqual(clampHallPosition(npc.x, npc.y), { x: npc.x, y: npc.y });
    const approach = npc.approach;
    assert.deepEqual(
      clampHallPosition(approach.x, approach.y),
      approach,
      `${npc.id} approach must be reachable without clipping`,
    );
    assert.ok(
      Math.abs(approach.x - portal.x) < Math.abs(npc.x - portal.x),
      `${npc.id} must be approached from the plaza side`,
    );
    assert.ok(
      Math.hypot(approach.x - npc.x, approach.y - npc.y) <= 0.11,
      `${npc.id} approach must remain close enough to interact`,
    );
    for (const other of HALL_NPCS) {
      if (npc === other) continue;
      assert.ok(
        Math.hypot(npc.x - other.x, npc.y - other.y) >= 0.14,
        `${npc.id} and ${other.id} need separate interaction areas`,
      );
    }
  }
  assert.deepEqual(clampHallPosition(-1, 2), { x: bounds.left, y: bounds.bottom });
  assert.deepEqual(clampHallPosition(2, -1), { x: bounds.right, y: bounds.top });
});
