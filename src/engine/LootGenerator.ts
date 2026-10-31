import type { ClassId, Item, Rarity, Slot } from '../core/types';
import { SLOTS, SLOT_NAMES } from '../core/types';
import { AFFIXES } from '../data/affixes';
import { SETS } from '../data/sets';
import { LEGENDARIES } from '../data/legendaries';

export interface LootOptions {
  slot?: Slot;
  rarity?: Rarity;
  setId?: string;
  legendaryId?: string;
  primal?: boolean;
  gambling?: boolean;
  ownedSetPieces?: string[];
  rng?: () => number;
}
export function generateLoot(classId: ClassId, level: number, options: LootOptions = {}): Item {
  const random = options.rng ?? Math.random;
  const pick = <T>(values: T[]) =>
    values[Math.min(values.length - 1, Math.floor(random() * values.length))];
  let slot = options.slot ?? pick(SLOTS);
  const roll = random();
  let rarity: Rarity =
    options.rarity ??
    (roll < (options.gambling ? 0.3 : 0.14)
      ? 'set'
      : roll < (options.gambling ? 0.67 : 0.4)
        ? 'legendary'
        : roll < 0.7
          ? 'epic'
          : roll < 0.9
            ? 'rare'
            : roll < 0.97
              ? 'uncommon'
              : 'common');
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
  if (!set && (legendary || rarity === 'legendary' || rarity === 'primal')) {
    const candidates = LEGENDARIES.filter(
      (l) => (!l.classId || l.classId === classId) && l.slot === slot,
    );
    if (!legendary && !candidates.length && options.slot) {
      if (['head', 'chest', 'hands', 'legs', 'feet'].includes(slot)) {
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
  const primal =
    options.primal ||
    rarity === 'primal' ||
    ((set || legendary) &&
      random() < Math.min(0.15, 0.08 + level / 2200 + (options.gambling ? 0.02 : 0)));
  if (primal) rarity = 'primal';
  else if (set) rarity = 'set';
  else if (legendary) rarity = 'legendary';
  const quality = primal ? 1.3 : 0.7 + random() * 0.3;
  const scale = 1 + Math.max(0, level - 1) * 0.085;
  const pool = [...AFFIXES];
  const affixes = [];
  for (let i = 0; i < (set || legendary ? 4 : rarity === 'common' ? 1 : 3); i++) {
    const total = pool.reduce((sum, a) => sum + a.weight, 0);
    let weight = random() * total;
    let index = pool.findIndex((a) => (weight -= a.weight) <= 0);
    if (index < 0) index = pool.length - 1;
    const [affix] = pool.splice(index, 1);
    affixes.push({
      id: affix.id,
      value: primal
        ? affix.max * 1.3
        : Math.round((affix.min + random() * (affix.max - affix.min)) * 10000) / 10000,
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
