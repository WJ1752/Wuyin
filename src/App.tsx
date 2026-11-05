import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Crown,
  Heart,
  Maximize,
  Minimize,
  Moon,
  Pause,
  Play,
  Skull,
  Sparkles,
  Swords,
  X,
  Zap,
} from './ui/PixelIcons';
import { CLASSES } from './data/classes';
import { SKILLS } from './data/skillTrees';
import { useGameStore, createCombatConfig, emptySlotItems } from './state/gameStore';
import { useCloudStore } from './state/cloudStore';
import { SystemsModal } from './ui/SystemsModal';
import { TownHud } from './ui/TownHud';
import { NpcHall } from './ui/NpcHall';
import { VirtualJoystick } from './ui/VirtualJoystick';
import { ItemIcon, SkillIcon } from './ui/AssetIcon';
import { AdventureGuide } from './ui/AdventureGuide';
import { CoopPanel } from './ui/CoopPanel';
import type { CoopRoom } from './core/coopRoom';
import type { CoopFrame, CoopInput } from './core/coop';
import { apiRequest } from './state/cloudStore';
import { useDialog } from './ui/useDialog';
import { SETS } from './data/sets';
import { BUILD_GUIDES } from './data/buildGuides';
import { RIFT_RULES, STAGES } from './data/stages';
import { isSkillAutoEnabled, skillLearningStatus } from './data/progression';
import { GameEngine, getActiveSkills } from './engine/GameEngine';
import type { CombatConfig, CombatSnapshot, RunResult } from './core/types';
import { RARITY_COLORS, RARITY_NAMES } from './core/types';
import { formatBigNumber, formatTime } from './core/format';
import { audio } from './audio/SynthAudio';
import './styles.css';
import './ui/town-hud.css';
import './ui/game-theme.css';

