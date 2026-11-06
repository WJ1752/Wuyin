import type { Rarity } from '../core/types';
import { useEffect, useState } from 'react';
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
import { LEGENDARIES } from '../data/legendaries';
import { BUILD_GUIDES } from '../data/buildGuides';
import { BUILD_RELICS, MAX_INVENTORY, useGameStore } from '../state/gameStore';
import { ItemIcon, SkillIcon } from './AssetIcon';
import { Check, Lock } from './PixelIcons';
import './journey.css';
import './secondary-pixel.css';
import { CHALLENGES, getChallengeOffer } from '../data/challenges';

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
  const {
    save,
    selectProgressionSet,
    claimJourneyRewards,
    accounts,
    activeAccountId,
    labBackup,
    inCombat,
    cloudTransition,
    beginChallenge,
  } = useGameStore();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  const challenge = getChallengeOffer(save, now);
  const challengeLocked = !!labBackup || inCombat || cloudTransition || !onNavigate;
  const milestones = getProgressionMilestones(save);
  const hasPending = milestones.some(
    (m) => !m.claimed && m.stage <= (save.progression?.clearedStage ?? 0),
  );
  const stash = labBackup
    ? []
    : (accounts.find((account) => account.id === activeAccountId)?.stash ?? []);
  const target = progressionSet(save);
  const collected = new Set(
    [...save.inventory, ...Object.values(save.equipment), ...stash]
      .filter((item) => item?.setId === target.id)
      .map((item) => item!.slot),
  );
  const items = [...Object.values(save.equipment), ...save.inventory, ...stash];
  const relics = BUILD_RELICS[target.id];
  const missing = [...relics.worn, ...relics.cube].find(
    (id) =>
      !items.some((item) => item?.legendaryId === id) &&
      !(relics.cube.includes(id) && save.extracted.includes(id)),
  );
  const next = LEGENDARIES.find((item) => item.id === missing);
  const hunt = save.progression?.hunt;
  const tracked = LEGENDARIES.find((item) => item.id === hunt?.legendaryId);
  const summit = save.progression?.summit;
  const wins = summit?.pending ? 0 : (summit?.wins ?? 0);
  const worn = Object.values(save.equipment).filter((item) => item?.setId === target.id).length;
  return (
    <div className="journey-panel">
      <section className="card journey-current">
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
      <section className="card journey-build">
        <span className="eyebrow">你的开荒目标</span>
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
      <details className="card journey-challenges">
        <summary>挑战与验证 · 解锁后参加</summary>
        <div className="journey-challenge-list">
          <section className="card trial-offer">
            <span className="eyebrow">统一配装 · 服务器验证</span>
            <h3>守望者验证试炼</h3>
            <p>
              免费使用本职业的官方成型配装，挑战第 150
              层并比较操作成绩。试炼由服务器推演，成功战绩计入验证挑战榜。
            </p>
            <p className="muted">登录即可参加；不使用开荒装备，不发放成长奖励。</p>
            <button
              className="outline-button"
              disabled={challengeLocked}
              onClick={() => onNavigate?.('trial')}
            >
              {labBackup ? '结束流派演武后可验证' : '选择验证流派'}
            </button>
          </section>
          <section className="card challenge-offer">
            <span className="eyebrow">个人轮换挑战 · 当前角色配装</span>
            <h3>
              {challenge.name} · 第 {challenge.stage} 层
            </h3>
            <p>{challenge.description}</p>
            <p className="challenge-reward">
              {challenge.claimed ? '今日首胜额外奖励已领取' : '今日首胜额外奖励'} ·{' '}
              {challenge.reward.gold} 金币 · {challenge.reward.shards} 碎片 ·{' '}
              {challenge.reward.crystals} 结晶
            </p>
            <p className="muted">
              完成特殊目标并击败首领才算通过。难度跟随已通关最高层，每天 08:00（香港时间）轮换；
              同日可重玩，首胜额外奖励只发放一次。个人挑战不计入普通单人职业榜。
            </p>
            <div className="button-row">
              <button
                className="gold-button"
                disabled={challengeLocked || !challenge.available}
                onClick={() => {
                  if (beginChallenge(challenge.id)) onNavigate?.('challenge');
                }}
              >
                {!challenge.available
                  ? challenge.reason
                  : challengeLocked
                    ? '返回开荒营地后挑战'
                    : challenge.claimed
                      ? '再次挑战 · 无首胜额外奖励'
                      : `开始${challenge.name}`}
              </button>
            </div>
            <details>
              <summary>查看三种轮换规则</summary>
              {CHALLENGES.map((entry) => (
                <p key={entry.id}>
                  <strong>{entry.name}</strong> · {entry.description}
                </p>
              ))}
            </details>
          </section>
        </div>
      </details>
      {!labBackup && (save.progression?.clearedStage ?? 0) >= 16 && (
        <details className="card journey-endgame">
          <summary>高阶配装与登峰目标</summary>
          <div>
            <h3>{target.name} · 配装目标</h3>
            <p>{BUILD_GUIDES[target.id].tip}</p>
            <p>
              {next
                ? `推荐寻找「${next.name}」 · ${next.description}`
                : '推荐传奇均已获得，可继续调整穿戴、共鸣与刻印。'}
            </p>
            {tracked && (
              <p>
                正在追踪「{tracked.name}」 · 已累计 {hunt!.misses} 抽
              </p>
            )}
            {onNavigate && (next || tracked) && (
              <button
                className="ghost-button"
                onClick={() => {
                  if (next && !hunt) useGameStore.getState().trackLegendary(next.id);
                  onNavigate('gamble');
                }}
              >
                {tracked ? '继续当前秘藏追踪' : `追踪${next?.name}`}
              </button>
            )}
            {(save.progression?.clearedStage ?? 0) >= 71 && (
              <>
                <h3>{wins === 3 ? '登峰试炼 · 已毕业' : `登峰试炼 · ${wins}/3`}</h3>
                <p>
                  单人连续三次通关第 150
                  层即可毕业。挑战失败或中途离开会中断连胜，回刷低层和组队可穿插进行。
                </p>
              </>
            )}
          </div>
        </details>
      )}
      {hasPending && !labBackup && (
        <button
          className="gold-button"
          disabled={save.inventory.length >= MAX_INVENTORY}
          onClick={claimJourneyRewards}
        >
          {save.inventory.length >= MAX_INVENTORY
            ? '背包已满，请先腾出空位'
            : '领取已达成的旅程奖励'}
        </button>
      )}
      <details className="journey-milestone-list">
        <summary>
          旅程首通奖励 · {milestones.filter((milestone) => milestone.claimed).length}/
          {milestones.length} 已领取
        </summary>
        <div className="journey-milestones">
          {milestones.map((milestone) => (
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
                      ? '已达成 · 待领取'
                      : '首通奖励'}
                </span>
                <h3>{milestone.title}</h3>
                <p className="muted">{milestone.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </details>
    </div>
  );
}
