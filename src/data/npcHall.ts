import type { ClassId } from '../core/types';

export interface HallNpc {
  id: string;
  name: string;
  service: string;
  panel: string;
  classId: ClassId;
  x: number;
  y: number;
  approach: { x: number; y: number };
  color: string;
  greeting: string;
}

/** Normalized ground-plane landmarks shared by scene art, actors and movement. */
export const HALL_LAYOUT = {
  world: { width: 1254, height: 1254 },
  portal: { x: 0.503, y: 0.26 },
  portalPlaza: { x: 0.502, y: 0.365 },
  spawn: { x: 0.5, y: 0.765 },
  centralClear: { left: 0.34, right: 0.66, top: 0.18, bottom: 0.76 },
  northSouthPath: { left: 0.42, right: 0.58, top: 0.25, bottom: 0.97 },
  bounds: { left: 0.1, right: 0.92, top: 0.25, bottom: 0.97 },
} as const;

/** Positions are shared by pointer navigation, keyboard interaction and service signs. */
export const HALL_NPCS: HallNpc[] = [
  {
    id: 'mentor',
    name: '星语导师',
    service: '技能之书',
    panel: 'skills',
    classId: 'sorcerer',
    x: 0.22,
    y: 0.329,
    approach: { x: 0.3, y: 0.344 },
    color: '#bea6ef',
    greeting: '每一次领悟，都会让下一次远征更从容。',
  },
  {
    id: 'cube',
    name: '遗物守望者',
    service: '魔盒共鸣',
    panel: 'cube',
    classId: 'necromancer',
    x: 0.788,
    y: 0.326,
    approach: { x: 0.72, y: 0.345 },
    color: '#88cbbd',
    greeting: '将传奇的力量留在魔盒，让它与你同行。',
  },
  {
    id: 'chronicler',
    name: '远征记录官',
    service: '职业排行榜',
    panel: 'leaderboard',
    classId: 'ranger',
    x: 0.823,
    y: 0.512,
    approach: { x: 0.753, y: 0.521 },
    color: '#dfc98f',
    greeting: '看看各职业行者的战绩，也看看他们的配装。',
  },
  {
    id: 'smith',
    name: '余烬铁匠',
    service: '装备锻造',
    panel: 'forge',
    classId: 'barbarian',
    x: 0.163,
    y: 0.511,
    approach: { x: 0.238, y: 0.514 },
    color: '#ecaa79',
    greeting: '分解、洗练、神铸。好装备需要慢慢打磨。',
  },
  {
    id: 'mia',
    name: '米娅',
    service: '部位秘藏',
    panel: 'gamble',
    classId: 'ranger',
    x: 0.837,
    y: 0.691,
    approach: { x: 0.76, y: 0.691 },
    color: '#d6addd',
    greeting: '带上神秘碎片，挑一件你需要的部位吧。',
  },
  {
    id: 'keeper',
    name: '仓库管理员',
    service: '共享仓库',
    panel: 'stash',
    classId: 'barbarian',
    x: 0.266,
    y: 0.709,
    approach: { x: 0.336, y: 0.718 },
    color: '#d7ba82',
    greeting: '同一账号的行者，都可以使用这里的装备。',
  },
  {
    id: 'tamer',
    name: '荒野契约师',
    service: '伙伴与赛季',
    panel: 'pets',
    classId: 'druid',
    x: 0.735,
    y: 0.833,
    approach: { x: 0.67, y: 0.816 },
    color: '#b9ce8c',
    greeting: '让伙伴跟随你，也别忘了领取赛季奖励。',
  },
];

export function clampHallPosition(x: number, y: number) {
  const { left, right, top, bottom } = HALL_LAYOUT.bounds;
  return { x: Math.max(left, Math.min(right, x)), y: Math.max(top, Math.min(bottom, y)) };
}
