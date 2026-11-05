import type { ClassId, Rarity, SaveData, SkillDef } from '../core/types';
import { SKILLS } from './skillTrees';
import { SETS } from './sets';

export const HUNT_LIMIT = 30;

export function campRates(save: SaveData) {
  // Records contain solo victories, sorted by stage. Three clears at or above a tier prove it.
  const stableStage = save.runRecords?.[2]?.stage ?? 0;
  const tier = Math.floor(stableStage / 10);
  const shards = save.progression?.campFocus === 'shards';
  return {
    stableStage,
    gold: 120 + 20 * (save.progression?.clearedStage ?? 0),
    crystals: shards ? 4 : 4 + tier * 2,
    shards: shards ? tier * 3 : 0,
  };
}
export function settleCamp(save: SaveData, now = Date.now()) {
  const hours = Math.max(0, Math.min(8, (now - save.lastSaved) / 3600000));
  save.lastSaved = now;
  if (hours < 0.05) return '';
  const rates = campRates(save);
  const gold = Math.floor(hours * rates.gold);
  const crystals = Math.floor(hours * rates.crystals);
  const shards = Math.floor(hours * rates.shards);
  save.gold += gold;
  save.crystals += crystals;
  save.shards += shards;
  return `离线营地收益：${gold} 金币 · ${crystals} 结晶 · ${shards} 碎片（最多 8 小时）`;
}

export type LootSource = 'world' | 'boss' | 'goblin' | 'gamble';
// Class-specific world loot uses this split; universal items remain usable by all.
export const SMART_LOOT_CURRENT_CLASS_CHANCE = 0.8;
export const RARITY_UNLOCK_STAGE: Record<Rarity, number> = {
  common: 1,
  uncommon: 1,
  rare: 4,
  epic: 8,
  legendary: 16,
  set: 31,
  primal: 71,
};
const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'set', 'primal'];
// Include the last stage before every unlock, so locked weights never leak into
// normalization and a new chapter introduces its rarity a little at a time.
const LOOT_CURVE = [
  { stage: 1, weights: [62, 38, 0, 0, 0, 0, 0] },
  { stage: 3, weights: [54, 46, 0, 0, 0, 0, 0] },
  { stage: 4, weights: [51, 47, 2, 0, 0, 0, 0] },
  { stage: 7, weights: [36, 45, 19, 0, 0, 0, 0] },
  { stage: 8, weights: [33, 45, 20, 2, 0, 0, 0] },
  { stage: 15, weights: [12, 27, 43, 18, 0, 0, 0] },
  { stage: 16, weights: [11, 26, 42, 20, 1, 0, 0] },
  { stage: 30, weights: [3, 12, 34, 33, 18, 0, 0] },
  { stage: 31, weights: [3, 11, 33, 34, 18, 1, 0] },
  { stage: 50, weights: [1, 5, 20, 31, 27, 16, 0] },
  { stage: 70, weights: [1, 3, 13, 27, 34, 22, 0] },
  { stage: 71, weights: [1, 3, 12.8, 27, 34, 22, 0.2] },
  { stage: 100, weights: [0, 2, 10, 23, 36, 28, 1] },
  { stage: 150, weights: [0, 1, 6, 18, 38, 34, 3] },
];

export function getLootProfile(stage: number, source: LootSource = 'world') {
  stage = Math.max(1, Math.min(150, Math.floor(stage)));
  const high = LOOT_CURVE.find((point) => point.stage >= stage) ?? LOOT_CURVE.at(-1)!;
  const low = [...LOOT_CURVE].reverse().find((point) => point.stage <= stage)!;
  const t = high.stage === low.stage ? 0 : (stage - low.stage) / (high.stage - low.stage);
  const weights = RARITIES.map((rarity, i) => {
    if (stage < RARITY_UNLOCK_STAGE[rarity]) return 0;
    const bonus =
      source === 'boss' ? 0.13 : source === 'goblin' ? 0.1 : source === 'gamble' ? 0.07 : 0;
    return (low.weights[i] + (high.weights[i] - low.weights[i]) * t) * (1 + i * bonus);
  });
  const total = weights.reduce((sum, value) => sum + value, 0);
  const chances = Object.fromEntries(
    RARITIES.map((rarity, i) => [rarity, weights[i] / total]),
  ) as Record<Rarity, number>;
  const label =
    stage < 16
      ? '普通 · 旅人启程'
      : stage < 31
        ? '困难 · 传奇初鸣'
        : stage < 51
          ? '大师 · 套装共鸣'
          : stage < 71
            ? '折磨 · 流派成型'
            : '深层折磨 · 太古追寻';
  return { stage, label, chances };
}

