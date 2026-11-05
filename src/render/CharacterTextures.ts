import { Assets, Texture } from 'pixi.js';
import type { ClassId } from '../core/types';
import { EQUIPMENT_ATLAS, EQUIPMENT_DROP_CATALOG } from '../data/visuals';
import { preloadAtlas } from './TextureAtlas';

/** Shared by the town portrait, inventory preview and combat rig. */
export const CHARACTER_ART: Record<ClassId, { src: string; anchorX: number; ground: number }> = {
  ranger: { src: './assets/characters/ranger.png', anchorX: 0.46, ground: 83 / 88 },
  barbarian: { src: './assets/characters/barbarian.png', anchorX: 0.47, ground: 83 / 88 },
  sorcerer: { src: './assets/characters/sorcerer.png', anchorX: 0.49, ground: 83 / 88 },
  necromancer: { src: './assets/characters/necromancer.png', anchorX: 0.43, ground: 83 / 88 },
  druid: { src: './assets/characters/druid.png', anchorX: 0.5, ground: 83 / 88 },
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
