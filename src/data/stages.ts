import type { StageDef } from '../core/types';

export const THEMES = [
  {
    id: 0,
    name: '幽暗密林',
    subtitle: 'THE WEEPING WOODS',
    ground: '#171f1e',
    accent: '#7da99b',
    fog: '#6c9182',
    lore: '钟声越过枯木，找不到回家的路。',
  },
  {
    id: 1,
    name: '荒芜墓园',
    subtitle: 'GRAVES OF THE FORGOTTEN',
    ground: '#20202a',
    accent: '#a6a0be',
    fog: '#8a829e',
    lore: '墓碑上的名字被雨水抹去，亡者却记得你。',
  },
  {
    id: 2,
    name: '熔火地狱',
    subtitle: 'THE CINDER DEPTHS',
    ground: '#281e1b',
    accent: '#cb8b61',
    fog: '#9f5842',
    lore: '大地的伤口仍在流火，旧神的心脏仍在跳动。',
  },
  {
    id: 3,
    name: '虚空圣殿',
    subtitle: 'SANCTUM OF THE VOID',
    ground: '#1e1c2d',
    accent: '#ad8bd0',
    fog: '#78629f',
    lore: '群星沉默之后，神殿终于听见自己的祷声。',
  },
];
const torment = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
  'XIII',
  'XIV',
  'XV',
  'XVI',
];
export const STAGES: StageDef[] = Array.from({ length: 150 }, (_, index) => {
  const level = index + 1;
  const theme = Math.floor(index / 5) % THEMES.length;
  return {
    level,
    theme,
    name: THEMES[theme].name,
    difficulty:
      level <= 15
        ? '普通'
        : level <= 30
          ? '困难'
          : level <= 50
            ? '大师'
            : `折磨 ${torment[Math.min(15, Math.floor(((level - 51) * 16) / 100))]}`,
    // The opening chapters are balanced for a learner, then a first legendary,
    // then two set pieces. Full build pressure begins after the four-piece gift.
    hpMultiplier:
      Math.pow(1.08, Math.min(index, 14)) *
      Math.pow(1.11, Math.max(0, Math.min(index - 14, 15))) *
      Math.pow(1.12, Math.max(0, Math.min(index - 29, 15))) *
      Math.pow(1.16, Math.max(0, Math.min(index, 99) - 44)) *
      // Beyond floor 100, gear upgrades must still move the guardian's five-minute timer.
      Math.pow(1.065, Math.max(0, index - 99)),
    damageMultiplier:
      Math.pow(1.025, Math.min(index, 44)) * Math.pow(1.035, Math.max(0, index - 44)),
    reward: Math.round(150 + level * 45 + Math.pow(level, 1.35) * 8),
  };
});
export const RIFT_RULES = {
  timeLimit: 300,
  waveInterval: 5,
  normalProgressMin: 0.8,
  normalProgressMax: 1.5,
  eliteOrbs: 3,
  orbProgress: 12,
  healthGlobeChance: 0.25,
  healthGlobeHeal: 0.15,
  healthGlobeResource: 10,
  pylonsPerStage: 2,
  pylonDuration: 25,
  goblinChance: 0.18,
  goblinEscapeSeconds: 5,
  speedClearRemaining: 200,
  maxLevel: 150,
} as const;
export const PYLONS = [
  {
    id: 'conduit',
    name: '电击圣坛',
    color: '#c2e4ed',
    description: '每0.15秒向5个敌人释放雷霆。',
    duration: 25,
  },
  {
    id: 'power',
    name: '威能圣坛',
    color: '#e9bc68',
    description: '最终伤害乘以3，体型放大20%。',
    duration: 25,
  },
  {
    id: 'speed',
    name: '疾风圣坛',
    color: '#98d2be',
    description: '移速+60%，攻速+50%，无视碰撞并击晕沿途敌人。',
    duration: 25,
  },
  {
    id: 'channeling',
    name: '引导圣坛',
    color: '#b597df',
    description: '冷却缩减锁定80%，技能不消耗资源。',
    duration: 25,
  },
];
