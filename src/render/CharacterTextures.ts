import { Assets, Texture } from 'pixi.js';
import type { ClassId } from '../core/types';
import { EQUIPMENT_ATLAS, EQUIPMENT_DROP_CATALOG } from '../data/visuals';
import { preloadAtlas } from './TextureAtlas';
import { getCharacterArt, type WornArt } from '../data/characterArt';

export { CHARACTER_ART, getCharacterArt, type WornArt } from '../data/characterArt';

export type CharacterPose = 'idle' | 'action';

interface CombatArt {
  hips: readonly [number, number];
  boots: readonly [number, number];
  grip: readonly [number, number];
  offhand: readonly [number, number];
  stride: number;
  bootTravel: number;
  clearance: number;
}

// Anchors in the standing 128px frames. Axe heads and bow limbs use the same
// grip as their owner's hand so the held weapon follows through with it.
export const CHARACTER_COMBAT_ART: Record<ClassId, CombatArt> = {
  ranger: {
    hips: [66, 70],
    boots: [51, 81],
    grip: [94, 62],
    offhand: [53, 68],
    stride: 43,
    bootTravel: 11,
    clearance: 7,
  },
  barbarian: {
    hips: [67, 74],
    boots: [48, 84],
    grip: [91, 70],
    offhand: [47, 73],
    stride: 52,
    bootTravel: 12,
    clearance: 5,
  },
  sorcerer: {
    hips: [62, 66],
    boots: [50, 80],
    grip: [88, 58],
    offhand: [45, 71],
    stride: 47,
    bootTravel: 10,
    clearance: 6,
  },
  necromancer: {
    hips: [60, 70],
    boots: [52, 77],
    grip: [84, 47],
    offhand: [51, 70],
    stride: 50,
    bootTravel: 9,
    clearance: 5,
  },
  druid: {
    hips: [62, 69],
    boots: [51, 86],
    grip: [92, 69],
    offhand: [53, 73],
    stride: 42,
    bootTravel: 12,
    clearance: 9,
  },
};

const characters = new Map<string, Record<CharacterPose, Texture>>();
const equipmentFrames: [string, number, number][] = EQUIPMENT_DROP_CATALOG.map(({ key }, index) => [
  key,
  index % EQUIPMENT_ATLAS.columns,
  Math.floor(index / EQUIPMENT_ATLAS.columns),
]);

export async function preloadCharacterTextures(
  classId: ClassId,
  equipment?: WornArt,
): Promise<void> {
  const art = getCharacterArt(classId, equipment);
  await Promise.all([
    Promise.all([art.src, art.action].map((url) => Assets.load<Texture>(url))).then(
      ([idle, action]) => {
        idle.source.scaleMode = action.source.scaleMode = 'nearest';
        characters.set(art.src, { idle, action });
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

export function getCharacterTexture(
  classId: ClassId,
  pose: CharacterPose = 'idle',
  equipment?: WornArt,
) {
  return characters.get(getCharacterArt(classId, equipment).src)?.[pose];
}
