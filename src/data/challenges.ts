import type { SaveData } from '../core/types';

export type ChallengeId = 'pursuit' | 'ward' | 'hazards';
export interface ChallengeDef {
  id: ChallengeId;
  name: string;
  description: string;
  objective: 'eliteKills' | 'holdSeconds' | 'hazardWaves';
  target: number;
  reward: { gold: number; shards: number; crystals: number };
}

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'pursuit',
    name: '追猎契约',
    description: '精英巡猎队不断来袭。击败三名精英后召唤守关首领，完成远征。',
    objective: 'eliteKills',
    target: 3,
    reward: { gold: 1800, shards: 350, crystals: 60 },
  },
  {
    id: 'ward',
    name: '守望仪式',
    description: '在中央符文周围累计驻守十八秒，离圈暂停充能；完成仪式后击败首领。',
    objective: 'holdSeconds',
    target: 18,
    reward: { gold: 1800, shards: 350, crystals: 60 },
  },
  {
    id: 'hazards',
    name: '余烬试炼',
    description: '避开周期预警的地面冲击，经历六轮危险后击败首领。位移与走位同样重要。',
    objective: 'hazardWaves',
    target: 6,
    reward: { gold: 1800, shards: 350, crystals: 60 },
  },
];

export function challengeKey(id: ChallengeId, now = Date.now()) {
  // UTC is deliberate: every device uses the same cycle and reward key.
  return `${new Date(now).toISOString().slice(0, 10)}:${id}`;
}

export function getChallengeOffer(save: Pick<SaveData, 'progression'>, now = Date.now()) {
  const day = Math.floor(now / 86400000);
  const challenge = CHALLENGES[((day % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length];
  const key = challengeKey(challenge.id, now);
  const cleared = save.progression?.clearedStage ?? 0;
  const available = cleared >= 16;
  const claimed = save.progression?.challenges?.claimed.includes(key) ?? false;
  return {
    ...challenge,
    key,
    stage: Math.max(16, Math.min(150, cleared)),
    available,
    claimed,
    reason: available ? '' : '通关第 16 层后解锁轮换挑战',
  };
}

export function validChallengeKey(key: unknown, id?: ChallengeId): key is string {
  if (typeof key !== 'string') return false;
  const match = /^(\d{4}-\d{2}-\d{2}):(pursuit|ward|hazards)$/.exec(key);
  if (!match || (id && id !== match[2])) return false;
  const time = Date.parse(`${match[1]}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().startsWith(match[1]);
}
