import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Compass,
  Crown,
  Diamond,
  FlaskConical,
  Gem,
  Hammer,
  Heart,
  Hexagon,
  Maximize,
  Minimize,
  Moon,
  Pause,
  PawPrint,
  Package,
  Play,
  Settings,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Volume2,
  VolumeX,
  Wind,
  X,
  Zap,
} from './ui/PixelIcons';
import { CLASSES } from './data/classes';
import { SKILLS } from './data/skillTrees';
import { STAGES } from './data/stages';
import {
  availableSkillPoints,
  getLootProfile,
  getProgressionMilestones,
  skillLearningStatus,
} from './data/progression';
import { RARITY_COLORS, RARITY_NAMES } from './core/types';
import type { Rarity } from './core/types';
import { useGameStore, createCombatConfig } from './state/gameStore';
import { useCloudStore } from './state/cloudStore';
import { SystemsModal } from './ui/SystemsModal';
import { HeroArt } from './ui/SceneArt';
import { NpcHall } from './ui/NpcHall';
import { VirtualJoystick } from './ui/VirtualJoystick';
import { SkillIcon } from './ui/AssetIcon';
import { AdventureGuide } from './ui/AdventureGuide';
import { useDialog } from './ui/useDialog';
import { SETS } from './data/sets';
import { BUILD_GUIDES } from './data/buildGuides';
import { GameEngine, getActiveSkills } from './engine/GameEngine';
import type { CombatConfig, CombatSnapshot, RunResult } from './core/types';
import { formatBigNumber, formatTime } from './core/format';
import { audio } from './audio/SynthAudio';
import './styles.css';

