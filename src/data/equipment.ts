import { SLOT_NAMES, type ClassId, type Item, type Rarity, type Slot } from '../core/types';
import { LEGENDARIES } from './legendaries';
import { SETS } from './sets';

export const EQUIPMENT_PREFIX: Record<Rarity, string> = {
  common: '旅人',
  uncommon: '守望',
  rare: '暮色',
  epic: '幽影',
  legendary: '圣遗',
  set: '契约',
  primal: '永恒',
};

type HandSlot = 'weapon' | 'offhand';

export function isHandSlot(slot: Slot): slot is HandSlot {
  return slot === 'weapon' || slot === 'offhand';
}

export const CLASS_HAND_EQUIPMENT = {
  ranger: {
    weapon: { name: '雾梢长弓', shape: 'bow', motif: 'hunting_arrow' },
    offhand: { name: '哨羽箭袋', shape: 'quiver', motif: 'steady_aim' },
  },
  barbarian: {
    weapon: { name: '铆脊战锤', shape: 'hammer', motif: 'ancestor_hammer' },
    offhand: { name: '界石圆盾', shape: 'offhand', motif: 'war_cry' },
  },
  sorcerer: {
    weapon: { name: '折星法杖', shape: 'staff', motif: 'magic_missile' },
    offhand: { name: '棱镜法珠', shape: 'orb', motif: 'elemental_exposure' },
  },
  necromancer: {
    weapon: { name: '渡骨长镰', shape: 'scythe', motif: 'death_scythe' },
    offhand: { name: '巡冥提灯', shape: 'lantern', motif: 'final_service' },
  },
  druid: {
    weapon: { name: '狼脊双刃', shape: 'dual', motif: 'flying_blade' },
    offhand: { name: '古根图腾', shape: 'totem', motif: 'earthen_bulwark' },
  },
} as const satisfies Record<
  ClassId,
  Record<HandSlot, { name: string; shape: string; motif: string }>
>;

type Identity = Pick<Item, 'slot' | 'classId' | 'legendaryId' | 'setId'>;

export function itemClass(item: Identity): ClassId | undefined {
  if (item.setId) return SETS.find((set) => set.id === item.setId)?.classId;
  if (item.legendaryId)
    return LEGENDARIES.find((legendary) => legendary.id === item.legendaryId)?.classId;
  return isHandSlot(item.slot) ? item.classId : undefined;
}

export function equipmentName(item: Identity & Pick<Item, 'rarity'> & { name?: string }): string {
  const prefix = item.rarity === 'primal' ? '【太古】' : '';
  const legendary = item.legendaryId && LEGENDARIES.find(({ id }) => id === item.legendaryId);
  if (legendary) return prefix + legendary.name;
  const set = item.setId && SETS.find(({ id }) => id === item.setId);
  if (set) return `${prefix}${set.name} · ${SLOT_NAMES[item.slot]}`;
  const series = EQUIPMENT_PREFIX[item.rarity];
  const classId = itemClass(item);
  if (classId && isHandSlot(item.slot))
    return `${prefix}${series} · ${CLASS_HAND_EQUIPMENT[classId][item.slot].name}`;
  return item.name || `${prefix}${series}${SLOT_NAMES[item.slot]}`;
}
