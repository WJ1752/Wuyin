import type { SkillDef } from '../core/types';
export function selectAutoCast(
  skills: SkillDef[],
  state: {
    hpRatio: number;
    nearby: number;
    enemies: number;
    elite: boolean;
    resource: number;
    free: boolean;
    cooldowns: Record<string, number>;
    auto: Record<string, boolean>;
  },
): SkillDef | undefined {
  const available = skills.filter(
    (s) =>
      s.kind !== 'passive' &&
      state.auto[s.id] !== false &&
      (state.auto[s.id] === true || s.kind !== 'movement') &&
      !state.cooldowns[s.id] &&
      (state.free || s.cost <= state.resource),
  );
  const priority = (s: SkillDef) =>
    s.kind === 'defense'
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
