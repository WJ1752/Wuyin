import { lazy, Suspense, useEffect, useState, type CSSProperties, type MouseEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Crown,
  Skull,
  Sparkles,
  Swords,
  X,
} from './ui/PixelIcons';
import { equipmentName } from './data/equipment';
import { SKILLS } from './data/skillTrees';
import { useGameStore, createCombatConfig, emptySlotItems, itemClass } from './state/gameStore';
import { useCloudStore } from './state/cloudStore';
import { SystemsModal } from './ui/SystemsModal';
import { NpcHall } from './ui/NpcHall';
import { ItemIcon } from './ui/AssetIcon';
import { AdventureGuide } from './ui/AdventureGuide';
import { CoopPanel } from './ui/CoopPanel';
import type { CoopRoom } from './core/coopRoom';
import { apiRequest } from './state/cloudStore';
import { useDialog } from './ui/useDialog';
import { CAMPAIGN_FINALE, getCampaignChapter, type CampaignChapter } from './data/campaign';
import { RIFT_RULES, STAGES } from './data/stages';
import { skillLearningStatus } from './data/progression';
import type { CombatConfig, RunResult } from './core/types';
import { RARITY_COLORS, RARITY_NAMES } from './core/types';
import { formatBigNumber, formatTime } from './core/format';
import { audio } from './audio/SynthAudio';
import { getPreferences } from './core/preferences';
import { CombatReport } from './ui/CombatReport';
import { CombatLoadBoundary, CombatLoading } from './ui/CombatLoading';
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

const CombatView = lazy(() => import('./ui/CombatView'));

