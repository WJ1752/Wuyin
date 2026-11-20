import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { HALL_NPCS } from '../src/data/npcHall';
import { NPC_ART, NPC_ATLAS } from '../src/data/npcVisuals';
import { skillSound, SOUND_NAMES } from '../src/audio/SynthAudio';
import { SKILLS } from '../src/data/skillTrees';
import { getCharacterArt } from '../src/render/CharacterTextures';
import { SKILL_ART, CAST_ART, EFFECT_CELLS } from '../src/data/skillArt';
import { LEGENDARIES } from '../src/data/legendaries';
import { CLASSES } from '../src/data/classes';
import { CLASS_HAND_EQUIPMENT, itemClass } from '../src/data/equipment';
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

test('equipping a signature piece selects the three authored class poses and unequipping restores the base', async () => {
  for (const id of ['dawn', 'judgment', 'grand_vizier', 'bloodtide', 'greenstone']) {
    const legendary = LEGENDARIES.find((entry) => entry.id === id)!;
    const classId = legendary.classId!;
    const gear = generateLoot(classId, 25, { legendaryId: id });
    const art = getCharacterArt(classId, { [gear.slot]: gear });
    assert.notEqual(art.src, getCharacterArt(classId, {}).src);
    for (const src of [art.src, art.walk, art.action]) {
      const meta = await sharp(
        readFileSync(new URL(`../public/${src}`, import.meta.url)),
      ).metadata();
      assert.ok(meta.hasAlpha && meta.width === 128 && meta.height === 128);
    }
  }
});

test('equipment drop atlas matches the stable visual catalog', async () => {
  assert.equal(EQUIPMENT_DROP_CATALOG.length, 231);
  const metadata = await sharp(
    readFileSync(new URL('../public/assets/maps/equipment-drops.webp', import.meta.url)),
  ).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, EQUIPMENT_ATLAS.columns * EQUIPMENT_ATLAS.cell);
  assert.equal(metadata.height, EQUIPMENT_ATLAS.rows * EQUIPMENT_ATLAS.cell);
});

test('all seven hall residents resolve to distinct cells of a bundled transparent atlas', async () => {
  assert.deepEqual(Object.keys(NPC_ART).sort(), HALL_NPCS.map((npc) => npc.id).sort());
  const atlas = await sharp(
    readFileSync(new URL(`../public/${NPC_ATLAS.replace(/^\.?\//, '')}`, import.meta.url)),
  ).metadata();
  assert.equal(atlas.format, 'webp');
  assert.equal(atlas.hasAlpha, true);
  assert.ok(atlas.width >= 4 * 128 && atlas.width % 4 === 0);
  assert.ok(atlas.height >= 2 * 128 && atlas.height % 2 === 0);
  const cells = HALL_NPCS.map((npc) => {
    const art = NPC_ART[npc.id];
    assert.ok(art.description.length > 0);
    assert.equal(art.src, NPC_ATLAS);
    assert.ok(art.column >= 0 && art.column < 4 && art.row >= 0 && art.row < 2);
    return `${art.column}:${art.row}`;
  });
  assert.equal(new Set(cells).size, HALL_NPCS.length, 'NPCs must use their own atlas cells');
});

test('every skill has an illustrated tile and every active skill has a distinct cast sprite', async () => {
  const active = SKILLS.filter((skill) => skill.kind !== 'passive');
  assert.deepEqual(Object.keys(SKILL_ART).sort(), SKILLS.map((s) => s.id).sort());
  for (const frame of Object.values(SKILL_ART))
    assert.ok(frame.column < 4 && frame.row < 4, 'skill icons must fit the published 4×4 sheet');
  assert.deepEqual(Object.keys(CAST_ART).sort(), active.map((s) => s.id).sort());
  for (const skill of active)
    assert.ok(SOUND_NAMES.includes(skillSound(skill)), `${skill.id} must resolve to a cast sound`);
  for (const frames of [SKILL_ART, CAST_ART]) {
    const all = Object.values(frames);
    assert.equal(new Set(all.map((f) => `${f.src}/${f.column}/${f.row}`)).size, all.length);
    for (const src of new Set(all.map((f) => f.src))) {
      const file = readFileSync(new URL(`../public/${src}`, import.meta.url));
      assert.equal(file.toString('ascii', 8, 12), 'WEBP');
    }
  }
  // A semi-opaque matte on cell corners draws a visible rectangle during attacks.
  for (const src of new Set(Object.values(CAST_ART).map((frame) => frame.src))) {
    const { data, info } = await sharp(readFileSync(new URL(`../public/${src}`, import.meta.url)))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const cellWidth = info.width / 4,
      cellHeight = info.height / 2;
    for (let row = 0; row < 2; row++)
      for (let column = 0; column < 4; column++) {
        for (const [dx, dy] of [
          [0, 0],
          [cellWidth - 1, 0],
          [0, cellHeight - 1],
          [cellWidth - 1, cellHeight - 1],
        ]) {
          const alpha =
            data[((row * cellHeight + dy) * info.width + column * cellWidth + dx) * 4 + 3];
          assert.ok(alpha <= 4, `${src} cell ${column}/${row} has a rectangular matte (${alpha})`);
        }
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
  assert.equal(getItemVisual(first).key, 'class-hand:ranger:weapon');
  const legacy = { ...first, classId: undefined, name: '暮色武器' };
  assert.equal(getItemVisual(legacy).key, 'ordinary:暮色:weapon');
  assert.equal(itemClass(legacy), undefined);
  assert.notEqual(getItemVisual(first), getItemVisual({ ...first, slot: 'chest' }));
  assert.equal(
    getItemVisual({ ...legacy, name: `【太古】${legacy.name}`, rarity: 'primal' }),
    getItemVisual(legacy),
  );
  const visuals = CLASSES.flatMap(({ id }) => {
    for (const slot of ['chest', 'jewelry'] as const)
      assert.equal(itemClass(generateLoot(id, 1, { slot, rarity: 'rare' })), undefined);
    return (['weapon', 'offhand'] as const).map((slot) => {
      const item = generateLoot(id, 1, { slot, rarity: 'rare', gambling: true });
      assert.equal(itemClass(item), id);
      assert.ok(item.name.endsWith(CLASS_HAND_EQUIPMENT[id][slot].name));
      const visual = getItemVisual(item);
      assert.ok(EQUIPMENT_DROP_CATALOG.includes(visual));
      return geometry(visual);
    });
  });
  assert.equal(new Set(visuals).size, 10);
});
