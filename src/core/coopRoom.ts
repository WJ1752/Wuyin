import type { CoopFrame, CoopInput } from './coop';
import type { ClassId, CombatConfig, RunResult } from './types';

export interface CoopRoomMember {
  id: string;
  name: string;
  characterId: string;
  classId: ClassId;
  level: number;
  ready: boolean;
  connected: boolean;
  config: CombatConfig;
}

export interface CoopRoom {
  runId: string;
  authority?: 'server';
  code: string;
  hostId: string;
  selfId: string;
  status: 'waiting' | 'playing' | 'finished' | 'aborted';
  stage: number;
  seed: number;
  members: CoopRoomMember[];
  reason?: string;
  snapshot?: CoopFrame;
  inputs?: Record<string, CoopInput>;
  inputSequenceBase?: number;
  commandSequenceBase?: number;
}

export interface CoopReward {
  runId: string;
  characterId: string;
  result: RunResult;
  createdAt: number;
}

export interface CoopRoomResponse {
  room: CoopRoom | null;
}