function playControlAudio(event: MouseEvent) {
  const target = event.target;
  const control =
    target instanceof Element &&
    target.closest<HTMLElement>('button, summary, select, input[type="checkbox"]');
  if (!control || control.matches(':disabled, [aria-disabled="true"], .skill-cast, [data-silent]'))
    return;
  audio.play(control.dataset.sound ?? (control.tagName === 'SUMMARY' ? 'folio' : 'click'));
}

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
    accounts,
    activeAccountId,
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
        rewardPending: boolean;
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
    setInspectItem(undefined);
    if (id === 'story') {
      setPanel(null);
      setStoryReview('arrival');
      return;
    }
    setPanel(id);
  };
  const redirectPendingLoot = () => {
    const current = useGameStore.getState();
    if (current.labBackup || !current.save.pendingLoot?.length) return false;
    if (config) {
      current.setInCombat(false);
      setResult(null);
      setConfig(null);
      setCoop(null);
      audio.setTrack('town');
    }
    open('character');
    setNotice('领取保留的战利品后即可再次出征。');
    return true;
  };
  const enter = (mode: 'rift' | 'training' | 'challenge' = 'rift') => {
    const current = useGameStore.getState();
    if (current.cloudTransition) {
      setNotice('正在切换云端档案，请稍候再开始远征。');
      return;
    }
    if (mode !== 'training' && redirectPendingLoot()) return;
    if (mode !== 'challenge') current.cancelChallenge();
    if (mode === 'rift') current.beginSummit();
    current.setInCombat(true);
    setNotice('');
    audio.play('gate');
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
    audio.play('gate');
    audio.setTrack('rift');
  };
  const finish = async (r: RunResult) => {
    const before = useGameStore.getState().save;
    const clearedBefore = before.progression?.clearedStage ?? 0;
    let rewardPending = false;
    if (coop?.code === 'TRIAL') {
      setNotice(
        r.won
          ? '官方配装试炼已完成，成绩由服务器记录；试炼不改变开荒进度。'
          : '官方试炼结束，可继续练习并挑战验证榜。',
      );
    } else if (coop) {
      try {
        r = await useCloudStore.getState().claimCoopReward(coop.runId);
      } catch (error) {
        rewardPending = true;
        setNotice(
          error instanceof Error ? error.message : '本次奖励尚未领取，回营后可从组队远征中补领。',
        );
      }
    } else if (!config?.training) completeRun(r);
    const current = useGameStore.getState();
    if (current.save.level > before.level) audio.play('upgrade');
    if (coop && coop.code !== 'TRIAL') {
      const rareDrop = ['primal', 'set', 'legendary', 'epic', 'rare'].find((rarity) =>
        r.items.some((item) => item.rarity === rarity),
      );
      if (rareDrop) audio.play(rareDrop);
    }
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
    setResult({ ...r, nextStage, unlocked, summary: current.notice, chapter, rewardPending });
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
    if (redirectPendingLoot()) return;
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
  const repeatExpedition = () => {
    if (!coop) return continueRun(false);
    returnToCamp();
    open(coop.code === 'TRIAL' ? 'trial' : 'coop');
  };
  const repeatLabel = coop
    ? coop.code === 'TRIAL'
      ? '返回官方试炼'
      : '重新集结队伍'
    : continueLabel;
  const activeStash = accounts.find((account) => account.id === activeAccountId)?.stash ?? [];
  const pendingLoot = !labBackup && !!save.pendingLoot?.length;
  const readVictoryReport = () => {
    const chapter = result?.chapter;
    if (!chapter) return;
    returnToCamp();
    if (chapter.stage !== 1 || save.storySkipped || save.storyChapter !== 'first-clear')
      readChapter(chapter);
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
        onClickCapture={playControlAudio}
      >
        <CharacterCreation
          onAccount={() => setPanel('accounts')}
          onCreated={() => setPanel(null)}
        />
        <SystemsModal
          panel={panel === 'accounts' ? panel : null}
          onClose={() => setPanel(null)}
          onEnterHall={() => setPanel(null)}
        />
        {notice && (
          <div className="creation-status" role="status">
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
      onClickCapture={playControlAudio}
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
        <CombatLoadBoundary onReturnToCamp={() => leave(false)}>
          <Suspense
            fallback={
              <section className="combat-screen">
                <CombatLoading
                  config={config}
                  lab={!!labBackup}
                  official={coop?.code === 'TRIAL'}
                />
              </section>
            }
          >
            <CombatView
              ended={!!result}
              config={config}
              coop={coop}
              onLeave={() => leave()}
              onReturnToCamp={() => leave(false)}
              onFinish={finish}
            />
          </Suspense>
        </CombatLoadBoundary>
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
            else
              updateSettings({
                storyChapter: visibleStory === 'first-clear' ? 'complete' : 'first-clear',
              });
          }}
        />
      )}
      {result && (
        <div className="modal-backdrop result-backdrop">
          <div
            ref={resultRef}
            className={`result-card${result.chapter ? ' campaign-victory' : ''}`}
            data-outcome={result.won ? 'victory' : 'defeat'}
            role="dialog"
            aria-modal="true"
            aria-label="秘境结算"
            tabIndex={-1}
          >
            <header className="result-heading">
              <div className="result-crest">
                {result.won ? <Crown size={52} /> : <Skull size={52} />}
              </div>
              <div>
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
              </div>
            </header>
            <div className="result-content">
              <section className="result-summary" aria-label="本次远征战绩">
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
              </section>
              <section className="result-rewards" aria-label="战利品和后续行动">
                <div className="result-rewards-heading">
                  <h3>战利品</h3>
                  <span>{result.items.length} 件装备</span>
                </div>
                {result.items.length > 0 ? (
                  <details className="result-loot">
                    <summary>
                      <span className="result-loot-preview" aria-hidden="true">
                        {result.items.slice(0, 5).map((item) => (
                          <ItemIcon key={item.id} item={item} size={31} />
                        ))}
                      </span>
                      <span>查看战利品</span>
                    </summary>
                    <ul>
                      {result.items.map((item) => (
                        <li key={item.id}>
                          <ItemIcon item={item} size={25} />
                          <span style={{ color: RARITY_COLORS[item.rarity] }}>
                            {equipmentName(item)}
                          </span>
                          <small>
                            {RARITY_NAMES[item.rarity]} ·{' '}
                            {labBackup
                              ? '演武'
                              : save.inventory.some((entry) => entry.id === item.id)
                                ? '已入包'
                                : activeStash.some((entry) => entry.id === item.id)
                                  ? '已入仓库'
                                  : save.pendingLoot?.some((entry) => entry.id === item.id)
                                    ? '保留待领'
                                    : result.rewardPending
                                      ? '待领取'
                                      : '已分解'}
                          </small>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <p className="muted result-no-loot">本次远征没有带回装备。</p>
                )}
                <div className="result-actions">
                  {pendingLoot && result.chapter && (
                    <button className="outline-button full-width" onClick={readVictoryReport}>
                      {finale ? '阅读主线结局' : '回营阅读战报'} <BookOpen size={16} />
                    </button>
                  )}
                  {!pendingLoot && result.chapter && quickItems.length > 0 && !finale && (
                    <button
                      className="outline-button full-width"
                      title={quickItems.map((item) => item.name).join('、')}
                      onClick={() => continueRun(true)}
                    >
                      补齐 {quickItems.length} 个空槽并{continueLabel} <Swords size={16} />
                    </button>
                  )}
                  {!pendingLoot && (result.chapter || quickItems.length > 0) && (
                    <button className="outline-button full-width" onClick={repeatExpedition}>
                      {repeatLabel} <Swords size={16} />
                    </button>
                  )}
                  {!pendingLoot && betterWeapon && (
                    <button
                      className="outline-button full-width"
                      onClick={() => {
                        returnToCamp();
                        open('character');
                        setInspectItem(betterWeapon.id);
                      }}
                    >
                      <ItemIcon item={betterWeapon} size={24} /> 比较武器 · {betterWeapon.name}
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
                </div>
              </section>
            </div>
            <footer className="result-footer">
              <button className="ghost-button" onClick={returnToCamp}>
                <ArrowLeft size={16} />
                返回守望者营地
              </button>
              {pendingLoot ? (
                <button className="gold-button" onClick={redirectPendingLoot}>
                  去领取保留战利品 <ArrowRight size={16} />
                </button>
              ) : result.chapter ? (
                <button className="gold-button" onClick={readVictoryReport}>
                  {finale ? '阅读主线结局' : '回营阅读战报'} <BookOpen size={16} />
                </button>
              ) : (
                <button
                  className="gold-button"
                  onClick={quickItems.length > 0 ? () => continueRun(true) : repeatExpedition}
                >
                  {quickItems.length > 0
                    ? `补齐 ${quickItems.length} 个空槽并${continueLabel}`
                    : repeatLabel}{' '}
                  <Swords size={16} />
                </button>
              )}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