export function isSkillAutoEnabled(autoSkills: Record<string, boolean>, skill: SkillDef) {
  return autoSkills[skill.id] ?? skill.kind !== 'movement';
}

export function starterSkills(classId: ClassId): Record<string, number> {
  const basic = SKILLS.find((skill) => skill.classId === classId && skill.kind === 'basic')!;
  return { [basic.id]: 1 };
}

type SkillSave = Pick<SaveData, 'classId' | 'level' | 'skills'>;
export function availableSkillPoints(save: SkillSave) {
  const spent = SKILLS.filter((skill) => skill.classId === save.classId).reduce(
    (sum, skill) => sum + (save.skills[skill.id] ?? 0),
    0,
  );
  return Math.max(0, 1 + (save.level - 1) * 2 - spent);
}

export function skillUnlockLevel(skill: SkillDef): number {
  if (skill.kind === 'basic') return skill.id in starterSkills(skill.classId) ? 1 : 2;
  if (skill.kind === 'passive') {
    const tierLevel = [3, 7, 10, 14, 18][skill.tier - 1] ?? 18;
    const parent = SKILLS.find((node) => node.id === skill.parent);
    return Math.max(tierLevel, parent ? skillUnlockLevel(parent) + 3 : 0);
  }
  return { movement: 3, core: 5, control: 8, defense: 10, ultimate: 15 }[skill.kind];
}

export function skillLearningStatus(save: SkillSave, skill: SkillDef) {
  const rank = save.skills[skill.id] ?? 0;
  const unlockLevel = skillUnlockLevel(skill);
  const requiredLevel = unlockLevel + rank * 3;
  const maxRank = Math.max(0, Math.min(5, 1 + Math.floor((save.level - unlockLevel) / 3)));
  const parentRank = skill.parent ? 2 : 0;
  const reason =
    skill.classId !== save.classId
      ? '当前职业无法学习'
      : rank >= 5
        ? '已达满级'
        : save.level < requiredLevel
          ? `角色 Lv.${requiredLevel} 可${rank ? '升级' : '学习'}`
          : skill.parent && (save.skills[skill.parent] ?? 0) < parentRank
            ? `前置「${SKILLS.find((node) => node.id === skill.parent)!.name}」需达到 2 级`
            : availableSkillPoints(save) < 1
              ? '升级角色获得技能点（每级 2 点）'
              : '';
  return { rank, unlockLevel, requiredLevel, maxRank, parentRank, canLearn: !reason, reason };
}

export const PROGRESSION_MILESTONES = [
  { stage: 4, title: '第一件稀有武器', detail: '获得一件本职业稀有武器', rarity: 'rare' as Rarity },
  {
    stage: 8,
    title: '史诗的回响',
    detail: '获得一件史诗武器，开始搭配词条',
    rarity: 'epic' as Rarity,
  },
  { stage: 16, title: '传奇初鸣', detail: '获得一件本职业传奇武器', rarity: 'legendary' as Rarity },
  { stage: 31, title: '契约之始', detail: '获得目标套装的首个缺失部件', rarity: 'set' as Rarity },
  {
    stage: 35,
    title: '双件共鸣',
    detail: '再获一个缺失部件，追寻 2 件套效果',
    rarity: 'set' as Rarity,
  },
  {
    stage: 40,
    title: '流派拼图',
    detail: '再获一个缺失部件，向完整套装迈进',
    rarity: 'set' as Rarity,
  },
  {
    stage: 45,
    title: '四件成型',
    detail: '再获一个缺失部件，开启 4 件套玩法',
    rarity: 'set' as Rarity,
  },
  {
    stage: 71,
    title: '太古试炼',
    detail: '获得首件满值太古传奇，开启深层追寻',
    rarity: 'primal' as Rarity,
  },
] as const;

export function progressionSet(save: Pick<SaveData, 'classId' | 'progression'>) {
  return (
    SETS.find((set) => set.id === save.progression?.targetSetId && set.classId === save.classId) ??
    SETS.find((set) => set.classId === save.classId)!
  );
}

export function getProgressionMilestones(save: Pick<SaveData, 'classId' | 'progression'>) {
  return PROGRESSION_MILESTONES.map((milestone) => ({
    ...milestone,
    claimed:
      save.progression?.claimedMilestones.includes(`${save.classId}:${milestone.stage}`) ?? false,
  }));
}
