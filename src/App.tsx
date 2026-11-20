import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Crown,
  Heart,
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
import { useGameStore, createCombatConfig, emptySlotItems, itemClass } from './state/gameStore';
import { useCloudStore } from './state/cloudStore';
import { SystemsModal } from './ui/SystemsModal';
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
import { CAMPAIGN_FINALE, getCampaignChapter, type CampaignChapter } from './data/campaign';
import { RIFT_RULES, STAGES } from './data/stages';
import { isSkillAutoEnabled, skillLearningStatus } from './data/progression';
import { GameEngine, getActiveSkills } from './engine/GameEngine';
import type { CombatConfig, CombatSnapshot, RunResult } from './core/types';
import { RARITY_COLORS, RARITY_NAMES } from './core/types';
import { formatBigNumber, formatTime } from './core/format';
import { audio } from './audio/SynthAudio';
import { getPreferences } from './core/preferences';
import type { InputAction } from './core/types';
import { CombatReport } from './ui/CombatReport';
import { actionKey } from './ui/inputLabels';
import { TrialPanel } from './ui/TrialPanel';
import { reportClientEvent } from './state/telemetry';
import { CharacterCreation } from './ui/CharacterCreation';
import { StoryGuide, type PrologueChapter } from './ui/StoryGuide';
import { MobileCamp } from './ui/MobileCamp';
import { useCompactLayout } from './ui/useCompactLayout';
import './styles.css';
import './ui/town-hud.css';
import './ui/game-theme.css';
import './ui/pixel-fantasy.css';
import './ui/responsive-layout.css';
import './ui/world-first.css';
import './ui/watchers-style.css';

