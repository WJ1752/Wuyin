import { Assets, Texture } from 'pixi.js';
import type { ClassId, Item, SaveData } from '../core/types';
import { getAtlasTexture, preloadAtlas } from './TextureAtlas';
import {
  EQUIPMENT_ATLAS,
  EQUIPMENT_DROP_CATALOG,
  EQUIPMENT_SHAPES,
  getItemVisual,
  getItemAppearanceKey,
  getItemSvg,
} from '../data/visuals';

/** Shared by the town portrait, inventory preview and combat rig. */
export const CHARACTER_ART: Record<ClassId, { src: string; anchorX: number; ground: number }> = {
  ranger: { src: './assets/characters/ranger.png', anchorX: 0.46, ground: 83 / 88 },
  barbarian: { src: './assets/characters/barbarian.png', anchorX: 0.47, ground: 83 / 88 },
  sorcerer: { src: './assets/characters/sorcerer.png', anchorX: 0.49, ground: 83 / 88 },
  necromancer: { src: './assets/characters/necromancer.png', anchorX: 0.43, ground: 83 / 88 },
  druid: { src: './assets/characters/druid.png', anchorX: 0.5, ground: 83 / 88 },
};

const characters = new Map<ClassId, Texture>();
const armedStances = new Map<ClassId, Texture>();
const wornFrames: [string, number, number][] = EQUIPMENT_SHAPES.map((shape, i) => [
  `worn:${shape}`,
  i % 5,
  Math.floor(i / 5),
]);
const fallbackEquipment = new Map<string, Texture>();
const frames: [string, number, number][] = EQUIPMENT_DROP_CATALOG.map(({ key }, index) => [
  key,
  index % EQUIPMENT_ATLAS.columns,
  Math.floor(index / EQUIPMENT_ATLAS.columns),
]);

/** Await before creating a hero; Assets deduplicates concurrent preview/combat requests. */
export async function preloadCharacterTextures(
  classId: ClassId,
  equipment: SaveData['equipment'] = {},
): Promise<void> {
  const wearingGear = Object.values(equipment).some(Boolean);
  await Promise.all([
    wearingGear && preloadAtlas('./assets/maps/equipment-shapes.png', 5, 5, wornFrames, 'nearest'),
    equipment.weapon &&
      classId !== 'druid' &&
      Assets.load<Texture>(`./assets/characters/${classId}-armed.png`)
        .then((stance) => {
          stance.source.scaleMode = 'nearest';
          armedStances.set(classId, stance);
        })
        .catch(() => {
          /* Keep the normal stance when an alternate pose is unavailable. */
        }),
    Assets.load<Texture>(CHARACTER_ART[classId].src).then((texture) => {
      texture.source.scaleMode = 'nearest';
      characters.set(classId, texture);
    }),
    preloadAtlas(
      EQUIPMENT_ATLAS.src,
      EQUIPMENT_ATLAS.columns,
      EQUIPMENT_ATLAS.rows,
      frames,
      'nearest',
    ),
  ]);
  await Promise.all(
    Object.values(equipment).map(async (item) => {
      if (!item || getEquipmentTexture(item)) return;
      const texture = await Assets.load<Texture>(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(getItemSvg(item))}`,
      );
      texture.source.scaleMode = 'nearest';
      fallbackEquipment.set(getItemAppearanceKey(item), texture);
    }),
  );
}

export function getCharacterTexture(classId: ClassId, armed = false): Texture | undefined {
  return (armed && armedStances.get(classId)) || characters.get(classId);
}

export function getEquipmentTexture(item: Item): Texture | undefined {
  const key = getItemAppearanceKey(item);
  return (
    getAtlasTexture(`worn:${getItemVisual(item).shape}`) ??
    getAtlasTexture(key) ??
    fallbackEquipment.get(key)
  );
}
