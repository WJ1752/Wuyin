import type { SkillDef } from '../core/types';
import { isSkillAutoEnabled } from '../data/progression';
export function selectAutoCast(
  skills: SkillDef[],
  state: {
    hpRatio: number;
    nearby: number;
    enemies: number;
    elite: boolean;
    resource: number;
    costs?: Record<string, number>;
    free: boolean;
    cooldowns: Record<string, number>;
    auto: Record<string, boolean>;
    focus?: string;
  },
): SkillDef | undefined {
  const available = skills.filter(
    (s) =>
      s.kind !== 'passive' &&
      isSkillAutoEnabled(state.auto, s) &&
      !state.cooldowns[s.id] &&
      (state.free || (state.costs?.[s.id] ?? s.cost) <= state.resource),
  );
  const priority = (s: SkillDef) =>
    s.id === state.focus
      ? 85
      : s.kind === 'defense'
        ? state.hpRatio < 0.65 || state.nearby >= 3
          ? 100
          : -1
        : s.kind === 'ultimate'
          ? state.elite || state.enemies >= 5
            ? 90
            : -1
          : s.kind === 'control'
            ? 70
            : s.kind === 'core'
              ? 60
              : s.kind === 'movement'
                ? state.hpRatio < 0.4
                  ? 80
                  : -1
                : 20;
  return available.filter((s) => priority(s) >= 0).sort((a, b) => priority(b) - priority(a))[0];
}