const NAV = [
  { id: 'character', label: '角色装备', sub: 'CHARACTER', icon: Shield },
  { id: 'stash', label: '共享仓库', sub: 'ACCOUNT STASH', icon: Package },
  { id: 'skills', label: '技能之书', sub: 'SKILLS', icon: BookOpen },
  { id: 'cube', label: '魔盒共鸣', sub: 'RESONANCE', icon: Hexagon },
  { id: 'forge', label: '余烬铁匠', sub: 'BLACKSMITH', icon: Hammer },
  { id: 'gamble', label: '米娅秘藏', sub: 'MYSTERIES', icon: Diamond },
  { id: 'pets', label: '契约伙伴', sub: 'COMPANIONS', icon: PawPrint },
  { id: 'leaderboard', label: '职业榜单', sub: 'CLASS RANKINGS', icon: Crown },
];
function App() {
  const { save, ready, notice, hydrate, setNotice, selectStage, updateSettings, completeRun } =
    useGameStore();
  const [panel, setPanel] = useState<string | null>(null);
  const [config, setConfig] = useState<CombatConfig | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [runSummary, setRunSummary] = useState('');
  const [showGuide, setShowGuide] = useState(false);
  const [bootReady, setBootReady] = useState(false);
  const labBackup = useGameStore((s) => s.labBackup);
  const cloudStatus = useCloudStore((s) => s.status);
  const cloudDirty = useCloudStore((s) => s.dirty);
  const cloudLabel = {
    guest: '访客冒险 · 本机自动保存',
    choosing: '已登录 · 请选择云端档案',
    online: cloudDirty ? '云端冒险 · 等待同步' : '云端冒险 · 已同步',
    offline: '云端暂不可用 · 进度保留本机',
    expired: '登录已过期 · 请重新登录同步',
    conflict: '存档存在冲突 · 点击选择保留版本',
  }[cloudStatus];
  const account = useGameStore((s) => s.accounts.find((entry) => entry.id === s.activeAccountId));
  const character = account?.characters.find((entry) => entry.id === account.activeCharacterId);
  const classDef = CLASSES.find((c) => c.id === save.classId) ?? CLASSES[0];
  const stats = useGameStore.getState().getStats();
  const lootProfile = getLootProfile(save.selectedStage);
  const nextMilestone = getProgressionMilestones(save).find((milestone) => !milestone.claimed);
  const rewardReady =
    !!nextMilestone && (save.progression?.clearedStage ?? 0) >= nextMilestone.stage;
  const activeSet = SETS.filter((set) => set.classId === save.classId)
    .map((set) => ({
      ...set,
      count: Object.values(save.equipment).filter((item) => item?.setId === set.id).length,
    }))
    .sort((a, b) => b.count - a.count)[0];
  const buildGuide = activeSet?.count >= 2 ? BUILD_GUIDES[activeSet.id] : undefined;
  const points = availableSkillPoints(save);
  const canLearn = SKILLS.some(
    (skill) => skill.classId === save.classId && skillLearningStatus(save, skill).canLearn,
  );
  const movementLearned = SKILLS.some(
    (skill) => skill.classId === save.classId && skill.kind === 'movement' && save.skills[skill.id],
  );
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
    void hydrate()
      .then(() => useCloudStore.getState().initialize())
      .finally(() => setBootReady(true));
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
  useEffect(() => {
    if (ready && bootReady && !save.tutorialSeen && !labBackup && !config && !panel)
      setShowGuide(true);
  }, [ready, bootReady, save.tutorialSeen, labBackup, config, panel]);
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
    useGameStore.getState().setInCombat(false);
    setConfig(null);
    audio.setTrack('town');
  };
  const finish = (r: RunResult) => {
    if (!config?.training) completeRun(r);
    setRunSummary(config?.training ? '训练不发放奖励。' : useGameStore.getState().notice);
    setResult(r);
    audio.play(r.won ? 'victory' : 'death');
  };
  if (!ready || !bootReady)
    return (
      <div className="loading-screen">
        <div className="brand-sigil">◇</div>
        <h1>雾隐</h1>
        <p>正在唤醒守望者营地…</p>
      </div>
    );
  return (
    <div className={`app ${config ? 'in-combat' : ''} orientation-${save.orientation}`}>
      {!config && (
        <>
          {labBackup && (
            <div className="lab-banner">
              <FlaskConical size={15} />
              <span>流派演武中 · 体验进度独立保存</span>
              <button onClick={() => useGameStore.getState().leaveLab()}>
                结束体验，返回开荒 <ArrowRight size={13} />
              </button>
            </div>
          )}
          <header className="topbar">
            <a className="brand" href="#" aria-label="雾隐首页" onClick={(e) => e.preventDefault()}>
              <span className="brand-sigil">♜</span>
              <span>
                <strong>雾 隐</strong>
                <small>MIST CONTINENT</small>
              </span>
            </a>
            <div className="season-badge">
              <span className="status-dot" /> 第一赛季 <span className="separator">/</span> 永夜将至
            </div>
            <div className="currencies">
              <span title="金币">
                <Coins />
                <b>{formatBigNumber(save.gold)}</b>
              </span>
              <span title="神秘碎片">
                <Diamond />
                <b>{formatBigNumber(save.shards)}</b>
              </span>
              <span title="奥术结晶">
                <Gem />
                <b>{formatBigNumber(save.crystals)}</b>
              </span>
            </div>
            <div className="top-actions">
              <button
                className="icon-button guide-shortcut"
                aria-label="新手教程与冒险指南"
                onClick={() => setShowGuide(true)}
              >
                <BookOpen />
              </button>
              <button className="text-button account-shortcut" onClick={() => open('accounts')}>
                <span className="account-full-label">{account?.name ?? '本地账号'} · 角色</span>
                <span className="account-compact-label">角色</span>
              </button>
              <button
                className="icon-button mute-shortcut"
                aria-label={save.muted ? '开启音效' : '静音'}
                onClick={() => updateSettings({ muted: !save.muted })}
              >
                {save.muted ? <VolumeX /> : <Volume2 />}
              </button>
              <button
                className="icon-button"
                aria-label="游戏设置"
                onClick={() => open('settings')}
              >
                <Settings />
              </button>
            </div>
          </header>
          <main className="town-layout">
            <aside className="character-sidebar">
              <div className="sidebar-caption">
                <span className="eyebrow">THE WATCHER</span>
                <button className="text-button" onClick={() => setShowGuide(true)}>
                  冒险指南 <BookOpen size={13} />
                </button>
              </div>
              <div className="hero-heading">
                <div>
                  <h2>{labBackup ? classDef.name : (character?.name ?? classDef.name)}</h2>
                  <p>
                    {classDef.name} · {classDef.title}
                  </p>
                </div>
                <span className="level-medallion">
                  <small>等级</small>
                  {save.level}
                </span>
              </div>
              <div className="hero-portrait">
                <div className="portrait-runes">ᛟ　ᚷ　ᛉ　ᚹ　ᛟ</div>
                <HeroArt classId={save.classId} />
                <div className="hero-floor" />
                <span className="portrait-caption">
                  {classDef.weapon} · {classDef.mainStat}
                </span>
              </div>
              <button className="outline-button full-width" onClick={() => open('accounts')}>
                选择角色 · 每账号 6 个角色位 <ChevronRight size={15} />
              </button>
              <div className="hero-stats">
                <div>
                  <Swords size={15} />
                  <span>攻击力</span>
                  <b>{formatBigNumber(stats.attack)}</b>
                </div>
                <div>
                  <Heart size={15} />
                  <span>生命值</span>
                  <b>{formatBigNumber(stats.hp)}</b>
                </div>
                <div>
                  <Shield size={15} />
                  <span>护甲值</span>
                  <b>{formatBigNumber(stats.armor)}</b>
                </div>
              </div>
              <button className="outline-button full-width" onClick={() => open('character')}>
                角色与装备 <ArrowRight size={15} />
              </button>
              <div className="sidebar-divider" />
              <button className="small-feature" onClick={() => open('pets')}>
                <PawPrint />
                <div>
                  <strong>契约之灵</strong>
                  <small>旅途漫长，幸有同伴</small>
                </div>
                <ChevronRight size={15} />
              </button>
            </aside>
            <section className="camp-panel hall-panel">
              <NpcHall
                onNavigate={open}
                onTrain={() => enter(true)}
                active={!panel && !showGuide}
              />
            </section>
            <aside className="adventure-sidebar">
              <div className="eyebrow">YOUR NEXT CHAPTER</div>
              <h2>深入迷雾</h2>
              <p className="muted intro-copy">
                光明止步之处，
                <br />
                是你的征途。
              </p>
              <div className="rift-card">
                <div className="rift-crest">
                  <Compass size={60} strokeWidth={0.8} />
                  <span>Ⅰ</span>
                </div>
                <div className="rift-tier">源 初 秘 境</div>
                <div className="stage-picker">
                  <button
                    aria-label="降低秘境层数"
                    disabled={save.selectedStage <= 1}
                    onClick={() => selectStage(save.selectedStage - 1)}
                  >
                    <ChevronLeft />
                  </button>
                  <span>
                    <small>第</small> {save.selectedStage.toString().padStart(2, '0')}{' '}
                    <small>层</small>
                  </span>
                  <button
                    aria-label="提高秘境层数"
                    disabled={save.selectedStage >= save.highestStage}
                    onClick={() => selectStage(save.selectedStage + 1)}
                  >
                    <ChevronRight />
                  </button>
                </div>
                <select
                  className="stage-select"
                  aria-label="选择已解锁秘境"
                  value={save.selectedStage}
                  onChange={(e) => selectStage(Number(e.target.value))}
                >
                  {STAGES.filter((s) => s.level <= save.highestStage).map((s) => (
                    <option key={s.level} value={s.level}>
                      第 {s.level} 层 · {s.difficulty}
                    </option>
                  ))}
                </select>
                <div className="rift-details">
                  <span>
                    <Wind size={13} /> {STAGES[save.selectedStage - 1]?.name}
                  </span>
                  <span>限时 05:00</span>
                </div>
                <div className="rift-rewards">
                  <span>{lootProfile.label}</span>
                  <div>
                    {Object.entries(lootProfile.chances)
                      .filter(([, chance]) => chance > 0)
                      .map(([rarity, chance]) => (
                        <span
                          key={rarity}
                          className="reward-icon"
                          style={{ color: RARITY_COLORS[rarity as Rarity] }}
                          title={`${RARITY_NAMES[rarity as Rarity]} ${(chance * 100).toFixed(1)}%`}
                        >
                          <Gem size={19} />
                        </span>
                      ))}
                  </div>
                  <small>
                    {nextMilestone
                      ? `下个首通目标 · ${nextMilestone.stage} 层 ${nextMilestone.title}`
                      : '旅程奖励已集齐 · 继续追寻太古'}
                  </small>
                </div>
                <button className="text-button full-width" onClick={() => open('journey')}>
                  查看掉落与套装旅程 <ArrowRight size={14} />
                </button>
                <button className="enter-button" onClick={() => enter()}>
                  <span>踏入秘境</span>
                  <ArrowRight size={19} />
                </button>
              </div>
              <button className="journal-card" onClick={() => open('pets')}>
                <span className="journal-icon">
                  <Crown size={20} />
                </span>
                <div>
                  <span className="eyebrow">SEASON JOURNEY</span>
                  <strong>永夜行者</strong>
                  <small>已征服 {save.clears} 座秘境</small>
                </div>
                <ChevronRight size={14} />
              </button>
              <div className="camp-tip">
                <Sparkles size={15} />
                <p>
                  移动即输出。
                  <br />
                  把专注留给每一次走位。
                </p>
              </div>
            </aside>
          </main>
          {buildGuide && (
            <section className="current-build" aria-label="当前流派">
              <div>
                <span className="eyebrow">
                  YOUR BUILD · {activeSet.count >= 4 ? '四件成型' : '二件共鸣'}
                </span>
                <strong>
                  {activeSet.name} · {buildGuide.style}
                </strong>
              </div>
              <p>
                {buildGuide.range} · {activeSet.count >= 4 ? buildGuide.rotation : activeSet.two}
              </p>
              <button className="text-button" onClick={() => open('lab')}>
                查看流派打法 <ArrowRight size={14} />
              </button>
            </section>
          )}
          <section className="camp-next-step" aria-label="冒险待办">
            <div className="next-step-intro">
              <Compass size={22} />
              <div>
                <span className="eyebrow">NEXT STEP</span>
                <strong>
                  {canLearn
                    ? `有 ${points} 点可分配，先学习技能`
                    : rewardReady
                      ? '首通奖励已就绪'
                      : save.inventory.length
                        ? '整理战利品，再次出发'
                        : '从第一场远征开始'}
                </strong>
              </div>
            </div>
            <div className="camp-tasks">
              <button onClick={() => open('skills')}>
                <BookOpen size={16} />
                <span>
                  技能之书<small>{points > 0 ? `${points} 点待分配` : '升级获得技能点'}</small>
                </span>
                {canLearn && <i className="status-dot" />}
              </button>
              <button onClick={() => open('character')}>
                <Shield size={16} />
                <span>
                  角色装备<small>背包 {save.inventory.length} / 240</small>
                </span>
              </button>
              <button onClick={() => open('journey')}>
                <Compass size={16} />
                <span>
                  套装旅程
                  <small>
                    {rewardReady
                      ? '可以领取奖励'
                      : nextMilestone
                        ? `下一目标 ${nextMilestone.stage} 层`
                        : '查看掉落与共鸣'}
                  </small>
                </span>
              </button>
            </div>
          </section>
          <nav className="bottom-nav" aria-label="营地功能">
            {NAV.map((n) => (
              <button key={n.id} onClick={() => open(n.id)}>
                <n.icon size={22} strokeWidth={1.3} />
                <span>
                  {n.label}
                  <small>{n.sub}</small>
                </span>
                <ChevronRight className="nav-chevron" size={13} />
              </button>
            ))}
          </nav>
          <nav className="mobile-dock" aria-label="手机快捷操作">
            <button onClick={() => open('character')}>
              <Shield size={21} />
              <span>装备</span>
            </button>
            <button onClick={() => open('skills')}>
              <BookOpen size={21} />
              <span>技能{canLearn && <i className="status-dot" />}</span>
            </button>
            <button
              className="dock-expedition"
              onClick={() => enter()}
              disabled={useGameStore.getState().cloudTransition}
            >
              <Compass size={24} />
              <span>出征 · {save.selectedStage} 层</span>
            </button>
            <button onClick={() => open('leaderboard')}>
              <Crown size={21} />
              <span>职业榜</span>
            </button>
            <button onClick={() => open('services')}>
              <Package size={21} />
              <span>更多</span>
            </button>
          </nav>
          <footer className="town-footer">
            <button className="text-button" onClick={() => open('accounts')}>
              <span className="status-dot" /> {cloudLabel}
            </button>
            <span>
              WASD 移动 <i /> 1–6 施放技能 <i /> {movementLearned ? '空格 位移' : 'Lv.3 学习位移'}
            </span>
            <span>
              雾隐编年史 <span className="gold">v1.0</span>
            </span>
          </footer>
        </>
      )}
      {config && <CombatView config={config} onLeave={leave} onFinish={finish} />}
      <SystemsModal panel={panel} onClose={() => setPanel(null)} onNavigate={setPanel} />
      {notice && (
        <div className="toast" role={panel ? undefined : 'status'}>
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
            <span className="eyebrow">{result.won ? 'RIFT CONQUERED' : 'THE MIST REMAINS'}</span>
            <h2>{result.won ? '秘境已征服' : '在篝火旁重整'}</h2>
            <p>源初秘境 · 第 {result.stage} 层</p>
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
                <span>神秘碎片</span>
                <strong>+{result.shards}</strong>
              </div>
            </div>
            <p className="muted">
              战场掉落 {result.items.length} 件装备 · {formatBigNumber(result.gold)} 金币
            </p>
            <p className="run-progression-summary">{runSummary}</p>
            <div className="result-actions">
              <button
                className="gold-button full-width"
                onClick={() => {
                  if (result.won) selectStage(save.highestStage);
                  enter(!!config?.training);
                }}
              >
                {result.won ? `挑战第 ${save.highestStage} 层` : '再次挑战本层'}{' '}
                <Swords size={16} />
              </button>
              <button
                className="outline-button full-width"
                onClick={() => {
                  returnToCamp();
                  open(result.won ? 'character' : 'skills');
                }}
              >
                {result.won ? '回营整理装备' : '回营调整技能'} <ArrowRight size={16} />
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
  onLeave,
  onFinish,
}: {
  config: CombatConfig;
  onLeave: () => void;
  onFinish: (result: RunResult) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<GameEngine | null>(null);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const [snapshot, setSnapshot] = useState<CombatSnapshot | null>(null);
  const [error, setError] = useState('');
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
    void game
      .init(host.current!, config, {
        onSnapshot: (s) => {
          if (!cancelled) setSnapshot(s);
        },
        onFinish: (r) => {
          if (!cancelled) onFinishRef.current(r);
        },
        onSound: (n) => {
          if (n === 'boss') audio.setTrack('boss');
          audio.play(n);
        },
      })
      .then(() => {
        if (cancelled) game.destroy();
      })
      .catch((e) => {
        if (!cancelled) setError(`战场加载失败：${e instanceof Error ? e.message : String(e)}`);
      });
    return () => {
      cancelled = true;
      game.destroy();
      engine.current = null;
    };
  }, [config]);
  const toggleAuto = (id: string) => {
    const next = !(auto[id] ?? SKILLS.find((s) => s.id === id)?.kind !== 'movement');
    setAuto({ ...auto, [id]: next });
    engine.current?.setAuto(id, next);
    const current = useGameStore.getState();
    if (
      (current.save.autoSkills[id] ??
        SKILLS.find((skill) => skill.id === id)?.kind !== 'movement') !== next
    )
      current.toggleAuto(id);
  };
  return (
    <section className="combat-screen">
      <div className="combat-canvas" ref={host} />
      <div className="combat-top">
        <button className="icon-button" aria-label="返回营地" onClick={askLeave}>
          <ArrowLeft />
        </button>
        <div className="rift-progress">
          <div>
            <span>{config.training ? '秘境演武场' : `源初秘境 · 第 ${config.stage} 层`}</span>
            <b>{config.training ? '∞' : formatTime(snapshot?.seconds ?? 300)}</b>
          </div>
          <div className="progress-track">
            <i style={{ width: `${snapshot?.progress ?? 0}%` }} />
          </div>
          <small>
            {snapshot?.boss ? '守关魔王已降临' : `秘境进度 ${Math.floor(snapshot?.progress ?? 0)}%`}{' '}
            <span>{snapshot?.kills ?? 0} 击败</span>
          </small>
        </div>
        <button
          className="icon-button"
          aria-label={snapshot?.paused ? '继续战斗' : '暂停战斗'}
          onClick={() => engine.current?.togglePause()}
        >
          {snapshot?.paused ? <Play /> : <Pause />}
        </button>
      </div>
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
            const automatic = auto[s.id] ?? s.kind !== 'movement';
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
        WASD / 拖动移动 · {movement ? `空格 ${movement.name}` : 'Lv.3 回营学习位移'} · Esc 暂停
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
          <h2>时间已静止</h2>
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
              {config.training
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
