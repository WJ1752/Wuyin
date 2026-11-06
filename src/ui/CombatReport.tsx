import type { CombatStats } from '../core/types';
import { SKILLS } from '../data/skillTrees';
import { formatBigNumber } from '../core/format';
import './player-experience.css';
import './secondary-pixel.css';

export function CombatReport({
  stats,
  failed = false,
  onNavigate,
}: {
  stats: CombatStats;
  failed?: boolean;
  onNavigate?: (panel: string) => void;
}) {
  const sources = Object.entries(stats.damageBySource).sort((a, b) => b[1] - a[1]);
  const skills = Object.entries(stats.damageBySkill).sort((a, b) => b[1] - a[1]);
  const starved = (stats.resourceStarvedSeconds ?? 0) > stats.seconds * 0.2;
  const diagnosis = failed
    ? starved
      ? '核心技能较长时间缺能。保留基础技能 AUTO 回能，并检查减耗、回能与套装条件。'
      : stats.seconds >= 299
        ? '战斗时间耗尽。检查核心技能是否已学习、套装是否穿齐，或回刷较低层获取装备。'
        : sources.length
          ? `主要承伤来自「${sources[0][0]}」。优先避开该攻击，检查生命、护甲与防御技能。`
          : '检查站位与防御技能，整理装备后可先挑战较低层。'
    : '统计来自当前战斗，包含套装与传奇触发；可用来比较同层、同条件下的配装。';
  return (
    <details className="combat-report" open={failed || undefined}>
      <summary>{failed ? '战斗复盘与整备建议' : '战斗统计'}</summary>
      <div className="combat-report-metrics">
        <span>
          每秒伤害 <b>{formatBigNumber(stats.damageDealt / Math.max(1, stats.seconds))}</b>
        </span>
        <span>
          造成伤害 <b>{formatBigNumber(stats.damageDealt)}</b>
        </span>
        <span>
          承受伤害 <b>{formatBigNumber(stats.damageTaken)}</b>
        </span>
        <span>
          主动施法 <b>{stats.casts}</b>
        </span>
        <span>
          暴击次数 <b>{stats.criticalHits}</b>
        </span>
        {(stats.resourceStarvedSeconds ?? 0) > 0 && (
          <span>
            缺能时间 <b>{Math.round(stats.resourceStarvedSeconds!)} 秒</b>
          </span>
        )}
      </div>
      {stats.bossRemaining !== undefined && stats.bossRemaining > 0 && (
        <p>守关首领剩余生命：{(Math.min(1, stats.bossRemaining) * 100).toFixed(1)}%</p>
      )}
      {skills.length > 0 && (
        <div className="combat-report-breakdown">
          <h4>主要输出</h4>
          {skills.slice(0, 3).map(([id, amount]) => (
            <div key={id}>
              <span>{SKILLS.find((skill) => skill.id === id)?.name ?? id}</span>
              <b>{formatBigNumber(amount)}</b>
              <i style={{ width: `${(amount / Math.max(1, stats.damageDealt)) * 100}%` }} />
            </div>
          ))}
        </div>
      )}
      {sources.length > 0 && (
        <p className="muted">
          主要承伤：
          {sources
            .slice(0, 3)
            .map(([source, amount]) => `${source} ${formatBigNumber(amount)}`)
            .join(' · ')}
        </p>
      )}
      <p>{diagnosis}</p>
      {failed && onNavigate && (
        <div className="button-row">
          <button
            className="outline-button"
            onClick={() => onNavigate(starved ? 'skills' : 'character')}
          >
            {starved ? '检查技能与回能' : '回营调整装备'}
          </button>
        </div>
      )}
    </details>
  );
}
