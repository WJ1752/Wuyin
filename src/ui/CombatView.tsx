import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Heart,
  Moon,
  Pause,
  Play,
  Skull,
  Sparkles,
  Zap,
} from './PixelIcons';
import { CLASSES } from '../data/classes';
import { useGameStore } from '../state/gameStore';
import type { CoopRoom } from '../core/coopRoom';
import type { CoopFrame, CoopInput } from '../core/coop';
import { apiRequest } from '../state/cloudStore';
import { SETS } from '../data/sets';
import { BUILD_GUIDES } from '../data/buildGuides';
import { getCampaignChapter } from '../data/campaign';
import { RIFT_RULES, STAGES } from '../data/stages';
import { isSkillAutoEnabled } from '../data/progression';
import { GameEngine, getActiveSkills } from '../engine/GameEngine';
import type { CombatConfig, CombatSnapshot, InputAction, RunResult } from '../core/types';
import { formatBigNumber, formatTime } from '../core/format';
import { audio } from '../audio/SynthAudio';
import { reportClientEvent } from '../state/telemetry';
import { SkillIcon } from './AssetIcon';
import { CombatLoading } from './CombatLoading';
import { CombatReport } from './CombatReport';
import { VirtualJoystick } from './VirtualJoystick';
import { actionKey } from './inputLabels';
import { useDialog } from './useDialog';

const CHALLENGE_ACTIONS = {
  pursuit: '击败精英领队',
  ward: '驻守中央光圈',
  hazards: '躲避地面冲击',
};

