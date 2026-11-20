import { Assets, Texture } from 'pixi.js';
import type { ClassId } from '../core/types';
import { EQUIPMENT_ATLAS, EQUIPMENT_DROP_CATALOG } from '../data/visuals';
import { preloadAtlas } from './TextureAtlas';

const painted = (classId: ClassId) => ({
  src: `./assets/characters/painted/${classId}.webp`,
  walk: `./assets/characters/painted/${classId}-walk.webp`,
  action: `./assets/characters/painted/${classId}-action.webp`,
  anchorX: 0.5,
  ground: 124 / 128,
});

/** Shared by the camp, inventory preview and combat rig. */
export const CHARACTER_ART = {
  ranger: painted('ranger'),
  barbarian: painted('barbarian'),
  sorcerer: painted('sorcerer'),
  necromancer: painted('necromancer'),
  druid: painted('druid'),
};

export type CharacterPose = 'idle' | 'walk' | 'action';
const characters = new Map<ClassId, Record<CharacterPose, Texture>>();
const equipmentFrames: [string, number, number][] = EQUIPMENT_DROP_CATALOG.map(({ key }, index) => [
  key,
  index % EQUIPMENT_ATLAS.columns,
  Math.floor(index / EQUIPMENT_ATLAS.columns),
]);

/** Combat uses the class sprite for actors and the equipment atlas for ground drops. */
export async function preloadCharacterTextures(classId: ClassId): Promise<void> {
  const art = CHARACTER_ART[classId];
  await Promise.all([
    Promise.all([art.src, art.walk, art.action].map((url) => Assets.load<Texture>(url))).then(
      ([idle, walk, action]) => {
        idle.source.scaleMode = walk.source.scaleMode = action.source.scaleMode = 'nearest';
        characters.set(classId, { idle, walk, action });
      },
    ),
    preloadAtlas(
      EQUIPMENT_ATLAS.src,
      EQUIPMENT_ATLAS.columns,
      EQUIPMENT_ATLAS.rows,
      equipmentFrames,
      'nearest',
    ),
  ]);
}

export function getCharacterTexture(classId: ClassId, pose: CharacterPose = 'idle') {
  return characters.get(classId)?.[pose];
}
