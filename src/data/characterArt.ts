import type { ClassId, Item, Slot } from '../core/types';

const painted = (classId: ClassId, suffix = '') => ({
  src: `./assets/characters/painted/${classId}${suffix}.webp`,
  walk: `./assets/characters/painted/${classId}${suffix}-walk.webp`,
  action: `./assets/characters/painted/${classId}${suffix}-action.webp`,
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

type HeldItem = Pick<Item, 'slot' | 'classId' | 'legendaryId'>;
export type WornArt = Partial<Record<Slot, HeldItem>> | readonly HeldItem[];
const signatureItems: Record<ClassId, string> = {
  ranger: 'dawn',
  barbarian: 'judgment',
  sorcerer: 'grand_vizier',
  necromancer: 'bloodtide',
  druid: 'greenstone',
};
const signatures = Object.fromEntries(
  (Object.keys(CHARACTER_ART) as ClassId[]).map((id) => [id, painted(id, '-equipped')]),
) as typeof CHARACTER_ART;

export function getCharacterArt(classId: ClassId, equipment?: WornArt) {
  return equipment &&
    Object.values(equipment).some(
      (item) =>
        item &&
        (item.legendaryId === signatureItems[classId] ||
          (item.classId === classId &&
            !item.legendaryId &&
            ((classId === 'barbarian' && item.slot === 'weapon') ||
              (classId === 'necromancer' && item.slot === 'offhand')))),
    )
    ? signatures[classId]
    : CHARACTER_ART[classId];
}
