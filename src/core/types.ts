export type ClassId = 'ranger' | 'barbarian' | 'sorcerer' | 'necromancer' | 'druid';
export type Slot = 'weapon' | 'offhand' | 'head' | 'chest' | 'hands' | 'legs' | 'feet' | 'jewelry';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'set' | 'primal';
export type Element = 'physical' | 'fire' | 'ice' | 'lightning' | 'arcane' | 'poison';
export type SkillKind =
  'basic' | 'core' | 'control' | 'ultimate' | 'passive' | 'defense' | 'movement';
export interface ClassDef {
  id: ClassId;
  name: string;
  title: string;
  lore: string;
  color: string;
  resource: string;
  maxResource: number;
  regen: number;
  mainStat: string;
  weapon: string;
  hp: number;
  attack: number;
}
export interface SkillDef {
  id: string;
  classId: ClassId;
  name: string;
  tier: number;
  kind: SkillKind;
  element: Element;
  description: string;
  multiplier: number;
  cost: number;
  cooldown: number;
  duration: number;
  radius: number;
  icon: string;
  parent?: string;
  effect: string;
}
export interface SetDef {
  id: string;
  classId: ClassId;
  name: string;
  lore: string;
  skillId: string;
  two: string;
  four: string;
  multiplier: number;
  color: string;
  effect: string;
}
export interface LegendaryDef {
  id: string;
  name: string;
  classId?: ClassId;
  slot: Slot;
  lore: string;
  description: string;
  effect: string;
  min: number;
  max: number;
}
export interface AffixDef {
  id: string;
  name: string;
  min: number;
  max: number;
  unit: string;
  weight: number;
}
export interface Item {
  id: string;
  name: string;
  slot: Slot;
  rarity: Rarity;
  level: number;
  attack: number;
  armor: number;
  affixes: { id: string; value: number }[];
  legendaryId?: string;
  setId?: string;
  power: number;
  gem?: { id: string; level: number };
  reforged?: number;
}
export interface GemDef {
  id: string;
  name: string;
  color: string;
  stat: string;
  value: number;
  description: string;
}
export interface PetDef {
  id: string;
  name: string;
  description: string;
  color: string;
  effect: string;
  value: number;
  lore: string;
}
export interface MonsterDef {
  id: string;
  name: string;
  family: string;
  color: string;
  hp: number;
  speed: number;
  attack: number;
  radius: number;
  behavior: string;
  lore: string;
}
export interface BossDef extends MonsterDef {
  ability: string;
  telegraph: 'circle' | 'cone' | 'line';
  element: Element;
}
export interface StageDef {
  level: number;
  name: string;
  theme: number;
  difficulty: string;
  hpMultiplier: number;
  damageMultiplier: number;
  reward: number;
}
export interface Stats {
  hp: number;
  attack: number;
  armor: number;
  mainStat: number;
  critChance: number;
  critDamage: number;
  attackSpeed: number;
  moveSpeed: number;
  cooldown: number;
  elementDamage: number;
  eliteDamage: number;
  regen: number;
  resourceRegen: number;
  areaDamage: number;
  damageReduction: number;
  dodge: number;
  pickupRadius: number;
  lifeOnHit: number;
  thorns: number;
  penetration: number;
  bonusDamage: number;
  independent: number[];
  maxResource: number;
  luck: number;
}
export interface SaveData {
  version: number;
  classId: ClassId;
  level: number;
  xp: number;
  gold: number;
  shards: number;
  crystals: number;
  souls: number;
  highestStage: number;
  selectedStage: number;
  inventory: Item[];
  equipment: Partial<Record<Slot, Item>>;
  extracted: string[];
  cube: { weapon?: string; armor?: string; jewelry?: string };
  forge: Record<Slot, number>;
  gems: Record<string, number[]>;
  skills: Record<string, number>;
  autoSkills: Record<string, boolean>;
  petId: string;
  petLevels: Record<string, number>;
  kills: number;
  clears: number;
  bestTime: number;
  lastSaved: number;
  volume: number;
  muted: boolean;
  autoSalvage: boolean;
  keepRareAffix?: string;
  orientation: 'portrait' | 'landscape';
  tutorialSeen: boolean;
  progression?: {
    version: 1;
    clearedStage: number;
    claimedMilestones: string[];
    targetSetId?: string;
    summit?: { wins: number; pending: boolean };
    hunt?: { legendaryId: string; misses: number };
    campFocus?: 'crystals' | 'shards';
  };
  runRecords?: RunRecord[];
}
export interface CharacterData {
  id: string;
  name: string;
  save: SaveData;
}
export interface AccountData {
  id: string;
  name: string;
  activeCharacterId: string;
  characters: CharacterData[];
  stash: Item[];
}
export interface AccountSave {
  format: 'mist-continent-accounts';
  version: 1;
  activeAccountId: string;
  accounts: AccountData[];
  lastSaved: number;
}
export interface RunRecord {
  id: string;
  stage: number;
  seconds: number;
  kills: number;
  date: number;
  build: Pick<
    SaveData,
    | 'classId'
    | 'level'
    | 'equipment'
    | 'cube'
    | 'skills'
    | 'autoSkills'
    | 'petId'
    | 'petLevels'
    | 'forge'
  >;
}
export interface RunResult {
  /** Cooperative clears grant progression but are excluded from solo rankings. */
  partySize?: number;
  won: boolean;
  stage: number;
  seconds: number;
  kills: number;
  gold: number;
  shards: number;
  items: Item[];
}
export interface CombatConfig {
  classId: ClassId;
  level: number;
  stage: number;
  stats: Stats;
  equipment: SaveData['equipment'];
  skills: Record<string, number>;
  autoSkills: Record<string, boolean>;
  cube: SaveData['cube'];
  petId: string;
  petLevel?: number;
  training?: boolean;
  ownedSetPieces?: string[];
}
export interface CombatSnapshot {
  hp: number;
  maxHp: number;
  resource: number;
  maxResource: number;
  progress: number;
  seconds: number;
  kills: number;
  combo: number;
  boss?: {
    name: string;
    hp: number;
    maxHp: number;
    shield?: number;
    enrageSeconds?: number;
    enraged?: boolean;
  };
  cooldowns: Record<string, number>;
  buffs: { name: string; seconds: number; color: string }[];
  paused: boolean;
  finished: boolean;
  pylons: { id: string; name: string; used: boolean; inReach?: boolean }[];
  fps: number;
}
export interface GameCallbacks {
  onSnapshot: (state: CombatSnapshot) => void;
  onFinish: (result: RunResult) => void;
  onSound: (name: string) => void;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  classId: ClassId;
  level: number;
  stage: number;
  seconds: number;
  kills: number;
  date: number;
  setName: string | null;
}
export interface LeaderboardResponse {
  classId: ClassId;
  entries: LeaderboardEntry[];
  total: number;
  source: 'cloud';
  updatedAt: number;
}
export type LobbyActivity =
  'town' | 'forge' | 'skills' | 'stash' | 'cube' | 'pets' | 'gamble' | 'rift';
