import type { ClassId } from '../core/types';

export interface HallNpc {
  id: string;
  name: string;
  service: string;
  panel: string;
  classId: ClassId;
  x: number;
  y: number;
  color: string;
  greeting: string;
}

/** Positions are shared by pointer navigation, keyboard interaction and service signs. */
export const HALL_NPCS: HallNpc[] = [
  {
    id: 'mentor',
    name: '星语导师',
    service: '技能之书',
    panel: 'skills',
    classId: 'sorcerer',
    x: 0.23,
    y: 0.42,
    color: '#bea6ef',
    greeting: '每一次领悟，都会让下一次远征更从容。',
  },
  {
    id: 'cube',
    name: '遗物守望者',
    service: '魔盒共鸣',
    panel: 'cube',
    classId: 'necromancer',
    x: 0.49,
    y: 0.39,
    color: '#88cbbd',
    greeting: '将传奇的力量留在魔盒，让它与你同行。',
  },
  {
    id: 'chronicler',
    name: '远征记录官',
    service: '职业排行榜',
    panel: 'leaderboard',
    classId: 'ranger',
    x: 0.77,
    y: 0.42,
    color: '#dfc98f',
    greeting: '看看各职业行者的战绩，也看看他们的配装。',
  },
  {
    id: 'smith',
    name: '余烬铁匠',
    service: '装备锻造',
    panel: 'forge',
    classId: 'barbarian',
    x: 0.13,
    y: 0.66,
    color: '#ecaa79',
    greeting: '分解、洗练、神铸。好装备需要慢慢打磨。',
  },
  {
    id: 'mia',
    name: '米娅',
    service: '部位秘藏',
    panel: 'gamble',
    classId: 'ranger',
    x: 0.87,
    y: 0.66,
    color: '#d6addd',
    greeting: '带上神秘碎片，挑一件你需要的部位吧。',
  },
  {
    id: 'keeper',
    name: '仓库管理员',
    service: '共享仓库',
    panel: 'stash',
    classId: 'barbarian',
    x: 0.27,
    y: 0.88,
    color: '#d7ba82',
    greeting: '同一账号的行者，都可以使用这里的装备。',
  },
  {
    id: 'tamer',
    name: '荒野契约师',
    service: '伙伴与赛季',
    panel: 'pets',
    classId: 'druid',
    x: 0.73,
    y: 0.88,
    color: '#b9ce8c',
    greeting: '让伙伴跟随你，也别忘了领取赛季奖励。',
  },
];

export function clampHallPosition(x: number, y: number) {
  return { x: Math.max(0.07, Math.min(0.93, x)), y: Math.max(0.34, Math.min(0.94, y)) };
}
