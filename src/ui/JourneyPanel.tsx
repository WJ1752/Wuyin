import type { Rarity } from '../core/types';
import { RARITY_COLORS, RARITY_NAMES } from '../core/types';
import { SETS } from '../data/sets';
import { SKILLS } from '../data/skillTrees';
import {
  getLootProfile,
  getProgressionMilestones,
  progressionSet,
  RARITY_UNLOCK_STAGE,
  type LootSource,
} from '../data/progression';
import { useGameStore } from '../state/gameStore';
import { ItemIcon, SkillIcon } from './AssetIcon';
import { Check, Lock } from './PixelIcons';
import './journey.css';

export function LootChances({ stage, source = 'world' }: { stage: number; source?: LootSource }) {
  const profile = getLootProfile(stage, source);
  return (
    <div className="loot-chances" aria-label="装备品质概率">
      {Object.entries(profile.chances).map(([id, chance]) => {
        const rarity = id as Rarity;
        return (
          <div key={rarity} style={{ color: RARITY_COLORS[rarity] }}>
            <span>{RARITY_NAMES[rarity]}</span>
            <b>
              {chance > 0 ? `${(chance * 100).toFixed(1)}%` : `${RARITY_UNLOCK_STAGE[rarity]} 层起`}
            </b>
            <i style={{ width: `${chance * 100}%` }} />
          </div>
        );
      })}
    </div>
  );
}

export function JourneyPanel({ onNavigate }: { onNavigate?: (panel: string) => void }) {
  const { save, selectProgressionSet, accounts, activeAccountId, labBackup } = useGameStore();
  const stash = labBackup
    ? []
    : (accounts.find((account) => account.id === activeAccountId)?.stash ?? []);
  const target = progressionSet(save);
  const collected = new Set(
    [...save.inventory, ...Object.values(save.equipment), ...stash]
      .filter((item) => item?.setId === target.id)
      .map((item) => item!.slot),
  );
  const worn = Object.values(save.equipment).filter((item) => item?.setId === target.id).length;
  return (
    <div className="journey-panel">
      <section className="card">
        <span className="eyebrow">当前远征 · 第 {save.selectedStage} 层</span>
        <h3>{getLootProfile(save.selectedStage).label}</h3>
        <p className="muted">
          品质随层数平滑变化；首领与哥布林提高高品质权重，但不会越过解锁门槛。下方为普通掉落品质概率，限定部位会按可用装备调整。
        </p>
        <LootChances stage={save.selectedStage} />
        <p className="muted">
          刷本产出的职业专属装备有 80% 属于当前角色职业，其余四职业各 5%；通用传奇不受职业限制。
          异职业装备可存入账号共享仓库，交给其他角色。秘藏与旅程奖励定向当前职业。
        </p>
      </section>
      <section className="card">
        <span className="eyebrow">选择你的第一个流派</span>
        <h3>
          套装追寻 · 背包与仓库已收集 {collected.size}/5 · 已穿戴 {worn} 件
        </h3>
        <div className="journey-set-options">
          {SETS.filter((set) => set.classId === save.classId).map((set) => (
            <button
              key={set.id}
              className={target.id === set.id ? 'active' : ''}
              aria-pressed={target.id === set.id}
              onClick={() => selectProgressionSet(set.id)}
            >
              <ItemIcon item={{ slot: 'head', setId: set.id }} size={40} />
              <span>{set.name}</span>
              {target.id === set.id && <Check size={16} />}
            </button>
          ))}
        </div>
        <p className={worn >= 2 ? 'positive' : 'muted'}>
          {worn >= 2 ? '已激活' : '待集齐'} · 2 件共鸣：{target.two}
        </p>
        <p className={worn >= 4 ? 'positive' : 'muted'}>
          {worn >= 4 ? '流派已成型' : '待激活'} · 4 件成型：{target.four}
        </p>
        <p className="journey-core">
          <SkillIcon skillId={target.skillId} size={36} />
          核心技能：{SKILLS.find((skill) => skill.id === target.skillId)?.name} ·{' '}
          {save.skills[target.skillId] ? '已学习' : '前往技能之书沿路径学习'}
        </p>
        <small className="muted">
          31 / 35 / 40 / 45
          层首通奖励优先补齐所选套装缺失部件。更换目标只影响尚未领取的奖励；集齐后记得穿戴。
        </small>
        {onNavigate && (
          <div className="button-row">
            <button className="gold-button" onClick={() => onNavigate('skills')}>
              学习核心技能
            </button>
            <button className="ghost-button" onClick={() => onNavigate('character')}>
              查看并穿戴套装
            </button>
            <button className="ghost-button" onClick={() => onNavigate('stash')}>
              查看共享仓库
            </button>
          </div>
        )}
      </section>
      <div className="journey-milestones">
        {getProgressionMilestones(save).map((milestone) => (
          <article className={`card ${milestone.claimed ? 'claimed' : ''}`} key={milestone.stage}>
            <div className="journey-marker" style={{ color: RARITY_COLORS[milestone.rarity] }}>
              {milestone.claimed ? <Check /> : <Lock />}
            </div>
            <div>
              <span className="eyebrow">
                第 {milestone.stage} 层 ·{' '}
                {milestone.claimed
                  ? '已领取'
                  : (save.progression?.clearedStage ?? 0) >= milestone.stage
                    ? '已达成 · 等待补发'
                    : '首通奖励'}
              </span>
              <h3>{milestone.title}</h3>
              <p className="muted">{milestone.detail}</p>
              {!milestone.claimed && (save.progression?.clearedStage ?? 0) >= milestone.stage && (
                <p className="positive">
                  腾出背包空间，再通关第 {milestone.stage} 层或更高层即可自动补发。
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
