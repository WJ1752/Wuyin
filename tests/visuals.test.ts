import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { HALL_NPCS } from '../src/data/npcHall';
import { NPC_ART } from '../src/data/npcVisuals';
import { SKILLS } from '../src/data/skillTrees';
import { SKILL_ART, CAST_ART, EFFECT_CELLS } from '../src/data/skillArt';
import { LEGENDARIES } from '../src/data/legendaries';
import { SETS } from '../src/data/sets';
import { generateLoot } from '../src/engine/LootGenerator';
import {
  getItemVisual,
  EQUIPMENT_DROP_CATALOG,
  EQUIPMENT_ATLAS,
  getSkillSvg,
  LEGENDARY_VISUALS,
  ORDINARY_VISUALS,
  SET_VISUALS,
  SKILL_VISUALS,
  type AssetVisual,
} from '../src/data/visuals';
import sharp from 'sharp';

// Ignore color and identity when checking uniqueness: recolored copies do not
// meet the requirement for individually recognizable equipment and skills.
const geometry = (visual: AssetVisual) =>
  JSON.stringify(visual.layers.map(({ path, transform }) => ({ path, transform })));

test('equipment drop atlas matches the stable visual catalog', async () => {
  assert.equal(EQUIPMENT_DROP_CATALOG.length, 221);
  const metadata = await sharp(
    readFileSync(new URL('../public/assets/maps/equipment-drops.webp', import.meta.url)),
  ).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, EQUIPMENT_ATLAS.columns * EQUIPMENT_ATLAS.cell);
  assert.equal(metadata.height, EQUIPMENT_ATLAS.rows * EQUIPMENT_ATLAS.cell);
});

test('all seven hall residents resolve to distinct cells of a bundled high resolution RGBA atlas', () => {
  assert.deepEqual(Object.keys(NPC_ART).sort(), HALL_NPCS.map((npc) => npc.id).sort());
  const cells = HALL_NPCS.map((npc) => {
    const art = NPC_ART[npc.id];
    assert.ok(art.description.length > 0);
    const png = readFileSync(
      new URL(`../public/${art.src.replace(/^\.?\//, '')}`, import.meta.url),
    );
    assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a');
    assert.ok(png.readUInt32BE(16) >= 1600 && png.readUInt32BE(20) >= 800);
    assert.equal(png[25], 6, 'transparent RGBA sprites');
    assert.ok(art.column >= 0 && art.column < 4 && art.row >= 0 && art.row < 2);
    return `${art.column}:${art.row}`;
  });
  assert.equal(new Set(cells).size, HALL_NPCS.length, 'NPCs must use their own atlas cells');
});

test('every skill has an illustrated tile and every active skill has a distinct cast sprite', () => {
  const active = SKILLS.filter((skill) => skill.kind !== 'passive');
  assert.deepEqual(Object.keys(SKILL_ART).sort(), SKILLS.map((s) => s.id).sort());
  assert.deepEqual(Object.keys(CAST_ART).sort(), active.map((s) => s.id).sort());
  for (const frames of [SKILL_ART, CAST_ART]) {
    const all = Object.values(frames);
    assert.equal(new Set(all.map((f) => `${f.src}/${f.column}/${f.row}`)).size, all.length);
    for (const src of new Set(all.map((f) => f.src))) {
      const file = readFileSync(new URL(`../public/${src}`, import.meta.url));
      assert.equal(file.toString('ascii', 8, 12), 'WEBP');
    }
  }
  assert.equal(new Set(EFFECT_CELLS).size, 12);
});

test('every skill retains a distinct vector fallback', () => {
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
