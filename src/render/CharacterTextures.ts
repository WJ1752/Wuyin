import { Assets, Texture } from 'pixi.js';
import type { ClassId } from '../core/types';
import { EQUIPMENT_ATLAS, EQUIPMENT_DROP_CATALOG } from '../data/visuals';
import { preloadAtlas } from './TextureAtlas';

/** Shared by the town portrait, inventory preview and combat rig. */
export const CHARACTER_ART: Record<ClassId, { src: string; anchorX: number; ground: number }> = {
  ranger: { src: './assets/characters/hd/ranger.webp', anchorX: 0.5, ground: 496 / 512 },
  barbarian: { src: './assets/characters/hd/barbarian.webp', anchorX: 0.5, ground: 496 / 512 },
  sorcerer: { src: './assets/characters/hd/sorcerer.webp', anchorX: 0.5, ground: 496 / 512 },
  necromancer: { src: './assets/characters/hd/necromancer.webp', anchorX: 0.5, ground: 496 / 512 },
  druid: { src: './assets/characters/hd/druid.webp', anchorX: 0.5, ground: 496 / 512 },
};

const characters = new Map<ClassId, Texture>();
const equipmentFrames: [string, number, number][] = EQUIPMENT_DROP_CATALOG.map(({ key }, index) => [
  key,
  index % EQUIPMENT_ATLAS.columns,
  Math.floor(index / EQUIPMENT_ATLAS.columns),
]);

/** Combat uses the class sprite for actors and the equipment atlas for ground drops. */
export async function preloadCharacterTextures(classId: ClassId): Promise<void> {
  await Promise.all([
    Assets.load<Texture>(CHARACTER_ART[classId].src).then((texture) => {
      texture.source.scaleMode = 'nearest';
      characters.set(classId, texture);
    }),
    preloadAtlas(
      EQUIPMENT_ATLAS.src,
      EQUIPMENT_ATLAS.columns,
      EQUIPMENT_ATLAS.rows,
      equipmentFrames,
      'nearest',
    ),
  ]);
}

export function getCharacterTexture(classId: ClassId): Texture | undefined {
  return characters.get(classId);
}