export interface LobbyPlayer {
  id: string;
  name: string;
  classId: ClassId;
  level: number;
  x: number;
  y: number;
  activity: LobbyActivity;
  updatedAt: number;
  isSelf: boolean;
  equipment: Pick<Item, 'slot' | 'name' | 'rarity' | 'level' | 'setId' | 'legendaryId'>[];
  achievements: { clears: number; clearedStage: number; kills: number };
}
export interface LobbyResponse {
  players: LobbyPlayer[];
  onlineCount: number;
  serverTime: number;
  ttlMs: number;
}
export const SLOTS: Slot[] = [
  'weapon',
  'offhand',
  'head',
  'chest',
  'hands',
  'legs',
  'feet',
  'jewelry',
];
export const SLOT_NAMES: Record<Slot, string> = {
  weapon: '主手武器',
  offhand: '副手',
  head: '头盔',
  chest: '胸甲',
  hands: '护手',
  legs: '护腿',
  feet: '战靴',
  jewelry: '首饰',
};
export const RARITY_NAMES: Record<Rarity, string> = {
  common: '普通',
  uncommon: '精良',
  rare: '稀有',
  epic: '史诗',
  legendary: '传奇',
  set: '套装',
  primal: '太古',
};
export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#b0b5bc',
  uncommon: '#2ecc71',
  rare: '#3498db',
  epic: '#9b59b6',
  legendary: '#ff9d45',
  set: '#5bea9a',
  primal: '#ff3756',
};
