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
} from 'lucide-react';
import { CLASSES } from './data/classes';
import { SKILLS } from './data/skillTrees';
import { STAGES } from './data/stages';
import { useGameStore, createCombatConfig } from './state/gameStore';
import { SystemsModal } from './ui/SystemsModal';
import { HeroArt, TownScene } from './ui/SceneArt';
import { VirtualJoystick } from './ui/VirtualJoystick';
import { SkillIcon } from './ui/AssetIcon';
import { GameEngine, getActiveSkills } from './engine/GameEngine';
import type { CombatConfig, CombatSnapshot, RunResult } from './core/types';
import { formatBigNumber, formatTime } from './core/format';
import { audio } from './audio/SynthAudio';
import './styles.css';

const NAV = [
  { id: 'character', label: '角色装备', sub: 'CHARACTER', icon: Shield },
  { id: 'skills', label: '技能之书', sub: 'SKILLS', icon: BookOpen },
  { id: 'cube', label: '魔盒共鸣', sub: 'RESONANCE', icon: Hexagon },
  { id: 'forge', label: '余烬铁匠', sub: 'BLACKSMITH', icon: Hammer },
  { id: 'gamble', label: '米娅秘藏', sub: 'MYSTERIES', icon: Diamond },
  { id: 'pets', label: '契约伙伴', sub: 'COMPANIONS', icon: PawPrint },
];
const CLASS_GLYPHS = ['⌁', '⚒', '✧', '☽', 'ϟ'];
function App() {
  const {
    save,
    ready,
    notice,
    hydrate,
    setNotice,
    selectClass,
    selectStage,
    updateSettings,
    completeRun,
  } = useGameStore();
  const [panel, setPanel] = useState<string | null>(null);
  const [config, setConfig] = useState<CombatConfig | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const labBackup = useGameStore((s) => s.labBackup);
  const classDef = CLASSES.find((c) => c.id === save.classId) ?? CLASSES[0];
  const stats = useGameStore.getState().getStats();
  useEffect(() => {
    void hydrate();
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
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanel(null);
        setShowGuide(false);
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
  const open = (id: string) => {
    audio.play('click');
    setPanel(id);
  };
  const enter = (training = false) => {
    setNotice('');
    audio.play('pylon');
    audio.setTrack('rift');
    setResult(null);
    setConfig({ ...createCombatConfig(save), training });
  };
  const leave = () => {
    setConfig(null);
    audio.setTrack('town');
  };
  const finish = (r: RunResult) => {
    if (!config?.training) completeRun(r);
    setResult(r);
    audio.play(r.won ? 'victory' : 'death');
  };
  if (!ready)
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
                className="icon-button"
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
                  <h2>{classDef.name}</h2>
                  <p>{classDef.title}</p>
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
              <div className="class-selector" aria-label="切换职业">
                {CLASSES.map((c, i) => (
                  <button
                    key={c.id}
                    title={`切换为${c.name}`}
                    className={c.id === save.classId ? 'active' : ''}
                    onClick={() => {
                      selectClass(c.id);
                      audio.play('equip');
                    }}
                    aria-label={`切换为${c.name}`}
                    aria-pressed={c.id === save.classId}
                  >
                    {CLASS_GLYPHS[i]}
                  </button>
                ))}
              </div>
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
              <div
                className="small-feature"
                onClick={() => open('pets')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && open('pets')}
              >
                <PawPrint />
                <div>
                  <strong>契约之灵</strong>
                  <small>旅途漫长，幸有同伴</small>
                </div>
                <ChevronRight size={15} />
              </div>
            </aside>
            <section className="camp-panel">
              <TownScene />
              <div className="scene-shade" />
              <div className="location-heading">
                <div className="eyebrow">
                  <span className="status-dot" /> SANCTUARY · 安全区域
                </div>
                <h1>守望者营地</h1>
                <p>迷雾未散，篝火不熄。</p>
              </div>
              <button className="lab-shortcut" aria-label="流派实验室" onClick={() => open('lab')}>
                <FlaskConical size={16} />
                <span>流派实验室</span>
                <ArrowRight size={14} />
              </button>
              <div className="scene-label portal-label">
                <span className="floating-marker">
                  <Compass size={20} />
                </span>
                <span>源初之门</span>
                <small>THE PRIMORDIAL RIFT</small>
              </div>
              <button className="scene-hotspot forge-hotspot" onClick={() => open('forge')}>
                <Hammer size={16} />
                <span>余烬铁匠</span>
              </button>
              <button className="scene-hotspot cube-hotspot" onClick={() => open('cube')}>
                <Hexagon size={16} />
                <span>魔盒祭坛</span>
              </button>
              <button className="scene-hotspot gamble-hotspot" onClick={() => open('gamble')}>
                <Diamond size={16} />
                <span>米娅秘藏</span>
              </button>
              <div className="camp-bottom">
                <span>
                  <Moon size={14} /> 暮色纪元 · 第七日
                </span>
                <button className="text-button" onClick={() => enter(true)}>
                  <Swords size={14} /> 训练木桩 <ArrowRight size={14} />
                </button>
              </div>
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
                  <span>秘境馈赠</span>
                  <div>
                    <span title="传奇装备" className="reward-icon legendary">
                      <Swords />
                    </span>
                    <span title="套装部件" className="reward-icon set">
                      <Shield />
                    </span>
                    <span title="神秘碎片" className="reward-icon shard">
                      <Diamond />
                    </span>
                  </div>
                  <small>前 3 层必掉核心传奇</small>
                </div>
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
          <footer className="town-footer">
            <span>
              <span className="status-dot" /> 本地冒险 · 每 3 秒自动保存
            </span>
            <span>
              WASD 移动 <i /> 1–6 施放技能 <i /> 空格 闪避
            </span>
            <span>
              雾隐编年史 <span className="gold">v1.0</span>
            </span>
          </footer>
        </>
      )}
      {config && <CombatView config={config} onLeave={leave} onFinish={finish} />}
      <SystemsModal panel={panel} onClose={() => setPanel(null)} />
      {notice && (
        <div className="toast" role="status">
          <Sparkles size={17} />
          <span>{notice}</span>
          <button aria-label="关闭提示" onClick={() => setNotice('')}>
            <X size={14} />
          </button>
        </div>
      )}
      {showGuide && (
        <div className="modal-backdrop" onClick={() => setShowGuide(false)}>
          <section
            className="modal guide-modal"
            role="dialog"
            aria-modal="true"
            aria-label="冒险指南"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-header">
              <div>
                <span className="eyebrow">A WATCHER'S HANDBOOK</span>
                <h2>迷雾中的第一步</h2>
              </div>
              <button className="icon-button" aria-label="关闭" onClick={() => setShowGuide(false)}>
                <X />
              </button>
            </header>
            <div className="modal-body">
              <div className="guide-step">
                <b>01</b>
                <div>
                  <h3>走位，就是你的武器</h3>
                  <p>
                    WASD、方向键或按住战场拖动移动。技能会自动攻击附近敌人，空格施放位移；技能栏可切换自动与手动。
                  </p>
                </div>
              </div>
              <div className="guide-step">
                <b>02</b>
                <div>
                  <h3>收集力量，唤醒守关者</h3>
                  <p>
                    击败精英并拾取紫色进度球，进度达到 100% 后首领降临。远离红色预警，善用四种圣坛。
                  </p>
                </div>
              </div>
              <div className="guide-step">
                <b>03</b>
                <div>
                  <h3>让装备改变你的战斗</h3>
                  <p>
                    四件套解锁流派核心，传奇可萃取进魔盒。想直接感受毕业配装？前往流派实验室，退出演武后恢复原有进度。
                  </p>
                </div>
              </div>
              <button className="gold-button full-width" onClick={() => setShowGuide(false)}>
                篝火之外，旅途开始 <ArrowRight size={16} />
              </button>
            </div>
          </section>
        </div>
      )}
      {result && (
        <div className="modal-backdrop result-backdrop">
          <section className="result-card" role="dialog" aria-modal="true" aria-label="秘境结算">
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
              获得 {result.items.length} 件装备 · {formatBigNumber(result.gold)} 金币
            </p>
            <button
              className="gold-button full-width"
              onClick={() => {
                setResult(null);
                leave();
              }}
            >
              返回守望者营地 <ArrowRight size={16} />
            </button>
          </section>
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
  const [auto, setAuto] = useState(config.autoSkills);
  const save = useGameStore((s) => s.save);
  const updateSettings = useGameStore((s) => s.updateSettings);
  const skills = getActiveSkills(config);
  useEffect(() => {
    let cancelled = false;
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
  };
  return (
    <section className="combat-screen">
      <div className="combat-canvas" ref={host} />
      <div className="combat-top">
        <button
          className="icon-button"
          aria-label="返回营地"
          onClick={() => {
            if (!snapshot?.paused) engine.current?.togglePause();
            setLeaveDialog(true);
          }}
        >
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
            return (
              <div className={`combat-skill element-${s.element}`} key={s.id}>
                <button
                  className="auto-toggle"
                  aria-label={`切换${s.name}自动施法`}
                  onClick={() => toggleAuto(s.id)}
                >
                  {(auto[s.id] ?? s.kind !== 'movement') ? 'AUTO' : '手动'}
                </button>
                <button
                  className="skill-cast"
                  title={s.description}
                  aria-label={`施放${s.name}`}
                  onClick={() => engine.current?.cast(s.id)}
                >
                  <span className="skill-symbol">
                    <SkillIcon skillId={s.id} size={38} />
                  </span>
                  {cd > 0 && <span className="cooldown-overlay">{cd.toFixed(1)}</span>}
                  <small className="keybind">{i + 1}</small>
                </button>
                <span className="skill-name">{s.name}</span>
              </div>
            );
          })}
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
      <VirtualJoystick onMove={(x, y) => engine.current?.setMovement(x, y)} />
      <div className="combat-help">WASD / 拖动移动 · 空格闪避 · 自动施法 · 手柄左摇杆移动</div>
      {snapshot?.paused && !leaveDialog && (
        <div className="paused-label">
          <Moon />
          <h2>时间已静止</h2>
          <button className="gold-button" onClick={() => engine.current?.togglePause()}>
            继续征途 <Play size={16} />
          </button>
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
          <div className="card exit-card">
            <h2>返回营地</h2>
            <p>本次未结算的战利品将留在迷雾中。</p>
            <div>
              <button
                className="ghost-button"
                onClick={() => {
                  setLeaveDialog(false);
                  engine.current?.togglePause();
                }}
              >
                继续战斗
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
