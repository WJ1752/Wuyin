import { Assets, Texture } from 'pixi.js';
import type { ClassId, Item, SaveData } from '../core/types';
import { getItemAppearanceKey, getItemSvg } from '../data/visuals';

/** Shared by the town portrait, inventory preview and combat rig. */
export const CHARACTER_ART: Record<ClassId, { src: string; anchorX: number; ground: number }> = {
  ranger: { src: './assets/characters/ranger.png', anchorX: 0.53, ground: 0.946 },
  barbarian: { src: './assets/characters/barbarian.png', anchorX: 0.47, ground: 0.928 },
  sorcerer: { src: './assets/characters/sorcerer.png', anchorX: 0.55, ground: 0.937 },
  necromancer: { src: './assets/characters/necromancer.png', anchorX: 0.43, ground: 0.921 },
  druid: { src: './assets/characters/druid.png', anchorX: 0.53, ground: 0.938 },
};

const characters = new Map<ClassId, Texture>();
const equipmentTextures = new Map<string, Texture>();

/** Await before creating a hero; Assets deduplicates concurrent preview/combat requests. */
export async function preloadCharacterTextures(
  classId: ClassId,
  equipment: SaveData['equipment'] = {},
): Promise<void> {
  await Promise.all([
    Assets.load<Texture>(CHARACTER_ART[classId].src).then((texture) => {
      texture.source.scaleMode = 'nearest';
      characters.set(classId, texture);
    }),
    ...Object.values(equipment).map(async (item) => {
      if (!item) return;
      const key = getItemAppearanceKey(item);
      if (equipmentTextures.has(key)) return;
      const texture = await Assets.load<Texture>(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(getItemSvg(item))}`,
      );
      texture.source.scaleMode = 'nearest';
      equipmentTextures.set(key, texture);
    }),
  ]);
}

export function getCharacterTexture(classId: ClassId): Texture | undefined {
  return characters.get(classId);
}

export function getEquipmentTexture(item: Item): Texture | undefined {
  return equipmentTextures.get(getItemAppearanceKey(item));
}
