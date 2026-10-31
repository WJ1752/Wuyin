import type { ClassId, Item, Rarity, Slot } from '../core/types';
import { SLOTS, SLOT_NAMES } from '../core/types';
import { AFFIXES } from '../data/affixes';
import { SETS } from '../data/sets';
import { LEGENDARIES } from '../data/legendaries';
import { getLootProfile, type LootSource } from '../data/progression';

export interface LootOptions {
  slot?: Slot;
  rarity?: Rarity;
  setId?: string;
  legendaryId?: string;
  primal?: boolean;
  gambling?: boolean;
  source?: LootSource;
  ownedSetPieces?: string[];
  rng?: () => number;
}
export function generateLoot(classId: ClassId, level: number, options: LootOptions = {}): Item {
  const random = options.rng ?? Math.random;
  const pick = <T>(values: T[]) =>
    values[Math.min(values.length - 1, Math.floor(random() * values.length))];
  let slot = options.slot ?? pick(SLOTS);
  const profile = getLootProfile(level, options.source ?? (options.gambling ? 'gamble' : 'world'));
  let roll = random();
  let rarity: Rarity =
    options.rarity ??
    (Object.entries(profile.chances).find(([, chance]) => (roll -= chance) < 0)?.[0] as Rarity) ??
    'uncommon';
  const primal = options.primal || rarity === 'primal';
  if (rarity === 'primal') rarity = random() < 0.45 ? 'set' : 'legendary';
  let set = SETS.find((s) => s.id === options.setId);
  let legendary = LEGENDARIES.find((l) => l.id === options.legendaryId);
  if (legendary) {
    set = undefined;
    rarity = 'legendary';
    slot = legendary.slot;
  } else if (set) rarity = 'set';
  if (set || rarity === 'set') {
    set ??= pick(SETS.filter((s) => s.classId === classId));
    const armor: Slot[] = ['head', 'chest', 'hands', 'legs', 'feet'];
    if (!options.slot) {
      const setId = set.id;
      const missing = armor.filter((s) => !options.ownedSetPieces?.includes(`${setId}:${s}`));
      slot = pick(missing.length ? missing : armor);
    } else if (!armor.includes(slot)) {
      set = undefined;
      rarity = 'legendary';
    }
  }
  if (!set && (legendary || rarity === 'legendary')) {
    const candidates = LEGENDARIES.filter(
      (l) => (!l.classId || l.classId === classId) && l.slot === slot,
    );
    if (!legendary && !candidates.length && options.slot) {
      if (level >= 31 && ['head', 'chest', 'hands', 'legs', 'feet'].includes(slot)) {
        set = pick(SETS.filter((s) => s.classId === classId));
        rarity = 'set';
      } else rarity = 'epic';
    } else {
      legendary ??= pick(
        candidates.length
          ? candidates
          : LEGENDARIES.filter((l) => !l.classId || l.classId === classId),
      );
      slot = legendary.slot;
    }
  }
  if (primal) rarity = 'primal';
  else if (set) rarity = 'set';
  else if (legendary) rarity = 'legendary';
  const quality = primal
    ? 1.3
    : {
        common: 0.42,
        uncommon: 0.56,
        rare: 0.68,
        epic: 0.8,
        legendary: 0.9,
        set: 0.9,
        primal: 1.3,
      }[rarity] +
      random() * 0.1;
  const affixQuality = {
    common: 0.18,
    uncommon: 0.3,
    rare: 0.5,
    epic: 0.72,
    legendary: 1,
    set: 1,
    primal: 1,
  }[rarity];
  const scale = 1 + Math.max(0, level - 1) * 0.085;
  const pool = [...AFFIXES];
  const affixes = [];
  for (
    let i = 0;
    i < (set || legendary ? 4 : rarity === 'common' ? 1 : rarity === 'epic' ? 3 : 2);
    i++
  ) {
    const total = pool.reduce((sum, a) => sum + a.weight, 0);
    let weight = random() * total;
    let index = pool.findIndex((a) => (weight -= a.weight) <= 0);
    if (index < 0) index = pool.length - 1;
    const [affix] = pool.splice(index, 1);
    affixes.push({
      id: affix.id,
      value: primal
        ? affix.max * 1.3
        : Math.round((affix.min + random() * (affix.max - affix.min) * affixQuality) * 10000) /
          10000,
    });
  }
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${random().toString(36).slice(2)}`,
    name: `${primal ? '【太古】' : ''}${set ? `${set.name} · ${SLOT_NAMES[slot]}` : (legendary?.name ?? `${{ common: '旅人', uncommon: '守望', rare: '暮色', epic: '幽影', legendary: '圣遗', set: '契约', primal: '永恒' }[rarity]}${SLOT_NAMES[slot]}`)}`,
    slot,
    rarity,
    level,
    attack: Math.round(
      (slot === 'weapon' ? 30 : slot === 'offhand' ? 12 : slot === 'jewelry' ? 8 : 0) *
        scale *
        quality,
    ),
    armor: Math.round((slot === 'weapon' || slot === 'jewelry' ? 0 : 18) * scale * quality),
    affixes,
    setId: set?.id,
    legendaryId: legendary?.id,
    power: legendary
      ? primal
        ? legendary.max
        : legendary.min + random() * (legendary.max - legendary.min)
      : 0,
  };
}