function App() {
  const compact = useCompactLayout();
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
  const [inspectItem, setInspectItem] = useState<string>();
  const [config, setConfig] = useState<CombatConfig | null>(null);
  const [coop, setCoop] = useState<CoopRoom | null>(null);
  const [result, setResult] = useState<
    | (RunResult & {
        nextStage: number;
        unlocked: number;
        summary: string;
        chapter?: CampaignChapter;
      })
    | null
  >(null);
  const [showGuide, setShowGuide] = useState(false);
  const [storyReview, setStoryReview] = useState<PrologueChapter | CampaignChapter | null>(null);
  const preferences = getPreferences(save.preferences);
  const localReady = useCloudStore((state) => state.localReady);
  const closeGuide = () => {
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
    const report = () => reportClientEvent('runtime', 'unhandled-browser-error');
    window.addEventListener('error', report);
    window.addEventListener('unhandledrejection', report);
    return () => {
      window.removeEventListener('error', report);
      window.removeEventListener('unhandledrejection', report);
    };
  }, []);
  useEffect(() => {
    audio.settings(save.volume, save.muted, preferences.musicVolume, preferences.sfxVolume);
  }, [save.volume, save.muted, preferences.musicVolume, preferences.sfxVolume]);
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
    setInspectItem(undefined);
    if (id === 'story') {
      setPanel(null);
      setStoryReview('arrival');
      return;
    }
    setPanel(id);
  };
  const enter = (mode: 'rift' | 'training' | 'challenge' = 'rift') => {
    const current = useGameStore.getState();
    if (current.cloudTransition) {
      setNotice('正在切换云端档案，请稍候再开始远征。');
      return;
    }
    if (mode !== 'challenge') current.cancelChallenge();
    if (mode === 'rift') current.beginSummit();
    current.setInCombat(true);
    setNotice('');
    audio.play('pylon');
    audio.setTrack('rift');
    setResult(null);
    const { save, accounts, activeAccountId, labBackup } = useGameStore.getState();
    const currentAccount = accounts.find((entry) => entry.id === activeAccountId);
    setConfig({
      ...createCombatConfig(save, labBackup ? [] : currentAccount?.stash),
      training: mode === 'training',
    });
  };
  const leave = (leaveOnlineRun = true) => {
    if (coop && leaveOnlineRun)
      void apiRequest(coop.code === 'TRIAL' ? '/trials/leave' : '/coop/leave', 'POST', {
        runId: coop.runId,
      }).catch(() => {});
    useGameStore.getState().cancelChallenge();
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
    setConfig({ ...member.config, preferences: useGameStore.getState().save.preferences });
    audio.setTrack('rift');
  };
  const finish = async (r: RunResult) => {
    const before = useGameStore.getState().save;
    const clearedBefore = before.progression?.clearedStage ?? 0;
    if (coop?.code === 'TRIAL') {
      setNotice(
        r.won
          ? '官方配装试炼已完成，成绩由服务器记录；试炼不改变开荒进度。'
          : '官方试炼结束，可继续练习并挑战验证榜。',
      );
    } else if (coop) {
      try {
        r = await useCloudStore.getState().claimCoopReward(coop.runId);
      } catch {
        setNotice('本次奖励尚未领取，回营后可从组队远征中补领。');
      }
    } else if (!config?.training) completeRun(r);
    const current = useGameStore.getState();
    const clearedAfter = current.save.progression?.clearedStage ?? 0;
    const chapter =
      r.won && !r.challenge && !labBackup && clearedBefore < r.stage && clearedAfter >= r.stage
        ? getCampaignChapter(r.stage)
        : undefined;
    const unlocked = current.save.highestStage - before.highestStage;
    // A fast frontier clear can unlock several floors. A lower-floor replay
    // advances by one so it never sends a farming character straight to the frontier.
    const nextStage = r.won
      ? unlocked > 0
        ? current.save.highestStage
        : Math.min(r.stage + 1, current.save.highestStage)
      : r.stage;
    if (!coop && unlocked > 0) selectStage(nextStage);
    setResult({ ...r, nextStage, unlocked, summary: current.notice, chapter });
  };
  const finale = result?.chapter?.stage === CAMPAIGN_FINALE.stage;
  const summit = result?.won && result.stage === RIFT_RULES.maxLevel && !labBackup;
  const advance = result?.won && !summit;
  const continueLabel = result?.challenge
    ? '再次挑战本轮契约'
    : advance
      ? `挑战第 ${result.nextStage} 层`
      : '再次挑战本层';
  const quickItems = result && !coop && !labBackup ? emptySlotItems(save) : [];
  const equippedWeapon = save.equipment.weapon;
  const betterWeapon =
    result && !coop && !labBackup && equippedWeapon
      ? save.inventory.reduce<typeof equippedWeapon | undefined>((best, item) => {
          if (item.slot !== 'weapon' || item.attack <= (best?.attack ?? equippedWeapon.attack))
            return best;
          const requiredClass = itemClass(item);
          return !requiredClass || requiredClass === save.classId ? item : best;
        }, undefined)
      : undefined;
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
    if (result.challenge) {
      leave();
      if (!useGameStore.getState().beginChallenge(result.challenge.id)) {
        setResult(null);
        open('journey');
        return;
      }
    }
    enter(result.challenge ? 'challenge' : 'rift');
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
  if (save.characterCreated === false && !labBackup)
    return (
      <div
        className={`app character-entry ${compact ? 'layout-compact' : 'layout-desktop'}`}
        style={{ '--font-scale': preferences.fontScale } as CSSProperties}
      >
        <CharacterCreation
          onAccount={() => setPanel('accounts')}
          onCreated={() => setPanel(null)}
        />
        <SystemsModal
          panel={panel === 'accounts' ? panel : null}
          onClose={() => setPanel(null)}
          onNavigate={setPanel}
          onEnterHall={() => setPanel(null)}
        />
        {notice && (
          <div className="toast" role="status">
            {notice}
          </div>
        )}
      </div>
    );
  const automaticStory =
    !config &&
    !result &&
    !panel &&
    !showGuide &&
    !labBackup &&
    !save.storySkipped &&
    (save.storyChapter === 'arrival' ||
      save.storyChapter === 'mentor' ||
      (save.storyChapter === 'first-clear' && (save.progression?.clearedStage ?? 0) > 0))
      ? save.storyChapter
      : null;
  const visibleStory = storyReview ?? automaticStory;
  const readChapter = (chapter: CampaignChapter) => {
    setPanel(null);
    setStoryReview(chapter);
  };
  return (
    <div
      className={`app ${compact ? 'layout-compact' : 'layout-desktop'} ${config ? 'in-combat' : 'in-town'} orientation-${save.orientation}`}
      style={{ '--font-scale': preferences.fontScale } as CSSProperties}
      data-color-assist={preferences.colorAssist}
      data-campaign-complete={
        (!labBackup && (save.progression?.clearedStage ?? 0) >= CAMPAIGN_FINALE.stage) || undefined
      }
    >
      {!config && (
        <main className="game-hall" aria-label="守望者营地">
          <NpcHall onNavigate={open} active={!panel && !showGuide && !visibleStory} />
          <MobileCamp onNavigate={open} onGuide={() => setShowGuide(true)} />
        </main>
      )}
      {config && (
        <CombatView
          config={config}
          coop={coop}
          onLeave={() => leave()}
          onReturnToCamp={() => leave(false)}
          onFinish={finish}
        />
      )}
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
      {panel === 'trial' && (
        <TrialPanel
          onClose={() => setPanel(null)}
          onStart={enterCoop}
          onAccount={() => setPanel('accounts')}
        />
      )}
      <SystemsModal
        panel={['coop', 'expedition', 'trial'].includes(panel ?? '') ? null : panel}
        onClose={() => setPanel(null)}
        onReadChapter={readChapter}
        inspectItem={inspectItem}
        onNavigate={(id) => {
          setInspectItem(undefined);
          if (id === 'training' || id === 'guide') {
            setPanel(null);
            if (id === 'training') enter('training');
            else setShowGuide(true);
          } else if (id === 'challenge') {
            setPanel(null);
            enter('challenge');
          } else if (id === 'story') {
            setPanel(null);
            setStoryReview('arrival');
          } else setPanel(id);
        }}
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
            enter('training');
          }}
        />
      )}
      {visibleStory && (
        <StoryGuide
          key={`${storyReview ? 'review' : 'story'}-${typeof visibleStory === 'string' ? visibleStory : visibleStory.stage}`}
          chapter={visibleStory}
          onAdvance={() => {
            if (typeof visibleStory !== 'string') {
              setStoryReview(null);
              return;
            }
            const next =
              visibleStory === 'arrival'
                ? 'mentor'
                : visibleStory === 'mentor'
                  ? 'first-clear'
                  : 'complete';
            if (storyReview)
              setStoryReview(
                next === 'complete' || (next === 'first-clear' && !save.progression?.clearedStage)
                  ? null
                  : next,
              );
            else updateSettings({ storyChapter: next });
          }}
          onSkip={() => {
            if (storyReview) setStoryReview(null);
            else updateSettings({ storySkipped: true, storyChapter: 'complete' });
          }}
        />
      )}
      {result && (
        <div className="modal-backdrop result-backdrop">
          <div
            ref={resultRef}
            className={`result-card${result.chapter ? ' campaign-victory' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label="秘境结算"
            tabIndex={-1}
          >
            <div className="result-crest">
              {result.won ? <Crown size={52} /> : <Skull size={52} />}
            </div>
            <h2>
              {coop?.code === 'TRIAL'
                ? result.won
                  ? '官方配装试炼完成'
                  : '官方配装试炼结束'
                : result.challenge
                  ? result.won
                    ? '契约挑战完成'
                    : '契约挑战结束'
                  : summit
                    ? '秘境之巅 · 已登顶'
                    : result.chapter
                      ? finale
                        ? '守望灯已重燃'
                        : `章关告捷 · ${result.chapter.title}`
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
            {finale && (
              <p className="campaign-victory-status">
                主线完成 · 可继续挑战第 {CAMPAIGN_FINALE.stage + 1}–{RIFT_RULES.maxLevel} 层
              </p>
            )}
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
            {result.stats && (
              <CombatReport
                stats={result.stats}
                failed={!result.won}
                onNavigate={(id) => {
                  returnToCamp();
                  open(id);
                }}
              />
            )}
            <div className="result-actions">
              {result.chapter && (
                <button
                  className="gold-button full-width"
                  onClick={() => {
                    const chapter = result.chapter!;
                    returnToCamp();
                    if (
                      chapter.stage !== 1 ||
                      save.storySkipped ||
                      save.storyChapter !== 'first-clear'
                    )
                      readChapter(chapter);
                  }}
                >
                  {finale ? '阅读主线结局' : '回营阅读战报'} <BookOpen size={16} />
                </button>
              )}
              {quickItems.length > 0 && !finale && (
                <button
                  className={`${result.chapter ? 'outline' : 'gold'}-button full-width`}
                  title={quickItems.map((item) => item.name).join('、')}
                  onClick={() => continueRun(true)}
                >
                  补齐 {quickItems.length} 个空槽并{continueLabel} <Swords size={16} />
                </button>
              )}
              <button
                className={`${quickItems.length || result.chapter ? 'outline' : 'gold'}-button full-width`}
                onClick={() => {
                  if (coop) {
                    returnToCamp();
                    open(coop.code === 'TRIAL' ? 'trial' : 'coop');
                  } else continueRun(false);
                }}
              >
                {coop ? (coop.code === 'TRIAL' ? '返回官方试炼' : '重新集结队伍') : continueLabel}{' '}
                <Swords size={16} />
              </button>
              {betterWeapon && (
                <button
                  className="outline-button full-width"
                  onClick={() => {
                    returnToCamp();
                    open('character');
                    setInspectItem(betterWeapon.id);
                  }}
                >
                  比较武器 · {betterWeapon.name} <ArrowRight size={16} />
                </button>
              )}
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

const CHALLENGE_ACTIONS = {
  pursuit: '击败精英领队',
  ward: '驻守中央光圈',
  hazards: '躲避地面冲击',
};

function CombatView({
  config,
  coop,
  onLeave,
  onReturnToCamp,
  onFinish,
}: {
  config: CombatConfig;
  coop?: CoopRoom | null;
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
    basic && !isSkillAutoEnabled(auto, basic) ? '靠近后点击技能攻击' : '靠近后自动攻击，躲开预警';
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
        reportClientEvent('runtime', 'battle-initialization-failed');
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
      data-rift-theme={stage.theme}
      data-chapter-gate={!!chapter || undefined}
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
                  : snapshot.objective && snapshot.objective.progress < snapshot.objective.target
                    ? `${config.challenge ? CHALLENGE_ACTIONS[config.challenge.id] : snapshot.objective.name} · ${Math.floor(snapshot.objective.progress)}/${snapshot.objective.target}`
                    : snapshot.boss
                      ? '击败守关首领'
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
            {movement
              ? `${actionKey(save.preferences, 'movement')}施放${movement.name}`
              : '位移需 Lv.3 在技能之书学习'}{' '}
            · Esc 继续
          </p>
        </div>
      )}
      {error && (
        <div className="paused-label">
          <h2>无法打开秘境</h2>
          <p>{error}</p>
          <button className="gold-button" onClick={onReturnToCamp}>
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