export default function CombatView({
  config,
  coop,
  ended,
  onLeave,
  onReturnToCamp,
  onFinish,
}: {
  config: CombatConfig;
  coop?: CoopRoom | null;
  ended: boolean;
  onLeave: () => void;
  onReturnToCamp: () => void;
  onFinish: (result: RunResult) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<GameEngine | null>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const [snapshot, setSnapshot] = useState<CombatSnapshot | null>(null);
  const [error, setError] = useState('');
  const [startupFailure, setStartupFailure] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [network, setNetwork] = useState('');
  const [actors, setActors] = useState<CoopFrame['actors']>([]);
  const [leaveDialog, setLeaveDialog] = useState(false);
  const pauseBeforeLeave = useRef(false);
  const [auto, setAuto] = useState(config.autoSkills);
  const save = useGameStore((s) => s.save);
  const lab = useGameStore((s) => !!s.labBackup);
  const stage = STAGES[config.stage - 1];
  const chapter =
    !lab && !config.training && !config.challenge && coop?.code !== 'TRIAL'
      ? getCampaignChapter(config.stage)
      : undefined;
  const skills = getActiveSkills(config);
  const movement = skills.find((skill) => skill.kind === 'movement');
  const combatSet = SETS.filter((set) => set.classId === config.classId)
    .map((set) => ({
      ...set,
      count: Object.values(config.equipment).filter((item) => item?.setId === set.id).length,
    }))
    .sort((a, b) => b.count - a.count)[0];
  const combatGuide = combatSet?.count >= 2 ? BUILD_GUIDES[combatSet.id] : undefined;
  const basic = skills.find((skill) => skill.kind === 'basic');
  const openingHint =
    basic && !isSkillAutoEnabled(auto, basic) ? '点敌集火，点击技能攻击' : '点敌集火，拖动移动';
  const objective = snapshot?.objective;
  const activeObjective =
    objective && objective.progress < objective.target ? objective : undefined;
  const cancelLeave = () => {
    setLeaveDialog(false);
    engine.current?.setPaused(pauseBeforeLeave.current);
  };
  const askLeave = () => {
    pauseBeforeLeave.current = snapshot?.paused ?? false;
    engine.current?.setPaused(true);
    setLeaveDialog(true);
  };
  const exitRef = useDialog(leaveDialog, cancelLeave);
  const pausedRef = useDialog(!!snapshot?.paused && !leaveDialog && !error, () =>
    engine.current?.setPaused(false),
  );
  useEffect(() => {
    let cancelled = false;
    setSnapshot(null);
    setError('');
    setStartupFailure(false);
    setLeaveDialog(false);
    setAuto(config.autoSkills);
    const game = new GameEngine();
    engine.current = game;
    let input: CoopInput | undefined;
    let frame: CoopFrame | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastSuccess = Date.now();
    let stopped = false;
    let pendingResult: RunResult | undefined;
    let resultDelivered = false;
    if (coop)
      game.configureCoop({
        localId: coop.selfId,
        hostId: coop.authority === 'server' ? 'server' : coop.hostId,
        inputSequenceBase: coop.inputSequenceBase,
        commandSequenceBase: coop.commandSequenceBase,
        seed: coop.seed,
        members: coop.members,
        onInput: (next) => {
          input = next;
        },
        onFrame: (next) => {
          frame = next;
          if (!cancelled) setActors(next.actors);
        },
      });
    const exchange = async () => {
      if (!coop || cancelled || stopped) return;
      try {
        const response = await apiRequest<{ room: CoopRoom }>(
          coop.code === 'TRIAL' ? '/trials/exchange' : '/coop/exchange',
          'POST',
          coop.authority !== 'server' && coop.selfId === coop.hostId
            ? frame
              ? { snapshot: frame }
              : {}
            : input
              ? { input }
              : {},
        );
        if (cancelled) return;
        const room = response.room;
        if (room.status === 'aborted') {
          stopped = true;
          game.destroy();
          setError(room.reason ?? '远征已中止，请返回营地重新集结。');
          return;
        }
        lastSuccess = Date.now();
        setNetwork('');
        if (coop.authority !== 'server' && coop.selfId === coop.hostId) {
          for (const [id, next] of Object.entries(room.inputs ?? {}))
            game.receiveCoopInput(id, next);
          if (room.status === 'finished' && pendingResult && !resultDelivered) {
            resultDelivered = true;
            onFinishRef.current(pendingResult);
          }
        } else if (room.snapshot) {
          game.receiveCoopFrame(room.snapshot);
          setActors(room.snapshot.actors);
        }
      } catch (e) {
        if (!cancelled) {
          setNetwork('连接不稳定，正在重连…');
          if (Date.now() - lastSuccess > 30000) {
            reportClientEvent('network', 'battle-exchange-disconnected');
            stopped = true;
            game.destroy();
            setError(
              `连接已中断，请回营重新连接；服务器已保存的远征结果可在组队页补领。${e instanceof Error ? e.message : ''}`,
            );
          }
        }
      } finally {
        if (!cancelled && !stopped) timer = setTimeout(exchange, 100);
      }
    };
    void game
      .init(host.current!, config, {
        onSnapshot: (s) => {
          if (!cancelled) setSnapshot(s);
        },
        onFinish: (r) => {
          if (!cancelled) {
            if (coop && coop.authority !== 'server' && coop.selfId === coop.hostId)
              pendingResult = r;
            else onFinishRef.current(r);
          }
        },
        onSound: (name) => {
          if (name === 'boss' || name === 'boss-theme') audio.setTrack('boss');
          if (name !== 'boss-theme') audio.play(name);
        },
      })
      .then(() => {
        if (cancelled) game.destroy();
        else if (coop) void exchange();
      })
      .catch((e) => {
        if (!cancelled) {
          reportClientEvent('runtime', 'battle-initialization-failed');
          setStartupFailure(true);
          setError(`战场加载失败：${e instanceof Error ? e.message : String(e)}`);
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      game.destroy();
      engine.current = null;
    };
  }, [config, coop, attempt]);
  const toggleAuto = (id: string) => {
    const skill = skills.find((entry) => entry.id === id);
    if (!skill) return;
    const next = !isSkillAutoEnabled(auto, skill);
    setAuto({ ...auto, [id]: next });
    engine.current?.setAuto(id, next);
    const current = useGameStore.getState();
    if (isSkillAutoEnabled(current.save.autoSkills, skill) !== next) current.toggleAuto(id);
  };
  return (
    <section
      className={`combat-screen ${coop ? 'coop-combat' : ''}`}
      data-rift-theme={stage.theme}
      data-chapter-gate={!!chapter || undefined}
      data-ready={!!snapshot}
      inert={ended}
      style={{ '--party-size': coop?.members.length ?? 1 } as CSSProperties}
    >
      <div className="combat-canvas" ref={host} />
      {!snapshot && !error && (
        <CombatLoading config={config} lab={lab} official={coop?.code === 'TRIAL'} />
      )}
      {snapshot?.finished && !ended && !error && (
        <div className="rift-arrival result-pending" role="status">
          <strong>正在结算远征</strong>
        </div>
      )}
      <div className="combat-top">
        <button className="icon-button" aria-label="返回营地" onClick={askLeave}>
          <ArrowLeft />
        </button>
        <div className="rift-progress">
          <div>
            <span>
              {config.training
                ? '秘境演武场'
                : `${coop?.code === 'TRIAL' ? '官方配装试炼' : (chapter?.title ?? stage.name)} · 第 ${config.stage} 层`}
            </span>
            <b>{config.training ? '∞' : formatTime(snapshot?.seconds ?? RIFT_RULES.timeLimit)}</b>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="秘境进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.floor(snapshot?.progress ?? 0)}
          >
            <i style={{ width: `${snapshot?.progress ?? 0}%` }} />
          </div>
          <small className="rift-status">
            <span>
              {!snapshot
                ? '正在布置战场…'
                : config.training
                  ? '练习移动与施法 · 训练无收益'
                  : snapshot.boss
                    ? '击败守关首领'
                    : activeObjective
                      ? `${config.challenge ? CHALLENGE_ACTIONS[config.challenge.id] : activeObjective.name} · ${Math.floor(activeObjective.progress)}/${activeObjective.target}${activeObjective.bonus ? ` · 进度+${activeObjective.bonus}%` : ''}`
                      : snapshot.kills === 0
                        ? openingHint
                        : '击败敌人，拾取紫色进度球'}
            </span>
            {!config.training && (
              <span className="rift-status-count">
                {Math.floor(snapshot?.progress ?? 0)}%
                <span className="rift-kill-count"> · {snapshot?.kills ?? 0} 击败</span>
              </span>
            )}
          </small>
        </div>
        <button
          className="icon-button"
          aria-label={
            coop ? '打开战斗菜单，联机持续进行' : snapshot?.paused ? '继续战斗' : '暂停战斗'
          }
          onClick={() => engine.current?.togglePause()}
        >
          {snapshot?.paused ? <Play /> : <Pause />}
        </button>
      </div>
      <div className="combat-vitals" aria-label="生命与资源">
        <div className="vital-health">
          <span>
            生命{' '}
            <b>
              {formatBigNumber(snapshot?.hp ?? config.stats.hp)} /{' '}
              {formatBigNumber(snapshot?.maxHp ?? config.stats.hp)}
            </b>
          </span>
          <i
            style={{
              width: `${(100 * (snapshot?.hp ?? config.stats.hp)) / (snapshot?.maxHp ?? config.stats.hp)}%`,
            }}
          />
        </div>
        <div className="vital-energy">
          <span>
            {CLASSES.find((c) => c.id === config.classId)?.resource}{' '}
            <b>{Math.floor(snapshot?.resource ?? config.stats.maxResource)}</b>
          </span>
          <i
            style={{
              width: `${(100 * (snapshot?.resource ?? config.stats.maxResource)) / (snapshot?.maxResource ?? config.stats.maxResource)}%`,
            }}
          />
        </div>
      </div>
      {coop && (
        <div className="coop-team-hud" aria-label="远征队友">
          {coop.members.map((member) => {
            const actor = actors.find((entry) => entry.id === member.id);
            return (
              <div key={member.id}>
                <strong>
                  {member.name}
                  <small>
                    {member.id === coop.selfId ? '你' : member.id === coop.hostId ? '队长' : '队友'}
                  </small>
                </strong>
                <meter
                  min={0}
                  max={actor?.snapshot.maxHp ?? member.config.stats.hp}
                  value={actor?.snapshot.hp ?? member.config.stats.hp}
                />
                <small>
                  {actor && actor.downSeconds > 0
                    ? `倒地 · ${Math.ceil(actor.downSeconds)}秒后复苏`
                    : CLASSES.find((entry) => entry.id === member.classId)?.name}
                </small>
              </div>
            );
          })}
        </div>
      )}
      {network && (
        <div className="coop-network" role="status">
          {network}
        </div>
      )}
      {snapshot?.boss && (
        <div className="boss-health">
          <span>
            <Skull size={15} /> {snapshot.boss.name}
          </span>
          <div>
            <i style={{ width: `${(snapshot.boss.hp / snapshot.boss.maxHp) * 100}%` }} />
          </div>
          <small>
            {formatBigNumber(snapshot.boss.hp)} / {formatBigNumber(snapshot.boss.maxHp)}
            {(snapshot.boss.shield ?? 0) > 0 && ` · 护盾 ${formatBigNumber(snapshot.boss.shield!)}`}
            {snapshot.boss.enraged
              ? ' · 狂暴中'
              : ` · ${Math.ceil(snapshot.boss.enrageSeconds ?? 120)}秒后狂暴`}
          </small>
          {(snapshot.boss.shield ?? 0) > 0 && (
            <div className="boss-shield">
              <i
                style={{
                  width: `${Math.min(100, ((snapshot.boss.shield ?? 0) / snapshot.boss.maxHp) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}
      <div className="combat-tools">
        <button
          className="icon-button"
          aria-label="查看流派打法与操作"
          onClick={() => engine.current?.setPaused(true)}
        >
          <BookOpen size={17} />
        </button>
        <small>{snapshot?.fps ?? 60} FPS</small>
      </div>
      <div className="buff-list">
        {snapshot?.buffs.map((b, i) => (
          <span key={`${b.name}-${i}`} style={{ borderColor: b.color }}>
            {b.name} <b>{Math.ceil(b.seconds)}s</b>
          </span>
        ))}
      </div>
      <div className="pylon-list">
        {snapshot?.pylons.map((p) => (
          <button
            key={p.id}
            data-in-reach={p.inReach}
            disabled={p.used}
            onClick={() => engine.current?.activatePylon(p.id)}
          >
            <Zap size={14} />
            {p.name}
            {p.used ? <Check size={13} /> : <span>激活</span>}
          </button>
        ))}
      </div>
      <div className="combat-bottom">
        <div className="resource-orb health-orb">
          <div
            className="orb-fill"
            style={
              {
                '--fill': `${((snapshot?.hp ?? config.stats.hp) / (snapshot?.maxHp ?? config.stats.hp)) * 100}%`,
              } as CSSProperties
            }
          />
          <Heart size={22} />
          <b>{formatBigNumber(snapshot?.hp ?? config.stats.hp)}</b>
          <small>生命</small>
        </div>
        <div className="skills-bar" style={{ '--skill-count': skills.length } as CSSProperties}>
          {skills.map((s, i) => {
            const cd = snapshot?.cooldowns[s.id] ?? 0;
            const cost = engine.current?.getSkillCost(s.id) ?? s.cost;
            const lacksResource = (snapshot?.resource ?? config.stats.maxResource) < cost;
            const unavailable =
              !snapshot || snapshot.paused || snapshot.finished || cd > 0.15 || lacksResource;
            const reason = !snapshot
              ? '战场准备中'
              : snapshot.paused
                ? '战斗已暂停'
                : snapshot.finished
                  ? '本次战斗已结束'
                  : cd > 0
                    ? `冷却 ${cd.toFixed(1)} 秒${!unavailable ? ' · 可提前按下' : ''}`
                    : lacksResource
                      ? `资源不足，需要 ${Math.ceil(cost)} 点`
                      : cost > 0
                        ? `消耗 ${Math.ceil(cost)} 点资源`
                        : '已就绪';
            const automatic = isSkillAutoEnabled(auto, s);
            return (
              <div className={`combat-skill element-${s.element}`} key={s.id}>
                <button
                  className="auto-toggle"
                  aria-label={`切换${s.name}自动施法`}
                  aria-pressed={automatic}
                  title={automatic ? '点击改为手动施放' : '点击启用自动施法'}
                  onClick={() => toggleAuto(s.id)}
                >
                  {automatic ? '自动' : '手动'}
                </button>
                <button
                  className="skill-cast"
                  title={`${s.description}\n${reason}${s.kind === 'movement' ? ` · ${actionKey(save.preferences, 'movement')}` : ''}`}
                  aria-label={`施放${s.name} · ${reason}`}
                  disabled={unavailable}
                  onClick={() => engine.current?.cast(s.id)}
                >
                  <span className="skill-symbol">
                    <SkillIcon skillId={s.id} size={38} />
                  </span>
                  <span className="skill-mode" aria-hidden="true">
                    {automatic ? '自' : '手'}
                  </span>
                  {cd > 0 && <span className="cooldown-overlay">{cd.toFixed(1)}</span>}
                  {!cd && lacksResource && (
                    <span className="cooldown-overlay resource-warning">缺能</span>
                  )}
                  <small className="keybind">
                    {actionKey(save.preferences, `skill${i + 1}` as InputAction)}
                  </small>
                </button>
                <span className="skill-name">{s.name}</span>
              </div>
            );
          })}
        </div>
        <div className="resource-orb energy-orb">
          <div
            className="orb-fill"
            style={
              {
                '--fill': `${((snapshot?.resource ?? config.stats.maxResource) / (snapshot?.maxResource ?? config.stats.maxResource)) * 100}%`,
              } as CSSProperties
            }
          />
          <Sparkles size={22} />
          <b>{Math.floor(snapshot?.resource ?? config.stats.maxResource)}</b>
          <small>{CLASSES.find((c) => c.id === config.classId)?.resource}</small>
        </div>
      </div>
      <VirtualJoystick
        disabled={!snapshot || snapshot.paused || snapshot.finished || leaveDialog}
      />
      <div className="combat-help">
        {(['up', 'left', 'down', 'right'] as InputAction[])
          .map((action) => actionKey(save.preferences, action))
          .join('')}{' '}
        / 拖动移动 ·{' '}
        {movement
          ? `${actionKey(save.preferences, 'movement')} ${movement.name}`
          : 'Lv.3 回营学习位移'}{' '}
        · Esc {coop ? '菜单' : '暂停'}
      </div>
      {config.training && !snapshot?.paused && (
        <div className="training-hint">
          训练无收益 · 每秒伤害{' '}
          {formatBigNumber(
            (snapshot?.stats?.damageDealt ?? 0) / Math.max(1, snapshot?.stats?.seconds ?? 1),
          )}{' '}
          · 暂停查看完整战斗统计
        </div>
      )}
      {snapshot?.paused && !leaveDialog && (
        <div
          ref={pausedRef}
          className="paused-label"
          role="dialog"
          aria-modal="true"
          aria-label="战斗已暂停"
          tabIndex={-1}
        >
          <Moon />
          <h2>{coop ? '远征仍在进行' : '时间已静止'}</h2>
          {coop && <p>菜单期间角色停止接收移动操作，战场持续进行。请及时返回队伍。</p>}
          {combatGuide && (
            <div className="paused-build-guide">
              <strong>
                {combatSet.name} · {combatSet.count >= 4 ? '四件' : '二件'} · {combatGuide.style}
              </strong>
              <p>{combatGuide.range}</p>
              <p>{combatSet.count >= 4 ? combatGuide.rotation : combatSet.two}</p>
              <small>
                {combatSet.count >= 4 ? combatGuide.tip : '集齐并穿戴四件，解锁完整流派机制。'}
              </small>
            </div>
          )}
          {snapshot.stats && <CombatReport stats={snapshot.stats} />}
          <details className="combat-auto-settings">
            <summary>自动施法设置</summary>
            <div>
              {skills.map((skill) => (
                <button
                  key={skill.id}
                  className="ghost-button"
                  aria-pressed={isSkillAutoEnabled(auto, skill)}
                  onClick={() => toggleAuto(skill.id)}
                >
                  {skill.name}
                  <span>{isSkillAutoEnabled(auto, skill) ? '自动' : '手动'}</span>
                </button>
              ))}
            </div>
          </details>
          <button className="gold-button" onClick={() => engine.current?.togglePause()}>
            继续征途 <Play size={16} />
          </button>
          <button className="outline-button" onClick={askLeave}>
            返回营地 <ArrowLeft size={16} />
          </button>
          <p>
            {(['up', 'left', 'down', 'right'] as InputAction[])
              .map((action) => actionKey(save.preferences, action))
              .join('')}{' '}
            / 方向键移动 · 战斗栏对应键施法
            <br />
            点敌集火，拖动移动 · 点地取消锁定
            <br />
            默认 Q 或按下手柄右摇杆切换目标
            <br />
            {movement
              ? `${actionKey(save.preferences, 'movement')}施放${movement.name}`
              : '位移需 Lv.3 在技能之书学习'}{' '}
            · Esc 继续
          </p>
        </div>
      )}
      {error && (
        <div className="paused-label" role="alert">
          <h2>无法打开秘境</h2>
          <p>{error}</p>
          {startupFailure && (
            <button className="gold-button" onClick={() => setAttempt((previous) => previous + 1)}>
              重新加载战场
            </button>
          )}
          <button
            className={startupFailure ? 'outline-button' : 'gold-button'}
            onClick={onReturnToCamp}
          >
            返回营地
          </button>
        </div>
      )}
      {leaveDialog && (
        <div className="modal-backdrop">
          <div
            ref={exitRef}
            className="card exit-card"
            role="dialog"
            aria-modal="true"
            aria-label="确认返回营地"
            tabIndex={-1}
          >
            <h2>返回营地</h2>
            <p>
              {coop
                ? '任意队员离队都会中止全队远征，未结算的收益不会发放。'
                : config.training
                  ? '训练不发放奖励，可以随时回营调整技能与装备。'
                  : '本次未结算的战利品将留在迷雾中。'}
            </p>
            <div>
              <button className="ghost-button" onClick={cancelLeave}>
                {pauseBeforeLeave.current ? '保持暂停' : '继续战斗'}
              </button>
              <button className="gold-button" onClick={onLeave}>
                返回营地
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
