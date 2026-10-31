import type { CombatConfig, CombatSnapshot, RunResult } from './types';

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
  pet?: { x: number; y: number };
  summons?: { x: number; y: number; active: boolean }[];
  snapshot: CombatSnapshot;
}

export interface CoopFrame {
  sequence: number;
  elapsed: number;
  progress: number;
  kills: number;
  actors: CoopActorFrame[];
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
  }[];
  projectiles: { x: number; y: number; angle: number; color: number }[];
  zones: { x: number; y: number; radius: number; color: number }[];
  orbs: { x: number; y: number; kind: string }[];
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
  seed?: number;
  localId: string;
  hostId: string;
  members: CoopMemberConfig[];
  onInput?: (input: CoopInput) => void;
  onFrame?: (frame: CoopFrame) => void;
}
