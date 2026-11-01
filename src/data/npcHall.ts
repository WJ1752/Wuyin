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
  world: { width: 1296, height: 1216 },
  portal: { x: 0.5, y: 0.28 },
  portalPlaza: { x: 0.5, y: 0.45 },
  spawn: { x: 0.5, y: 0.85 },
  centralClear: { left: 0.34, right: 0.66, top: 0.18, bottom: 0.76 },
  northSouthPath: { left: 0.41, right: 0.59, top: 0.22, bottom: 0.97 },
  bounds: { left: 0.07, right: 0.93, top: 0.22, bottom: 0.97 },
} as const;

/** Positions are shared by pointer navigation, keyboard interaction and service signs. */
export const HALL_NPCS: HallNpc[] = [
  {
    id: 'mentor',
    name: '星语导师',
    service: '技能之书',
    panel: 'skills',
    classId: 'sorcerer',
    x: 0.2,
    y: 0.35,
    approach: { x: 0.28, y: 0.38 },
    color: '#bea6ef',
    greeting: '每一次领悟，都会让下一次远征更从容。',
  },
  {
    id: 'cube',
    name: '遗物守望者',
    service: '魔盒共鸣',
    panel: 'cube',
    classId: 'necromancer',
    x: 0.8,
    y: 0.35,
    approach: { x: 0.72, y: 0.38 },
    color: '#88cbbd',
    greeting: '将传奇的力量留在魔盒，让它与你同行。',
  },
  {
    id: 'chronicler',
    name: '远征记录官',
    service: '职业排行榜',
    panel: 'leaderboard',
    classId: 'ranger',
    x: 0.85,
    y: 0.6,
    approach: { x: 0.75, y: 0.6 },
    color: '#dfc98f',
    greeting: '看看各职业行者的战绩，也看看他们的配装。',
  },
  {
    id: 'smith',
    name: '余烬铁匠',
    service: '装备锻造',
    panel: 'forge',
    classId: 'barbarian',
    x: 0.15,
    y: 0.58,
    approach: { x: 0.25, y: 0.58 },
    color: '#ecaa79',
    greeting: '分解、洗练、神铸。好装备需要慢慢打磨。',
  },
  {
    id: 'mia',
    name: '米娅',
    service: '部位秘藏',
    panel: 'gamble',
    classId: 'ranger',
    x: 0.84,
    y: 0.8,
    approach: { x: 0.75, y: 0.8 },
    color: '#d6addd',
    greeting: '带上神秘碎片，挑一件你需要的部位吧。',
  },
  {
    id: 'keeper',
    name: '仓库管理员',
    service: '共享仓库',
    panel: 'stash',
    classId: 'barbarian',
    x: 0.22,
    y: 0.82,
    approach: { x: 0.3, y: 0.82 },
    color: '#d7ba82',
    greeting: '同一账号的行者，都可以使用这里的装备。',
  },
  {
    id: 'tamer',
    name: '荒野契约师',
    service: '伙伴与赛季',
    panel: 'pets',
    classId: 'druid',
    x: 0.74,
    y: 0.91,
    approach: { x: 0.66, y: 0.92 },
    color: '#b9ce8c',
    greeting: '让伙伴跟随你，也别忘了领取赛季奖励。',
  },
];

export function clampHallPosition(x: number, y: number) {
  const { left, right, top, bottom } = HALL_LAYOUT.bounds;
  return { x: Math.max(left, Math.min(right, x)), y: Math.max(top, Math.min(bottom, y)) };
}
