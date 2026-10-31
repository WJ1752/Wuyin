import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { HALL_NPCS } from '../src/data/npcHall';
import { NPC_ART } from '../src/data/npcVisuals';
import { SKILLS } from '../src/data/skillTrees';
import { LEGENDARIES } from '../src/data/legendaries';
import { SETS } from '../src/data/sets';
import { generateLoot } from '../src/engine/LootGenerator';
import {
  getItemVisual,
  getSkillSvg,
  LEGENDARY_VISUALS,
  ORDINARY_VISUALS,
  SET_VISUALS,
  SKILL_VISUALS,
  type AssetVisual,
} from '../src/data/visuals';

// Ignore color and identity when checking uniqueness: recolored copies do not
// meet the requirement for individually recognizable equipment and skills.
const geometry = (visual: AssetVisual) =>
  JSON.stringify(visual.layers.map(({ path, transform }) => ({ path, transform })));

test('all seven hall residents resolve to self-contained SVGs with distinct body and tool geometry', () => {
  assert.deepEqual(Object.keys(NPC_ART).sort(), HALL_NPCS.map((npc) => npc.id).sort());
  const silhouettes = HALL_NPCS.map((npc) => {
    const art = NPC_ART[npc.id];
    assert.ok(art.description.length > 0);
    const svg = readFileSync(
      new URL(`../public/${art.src.replace(/^\.?\//, '')}`, import.meta.url),
      'utf8',
    );
    assert.match(svg, /<svg\b[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /viewBox="0 0 64 80"/);
    assert.match(svg, /<\/svg>\s*$/);
    assert.ok(
      !/<(?:image|text|script)\b|href=/i.test(svg),
      `${npc.id} must not depend on external art`,
    );
    return [...svg.matchAll(/<(?:path|rect|circle|polygon|ellipse)\b[^>]*>/g)]
      .map(([shape]) => shape.replace(/\s(?:fill|stroke|opacity|id)="[^"]*"/g, ''))
      .join('');
  });
  assert.equal(
    new Set(silhouettes).size,
    HALL_NPCS.length,
    'NPCs must differ in geometry, not just color',
  );
});

test('every skill has distinct authored geometry and a self-contained combat SVG', () => {
  assert.deepEqual(Object.keys(SKILL_VISUALS).sort(), SKILLS.map((skill) => skill.id).sort());
  assert.equal(new Set(Object.values(SKILL_VISUALS).map(geometry)).size, SKILLS.length);
  for (const skill of SKILLS) {
    const visual = SKILL_VISUALS[skill.id];
    assert.equal(visual.effectKey, skill.id);
    const svg = getSkillSvg(skill.id)!;
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
    assert.ok(svg.includes(visual.layers[0].path));
    assert.ok(
      !/<text|<image|href=/i.test(svg),
      `${skill.id} must render without text or external assets`,
    );
  }
  assert.equal(getSkillSvg('missing_skill'), undefined);
});

test('all named equipment and set pieces have distinct geometry and resolve by content identity', () => {
  const named = LEGENDARIES.map((legend) => {
    const visual = getItemVisual({ slot: legend.slot, legendaryId: legend.id });
    assert.equal(visual, LEGENDARY_VISUALS[legend.id]);
    return visual;
  });
  for (const set of SETS) {
    for (const slot of ['head', 'chest', 'hands', 'legs', 'feet'] as const) {
      const item = generateLoot(set.classId, 10, { setId: set.id, slot, rng: () => 0.5 });
      const visual = getItemVisual(item);
      assert.equal(visual, SET_VISUALS[`${set.id}:${slot}`]);
      named.push(visual);
    }
  }
  assert.equal(named.length, 120);
  assert.equal(new Set(named.map(geometry)).size, named.length);
  const allEquipment = [...named, ...Object.values(ORDINARY_VISUALS)];
  assert.equal(new Set(allEquipment.map(geometry)).size, allEquipment.length);
});

test('ordinary equipment uses stable series and slot identity, independent of rolls and instance IDs', () => {
  assert.equal(new Set(Object.values(ORDINARY_VISUALS).map(geometry)).size, 56);
  const first = generateLoot('ranger', 1, { slot: 'weapon', rarity: 'rare', rng: () => 0.5 });
  const second = { ...first, id: 'a-different-drop', level: 100, attack: 999 };
  assert.equal(getItemVisual(first), getItemVisual(second));
  assert.equal(getItemVisual(first).key, 'ordinary:暮色:weapon');
  assert.notEqual(getItemVisual(first), getItemVisual({ ...first, slot: 'chest' }));
  assert.equal(
    getItemVisual({ ...first, name: `【太古】${first.name}`, rarity: 'primal' }),
    getItemVisual(first),
  );
});