function App() {
  const {
    save,
    ready,
    waitingForTab,
    notice,
    hydrate,
    setNotice,
    selectStage,
    updateSettings,
    completeRun,
    labBackup,
  } = useGameStore();
  const [panel, setPanel] = useState<string | null>(null);
  const [config, setConfig] = useState<CombatConfig | null>(null);
  const [coop, setCoop] = useState<CoopRoom | null>(null);
  const [result, setResult] = useState<
    (RunResult & { nextStage: number; unlocked: number; summary: string }) | null
  >(null);
  const [showGuide, setShowGuide] = useState(false);
  const localReady = useCloudStore((state) => state.localReady);
  const closeGuide = () => {
    updateSettings({ tutorialSeen: true });
    setShowGuide(false);
  };
  const returnToCamp = () => {
    setResult(null);
    leave();
  };
  const resultRef = useDialog(!!result, returnToCamp);
  useEffect(() => {
    void hydrate().then(() => useCloudStore.getState().initialize());
  }, [hydrate]);
  useEffect(() => {
    audio.settings(save.volume, save.muted);
  }, [save.volume, save.muted]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6500);
    return () => clearTimeout(timer);
  }, [notice, setNotice]);
  useEffect(() => {
    const unlock = () => {
      void audio.unlock().catch(() => {});
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);
  const open = (id: string) => {
    audio.play('click');
    setPanel(id);
  };
  const enter = (training = false) => {
    const current = useGameStore.getState();
    if (current.cloudTransition) {
      setNotice('正在切换云端档案，请稍候再开始远征。');
      return;
    }
    useGameStore.getState().setInCombat(true);
    setNotice('');
    audio.play('pylon');
    audio.setTrack('rift');
    setResult(null);
    const currentAccount = current.accounts.find((entry) => entry.id === current.activeAccountId);
    setConfig({
      ...createCombatConfig(current.save, current.labBackup ? [] : currentAccount?.stash),
      training,
    });
  };
  const leave = () => {
    if (coop) void apiRequest('/coop/leave', 'POST', {}).catch(() => {});
    useGameStore.getState().setInCombat(false);
    setConfig(null);
    setCoop(null);
    audio.setTrack('town');
  };
  const enterCoop = (room: CoopRoom) => {
    const member = room.members.find((entry) => entry.id === room.selfId);
    if (!member) return;
    useGameStore.getState().setInCombat(true);
    setNotice('');
    setPanel(null);
    setResult(null);
    setCoop(room);
    setConfig(member.config);
    audio.setTrack('rift');
  };
  const finish = (r: RunResult) => {
    const before = useGameStore.getState().save.highestStage;
    if (!config?.training) completeRun(r);
    const current = useGameStore.getState();
    const unlocked = current.save.highestStage - before;
    // A fast frontier clear can unlock several floors. A lower-floor replay
    // advances by one so it never sends a farming character straight to the frontier.
    const nextStage = r.won
      ? unlocked > 0
        ? current.save.highestStage
        : Math.min(r.stage + 1, current.save.highestStage)
      : r.stage;
    if (!coop && unlocked > 0) selectStage(nextStage);
    setResult({ ...r, nextStage, unlocked, summary: current.notice });
  };
  const summit = result?.won && result.stage === RIFT_RULES.maxLevel;
  const advance = result?.won && !summit;
  const continueLabel = advance ? `挑战第 ${result.nextStage} 层` : '再次挑战本层';
  const quickItems = result && !coop && !labBackup ? emptySlotItems(save) : [];
  const offerSkills =
    result &&
    !result.won &&
    SKILLS.some(
      (skill) => skill.classId === save.classId && skillLearningStatus(save, skill).canLearn,
    );
  const continueRun = (equip: boolean) => {
    if (!result) return;
    if (equip) useGameStore.getState().equipEmptySlots();
    selectStage(result.nextStage);
    enter();
  };
  if (!ready || !localReady)
    return (
      <div className="loading-screen">
        <div className="brand-sigil">◇</div>
        <h1>雾隐</h1>
        <p>
          {waitingForTab
            ? '另一个标签页正在使用此进度。关闭该页后会自动进入营地。'
            : '正在唤醒守望者营地…'}
        </p>
      </div>
    );
  return (
    <div className={`app ${config ? 'in-combat' : 'in-town'} orientation-${save.orientation}`}>
      {!config && (
        <main className="game-hall" aria-label="游戏大厅">
          <NpcHall onNavigate={open} active={!panel && !showGuide} />
          <TownHud
            onNavigate={open}
            onGuide={() => setShowGuide(true)}
            onTrain={() => enter(true)}
            onSolo={() => enter()}
          />
        </main>
      )}
      {config && <CombatView config={config} coop={coop} onLeave={leave} onFinish={finish} />}
      {['coop', 'expedition'].includes(panel ?? '') && (
        <CoopPanel
          expedition={panel === 'expedition'}
          onClose={() => setPanel(null)}
          onStart={enterCoop}
          onSolo={() => {
            setPanel(null);
            enter();
          }}
          onAccount={() => setPanel('accounts')}
        />
      )}
      <SystemsModal
        panel={['coop', 'expedition'].includes(panel ?? '') ? null : panel}
        onClose={() => setPanel(null)}
        onNavigate={setPanel}
        onEnterHall={() => setPanel(null)}
      />
      {notice && !result && !panel && !showGuide && (
        <div className="toast" role="status">
          <Sparkles size={17} />
          <span>{notice}</span>
          <button aria-label="关闭提示" onClick={() => setNotice('')}>
            <X size={14} />
          </button>
        </div>
      )}
      {showGuide && (
        <AdventureGuide
          onClose={closeGuide}
          onNavigate={(id) => {
            closeGuide();
            open(id);
          }}
          onTrain={() => {
            closeGuide();
            enter(true);
          }}
        />
      )}
      {result && (
        <div className="modal-backdrop result-backdrop">
          <div
            ref={resultRef}
            className="result-card"
            role="dialog"
            aria-modal="true"
            aria-label="秘境结算"
            tabIndex={-1}
          >
            <div className="result-crest">
              {result.won ? <Crown size={52} /> : <Skull size={52} />}
            </div>
            <h2>
              {summit
                ? '秘境之巅 · 已登顶'
                : result.won
                  ? '秘境已征服'
                  : result.seconds >= RIFT_RULES.timeLimit
                    ? '远征时间已尽'
                    : coop
                      ? '队伍已倒下'
                      : '行者倒下了'}
            </h2>
            <p>
              {STAGES[result.stage - 1]?.name} · 第 {result.stage} 层
              {result.unlocked > 0 &&
                ` · ${result.unlocked > 1 ? '速通' : '通关'}解锁至第 ${result.nextStage} 层`}
            </p>
            <div className="result-stats">
              <div>
                <span>战斗用时</span>
                <strong>{formatTime(result.seconds)}</strong>
              </div>
              <div>
                <span>击败敌人</span>
                <strong>{result.kills}</strong>
              </div>
              <div>
                <span>金币</span>
                <strong>+{formatBigNumber(result.gold)}</strong>
              </div>
              <div>
                <span>神秘碎片</span>
                <strong>+{result.shards}</strong>
              </div>
            </div>
            {result.items.length > 0 && (
              <details className="result-loot">
                <summary>查看战利品 · {result.items.length} 件装备</summary>
                <ul>
                  {result.items.map((item) => (
                    <li key={item.id}>
                      <ItemIcon item={item} size={25} />
                      <span style={{ color: RARITY_COLORS[item.rarity] }}>{item.name}</span>
                      <small>
                        {RARITY_NAMES[item.rarity]} ·{' '}
                        {labBackup
                          ? '演武'
                          : save.inventory.some((entry) => entry.id === item.id)
                            ? '已入包'
                            : '已分解'}
                      </small>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="run-progression-summary">{result.summary}</p>
            <div className="result-actions">
              {quickItems.length > 0 && (
                <button
                  className="gold-button full-width"
                  title={quickItems.map((item) => item.name).join('、')}
                  onClick={() => continueRun(true)}
                >
                  补齐 {quickItems.length} 个空槽并{continueLabel} <Swords size={16} />
                </button>
              )}
              <button
                className={`${quickItems.length ? 'outline' : 'gold'}-button full-width`}
                onClick={() => {
                  if (coop) {
                    returnToCamp();
                    open('coop');
                  } else continueRun(false);
                }}
              >
                {coop ? '重新集结队伍' : continueLabel} <Swords size={16} />
              </button>
              <button
                className="outline-button full-width"
                onClick={() => {
                  returnToCamp();
                  open(offerSkills ? 'skills' : 'character');
                }}
              >
                {offerSkills ? '回营学习技能' : '回营整理装备'} <ArrowRight size={16} />
              </button>
              <button className="ghost-button full-width" onClick={returnToCamp}>
                返回守望者营地
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CombatView({
  config,
  coop,
  onLeave,
  onFinish,
}: {
  config: CombatConfig;
  coop?: CoopRoom | null;
  onLeave: () => void;
  onFinish: (result: RunResult) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<GameEngine | null>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const [snapshot, setSnapshot] = useState<CombatSnapshot | null>(null);
  const [error, setError] = useState('');
  const [network, setNetwork] = useState('');
  const [actors, setActors] = useState<CoopFrame['actors']>([]);
  const [leaveDialog, setLeaveDialog] = useState(false);
  const pauseBeforeLeave = useRef(false);
  const [auto, setAuto] = useState(config.autoSkills);
  const save = useGameStore((s) => s.save);
  const updateSettings = useGameStore((s) => s.updateSettings);
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
    basic && auto[basic.id] === false
      ? '靠近敌人，点击技能或开启 AUTO'
      : '靠近敌人自动攻击，走出地面预警';
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
        hostId: coop.hostId,
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
          '/coop/exchange',
          'POST',
          coop.selfId === coop.hostId ? (frame ? { snapshot: frame } : {}) : input ? { input } : {},
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
        if (coop.selfId === coop.hostId) {
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
          if (Date.now() - lastSuccess > 15000) {
            stopped = true;
            game.destroy();
            setError(
              `连接已中断，本次远征不发放未结算收益。${e instanceof Error ? e.message : ''}`,
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
            if (coop && coop.selfId === coop.hostId) pendingResult = r;
            else onFinishRef.current(r);
          }
        },
        onSound: (n) => {
          if (n === 'boss') audio.setTrack('boss');
          audio.play(n);
        },
      })
      .then(() => {
        if (cancelled) game.destroy();
        else if (coop) void exchange();
      })
      .catch((e) => {
        if (!cancelled) setError(`战场加载失败：${e instanceof Error ? e.message : String(e)}`);
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      game.destroy();
      engine.current = null;
    };
  }, [config, coop]);
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
      style={{ '--party-size': coop?.members.length ?? 1 } as CSSProperties}
    >
      <div className="combat-canvas" ref={host} />
      <div className="combat-top">
        <button className="icon-button" aria-label="返回营地" onClick={askLeave}>
          <ArrowLeft />
        </button>
        <div className="rift-progress">
          <div>
            <span>
              {config.training
                ? '秘境演武场'
                : `${STAGES[config.stage - 1]?.name} · 第 ${config.stage} 层`}
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
          <small>
            <span>
              {!snapshot
                ? '正在布置战场…'
                : config.training
                  ? '目标 · 练习移动与施法'
                  : snapshot.boss
                    ? '目标 · 击败守关首领'
                    : snapshot.kills === 0
                      ? openingHint
                      : '击败敌人，拾取紫色进度球'}
            </span>
            <span>
              {Math.floor(snapshot?.progress ?? 0)}% · {snapshot?.kills ?? 0} 击败
            </span>
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
        <button
          className="icon-button"
          aria-label="切换横竖屏布局"
          onClick={() =>
            updateSettings({
              orientation: save.orientation === 'portrait' ? 'landscape' : 'portrait',
            })
          }
        >
          {save.orientation === 'portrait' ? <Maximize size={17} /> : <Minimize size={17} />}
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
          <button key={p.id} disabled={p.used} onClick={() => engine.current?.activatePylon(p.id)}>
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
            style={{
              height: `${((snapshot?.hp ?? config.stats.hp) / (snapshot?.maxHp ?? config.stats.hp)) * 100}%`,
            }}
          />
          <Heart size={22} />
          <b>{formatBigNumber(snapshot?.hp ?? config.stats.hp)}</b>
          <small>生命</small>
        </div>
        <div className="skills-bar">
          {skills.map((s, i) => {
            const cd = snapshot?.cooldowns[s.id] ?? 0;
            const cost = engine.current?.getSkillCost(s.id) ?? s.cost;
            const lacksResource = (snapshot?.resource ?? config.stats.maxResource) < cost;
            const unavailable =
              !snapshot || snapshot.paused || snapshot.finished || cd > 0 || lacksResource;
            const reason = !snapshot
              ? '战场准备中'
              : snapshot.paused
                ? '战斗已暂停'
                : snapshot.finished
                  ? '本次战斗已结束'
                  : cd > 0
                    ? `冷却 ${cd.toFixed(1)} 秒`
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
                  {automatic ? 'AUTO' : '手动'}
                </button>
                <button
                  className="skill-cast"
                  title={`${s.description}\n${reason}${s.kind === 'movement' ? ' · 空格' : ''}`}
                  aria-label={`施放${s.name} · ${reason}`}
                  disabled={unavailable}
                  onClick={() => engine.current?.cast(s.id)}
                >
                  <span className="skill-symbol">
                    <SkillIcon skillId={s.id} size={38} />
                  </span>
                  {cd > 0 && <span className="cooldown-overlay">{cd.toFixed(1)}</span>}
                  {!cd && lacksResource && (
                    <span className="cooldown-overlay resource-warning">缺能</span>
                  )}
                  <small className="keybind">{i + 1}</small>
                </button>
                <span className="skill-name">{s.name}</span>
              </div>
            );
          })}
          {Array.from({ length: Math.max(0, 6 - skills.length) }, (_, i) => (
            <div
              className="combat-skill unlearned-skill"
              key={`unlearned-${i}`}
              title="升级后在营地技能之书学习，学习后加入战斗栏"
            >
              <span className="auto-toggle">未学习</span>
              <span className="skill-cast">
                <BookOpen size={28} />
              </span>
              <span className="skill-name">营地学习</span>
            </div>
          ))}
        </div>
        <div className="resource-orb energy-orb">
          <div
            className="orb-fill"
            style={{
              height: `${((snapshot?.resource ?? config.stats.maxResource) / (snapshot?.maxResource ?? config.stats.maxResource)) * 100}%`,
            }}
          />
          <Sparkles size={22} />
          <b>{Math.floor(snapshot?.resource ?? config.stats.maxResource)}</b>
          <small>{CLASSES.find((c) => c.id === config.classId)?.resource}</small>
        </div>
      </div>
      <VirtualJoystick
        disabled={!snapshot || snapshot.paused || snapshot.finished || leaveDialog}
        onMove={(x, y) => engine.current?.setMovement(x, y)}
      />
      <div className="combat-help">
        WASD / 拖动移动 · {movement ? `空格 ${movement.name}` : 'Lv.3 回营学习位移'} · Esc{' '}
        {coop ? '菜单' : '暂停'}
      </div>
      {config.training && !snapshot?.paused && (
        <div className="training-hint">
          训练不发放奖励 · 试着移动并切换 AUTO / 手动，左上角返回营地
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
          <button className="gold-button" onClick={() => engine.current?.togglePause()}>
            继续征途 <Play size={16} />
          </button>
          <button className="outline-button" onClick={askLeave}>
            返回营地 <ArrowLeft size={16} />
          </button>
          <p>
            WASD / 方向键移动 · 1–6 施法
            <br />
            {movement ? `空格施放${movement.name}` : '位移需 Lv.3 在技能之书学习'} · Esc 继续
          </p>
        </div>
      )}
      {error && (
        <div className="paused-label">
          <h2>无法打开秘境</h2>
          <p>{error}</p>
          <button className="gold-button" onClick={onLeave}>
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
export default App;
