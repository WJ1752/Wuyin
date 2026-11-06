import type { CombatConfig, CombatSnapshot, Rarity, RunResult, Slot } from './types';

/** Host runs the shared simulation; peers only send controls and render host frames. */
export interface CoopInput {
  sequence: number;
  movement: { x: number; y: number };
  casts: string[];
  commands?: { sequence: number; id: string }[];
  autoSkills?: Record<string, boolean>;
  pylon?: string;
}

export interface CoopMemberConfig {
  id: string;
  name: string;
  config: CombatConfig;
}

export interface CoopActorFrame {
  id: string;
  x: number;
  y: number;
  facing: number;
  moving: boolean;
  downSeconds: number;
  inputSequence?: number;
  cast?: { sequence: number; skillId: string; angle: number; tx: number; ty: number };
  pet?: { x: number; y: number };
  summons?: { x: number; y: number; active: boolean }[];
  snapshot: CombatSnapshot;
}

export type CombatEffectCue = { x: number; y: number; color: number } & (
  | { kind: 'burst'; count: number; large: boolean; heal?: boolean }
  | { kind: 'slash'; angle: number; radius: number }
  | { kind: 'ring' | 'meteor'; radius: number }
  | { kind: 'lightning'; tx: number; ty: number }
);

export interface MonsterAttackPose {
  angle: number;
  start: number;
  duration: number;
  strike: boolean;
}

export interface CoopFrame {
  sequence: number;
  elapsed: number;
  progress: number;
  kills: number;
  actors: CoopActorFrame[];
  effects?: (CombatEffectCue & { sequence: number; time: number })[];
  enemies: {
    id: number;
    defId: string;
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    elite: boolean;
    boss: boolean;
    minion: boolean;
    pose?: MonsterAttackPose;
  }[];
  projectiles: {
    x: number;
    y: number;
    angle: number;
    color: number;
    skillId?: string;
    scale?: number;
  }[];
  zones: { x: number; y: number; radius: number; color: number; skillId?: string }[];
  orbs: {
    x: number;
    y: number;
    kind: string;
    rarity?: Rarity;
    slot?: Slot;
    appearanceKey?: string;
  }[];
  warnings: {
    id: number;
    x: number;
    y: number;
    radius: number;
    angle: number;
    range: number;
    width: number;
    shape: string;
    color: number;
  }[];
  pylons: { id: string; used: boolean }[];
  results?: Record<string, RunResult>;
}

export interface CoopEngineOptions {
  inputSequenceBase?: number;
  commandSequenceBase?: number;
  seed?: number;
  localId: string;
  hostId: string;
  members: CoopMemberConfig[];
  onInput?: (input: CoopInput) => void;
  onFrame?: (frame: CoopFrame) => void;
}
