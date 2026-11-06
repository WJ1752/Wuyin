import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import type { LobbyActivity, LobbyPlayer, LobbyResponse } from '../core/types';
import { RARITY_COLORS, RARITY_NAMES, SLOT_NAMES } from '../core/types';
import { CLASSES } from '../data/classes';
import { clampHallPosition, HALL_LAYOUT, HALL_NPCS } from '../data/npcHall';
import type { HallNpc } from '../data/npcHall';
import { NPC_ART, NPC_ATLAS } from '../data/npcVisuals';
import { CHARACTER_ART } from '../render/CharacterTextures';
import { apiRequest, useCloudStore } from '../state/cloudStore';
import { useGameStore } from '../state/gameStore';
import { formatBigNumber } from '../core/format';
import {
  BookOpen,
  ChevronRight,
  Crown,
  Diamond,
  Hammer,
  Hexagon,
  Package,
  PawPrint,
  X,
} from './PixelIcons';
import { CAMP_ART, HallScene } from './HallScene';
import { HeroArt } from './SceneArt';
import { VirtualJoystick } from './VirtualJoystick';
import { useDialog } from './useDialog';
import { usePageVisible } from './usePageVisible';
import './actor-motion.css';
import './npc-hall.css';
import { DEFAULT_KEYS } from '../core/preferences';
import { actionKey } from './inputLabels';
import { pointerDragRadius } from '../core/pointerMovement';

const NPC_ICONS: Record<string, typeof Hammer> = {
  forge: Hammer,
  skills: BookOpen,
  cube: Hexagon,
  gamble: Diamond,
  pets: PawPrint,
  stash: Package,
  leaderboard: Crown,
};
const ACTIVITIES: Record<string, string> = {
  town: '营地休整',
  forge: '锻造装备',
  skills: '研习技能',
  stash: '整理仓库',
  cube: '魔盒共鸣',
  pets: '照看伙伴',
  gamble: '挑选秘藏',
  rift: '准备远征',
};
const START: { x: number; y: number } = HALL_LAYOUT.spawn;
const INTERACTION_DISTANCE = 82;
const ART_LOAD_TIMEOUT = 15000;
const HALL_ASPECT = HALL_LAYOUT.world.width / HALL_LAYOUT.world.height;
// CSS and Pixi use the same image origin: the actor's coordinate is its ground contact.
const characterOrigin = (classId: keyof typeof CHARACTER_ART): CSSProperties =>
  ({
    '--art-left': `${(0.5 - CHARACTER_ART[classId].anchorX) * 100}%`,
    '--art-bottom': `${(CHARACTER_ART[classId].ground - 1) * 100}%`,
    '--art-anchor': `${CHARACTER_ART[classId].anchorX * 100}% ${CHARACTER_ART[classId].ground * 100}%`,
  }) as CSSProperties;

export function NpcHall({
  onNavigate,
  active,
}: {
  onNavigate: (panel: string) => void;
  active: boolean;
}) {
  const pageVisible = usePageVisible();
  const save = useGameStore((state) => state.save);
  const bindings = { ...DEFAULT_KEYS, ...save.preferences?.keyBindings };
  const bindingRef = useRef(bindings);
  bindingRef.current = bindings;
  const keyboardInteract = ![bindings.up, bindings.down, bindings.left, bindings.right].includes(
    'KeyE',
  );
  const accounts = useGameStore((state) => state.accounts);
  const activeAccountId = useGameStore((state) => state.activeAccountId);
  const labBackup = useGameStore((state) => state.labBackup);
  const userId = useCloudStore((state) => state.user?.id);
  const cloudStatus = useCloudStore((state) => state.status);
  const account = accounts.find((entry) => entry.id === activeAccountId);
  const character = account?.characters.find((entry) => entry.id === account.activeCharacterId);
  const viewport = useRef<HTMLElement>(null);
  const [viewSize, setViewSize] = useState({ width: 720, height: 680 });
  const board = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(START);
  const positionRef = useRef(START);
  const [walking, setWalking] = useState(false);
  const walkingRef = useRef(false);
  const [facing, setFacing] = useState(1);
  const [target, setTarget] = useState<{ x: number; y: number } | null>(null);
  const targetRef = useRef(target);
  const dragMove = useRef({ x: 0, y: 0 });
  const drag = useRef<{ id: number; x: number; y: number; radius: number; moved: boolean } | null>(
    null,
  );
  const keys = useRef(new Set<string>());
  const [selectedNpcId, setSelectedNpcId] = useState<string | null>(null);
  const [players, setPlayers] = useState<LobbyPlayer[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [network, setNetwork] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const [artAttempt, setArtAttempt] = useState(0);
  const [artStatus, setArtStatus] = useState<Record<string, 'ready' | 'error'>>({});
  const artSrc = (src: string) => (artAttempt ? `${src}?retry=${artAttempt}` : src);
  const heroArt = artSrc(CHARACTER_ART[save.classId].src);
  const mapArt = artSrc(CAMP_ART);
  const npcArt = artSrc(NPC_ATLAS);
  const waitingForArt = [mapArt, npcArt, heroArt].some((src) => !artStatus[src]);
  const failedArt = [mapArt, npcArt, heroArt].some((src) => artStatus[src] === 'error');
  const markArt = (src: string, status: 'ready' | 'error') =>
    setArtStatus((old) => (old[src] === status ? old : { ...old, [src]: status }));
  const [publishError, setPublishError] = useState('');
  const [inspectedPlayer, setInspectedPlayer] = useState<LobbyPlayer | null>(null);
  const profileRef = useDialog(!!inspectedPlayer, () => setInspectedPlayer(null));
  const activity = useRef<LobbyActivity>('town');
  const navigate = useRef(onNavigate);
  navigate.current = onNavigate;
  targetRef.current = target;
  const canPublish = cloudStatus === 'online' && !!userId && !labBackup;
  const movingEnabled = active && !inspectedPlayer;
  // Move the entire shared ground plane so artwork, actors and pointer coordinates stay aligned.
  const worldWidth = Math.max(viewSize.width, viewSize.height * HALL_ASPECT);
  const worldHeight = worldWidth / HALL_ASPECT;
  const worldScale = worldWidth / HALL_LAYOUT.world.width;
  const compact = viewSize.width <= 960;
  const actorSize = Math.max(58, Math.min(72, Math.min(viewSize.width, viewSize.height) * 0.18));
  const cameraX = Math.min(
    0,
    Math.max(viewSize.width - worldWidth, viewSize.width / 2 - position.x * worldWidth),
  );
  const cameraY = Math.min(
    0,
    Math.max(viewSize.height - worldHeight, viewSize.height * 0.6 - position.y * worldHeight),
  );
  // Keep service reach consistent as the hall expands from a panel to the full viewport.
  const distanceTo = (point: { x: number; y: number }) =>
    Math.hypot((point.x - position.x) * 500, (point.y - position.y) * 460);
  const nearest = [...HALL_NPCS].sort((a, b) => distanceTo(a) - distanceTo(b))[0];
  const selectedNpc = HALL_NPCS.find((entry) => entry.id === selectedNpcId);
  const interactionNpc =
    selectedNpc && distanceTo(selectedNpc) <= INTERACTION_DISTANCE ? selectedNpc : nearest;
  const serviceInReach = distanceTo(interactionNpc) <= INTERACTION_DISTANCE;
  const portalDistance = Math.min(
    distanceTo(HALL_LAYOUT.portal),
    distanceTo(HALL_LAYOUT.portalPlaza),
  );
  const interactingPortal =
    portalDistance <= INTERACTION_DISTANCE &&
    !(selectedNpc && serviceInReach) &&
    portalDistance <= distanceTo(interactionNpc);
  const inReach = interactingPortal || serviceInReach;
  const interaction = useRef<() => void>(() => {});
  const otherPlayers = players.filter((player) => !player.isSelf);
  const enterPortal = () => {
    if (!movingEnabled) return;
    activity.current = 'rift';
    setSelectedNpcId(null);
    setTarget(null);
    navigate.current('expedition');
  };
  const openService = (npc: HallNpc) => {
    activity.current = ACTIVITIES[npc.panel] ? (npc.panel as LobbyActivity) : 'town';
    setSelectedNpcId(npc.id);
    setTarget(null);
    navigate.current(npc.panel);
  };
  interaction.current = () => {
    if (interactingPortal) enterPortal();
    else if (serviceInReach) openService(interactionNpc);
  };

  useEffect(() => {
    if (active) activity.current = 'town';
  }, [active]);
  useEffect(() => {
    const sources = [mapArt, npcArt, heroArt];
    // Cached images can finish before React receives their load event.
    const completed: Record<string, 'ready' | 'error'> = {};
    board.current?.querySelectorAll('img').forEach((image) => {
      const src = image.getAttribute('src');
      if (src && sources.includes(src) && image.complete)
        completed[src] = image.naturalWidth > 0 ? 'ready' : 'error';
    });
    if (Object.keys(completed).length) setArtStatus((old) => ({ ...old, ...completed }));
    const timeout = setTimeout(() => {
      setArtStatus((old) => {
        const pending = sources.filter((src) => !old[src]);
        if (!pending.length) return old;
        return { ...old, ...Object.fromEntries(pending.map((src) => [src, 'error' as const])) };
      });
    }, ART_LOAD_TIMEOUT);
    return () => clearTimeout(timeout);
  }, [mapArt, npcArt, heroArt]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () => setViewSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(element);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    let stopped = false;
    setPublishError('');
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastHeartbeat = 0;
    let published = false;
    const leave = () => {
      if (published && useCloudStore.getState().user?.id === userId)
        void apiRequest('/lobby/leave', 'POST').catch(() => {});
    };
    const refresh = async () => {
      try {
        if (canPublish && !document.hidden && Date.now() - lastHeartbeat >= 3000) {
          try {
            await apiRequest('/lobby/heartbeat', 'POST', {
              ...positionRef.current,
              activity: activity.current,
            });
            published = true;
            lastHeartbeat = Date.now();
            if (!stopped) setPublishError('');
          } catch {
            if (!stopped) setPublishError('个人位置尚未同步，可重试登录与云存档同步。');
          }
        }
        if (stopped) {
          leave();
          return;
        }
        const response = await apiRequest<LobbyResponse>('/lobby');
        if (stopped) return;
        if (!Array.isArray(response.players) || !Number.isFinite(response.onlineCount))
          throw new Error('大厅数据暂不可用');
        setPlayers(
          response.players.filter(
            (player) =>
              CHARACTER_ART[player.classId] &&
              Number.isFinite(player.x) &&
              Number.isFinite(player.y),
          ),
        );
        setOnlineCount(response.onlineCount);
        setNetwork('online');
      } catch {
        if (!stopped) {
          setPlayers([]);
          setOnlineCount(0);
          setNetwork('offline');
        }
      } finally {
        if (!stopped) timer = setTimeout(refresh, document.hidden ? 15000 : 3000);
      }
    };
    void refresh();
    window.addEventListener('pagehide', leave);
    return () => {
      stopped = true;
      clearTimeout(timer);
      window.removeEventListener('pagehide', leave);
      leave();
    };
  }, [canPublish, userId]);

  useEffect(() => {
    const reset = () => {
      keys.current.clear();
      dragMove.current = { x: 0, y: 0 };
      drag.current = null;
      targetRef.current = null;
      setTarget(null);
      walkingRef.current = false;
      setWalking(false);
    };
    if (!movingEnabled) {
      reset();
      return;
    }
    const keyDown = (event: KeyboardEvent) => {
      const element = event.target as HTMLElement | null;
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.isComposing ||
        element?.closest?.(
          'input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="dialog"]',
        ) ||
        document.querySelector('[role="dialog"][aria-modal="true"]')
      )
        return;
      if (event.code === 'Space' && element?.closest?.('button,a[href],[role="button"]')) return;
      const key = event.key.toLowerCase();
      const currentBindings = bindingRef.current;
      const movementKey = [
        currentBindings.up,
        currentBindings.down,
        currentBindings.left,
        currentBindings.right,
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ].includes(event.code);
      if (movementKey) {
        event.preventDefault();
        keys.current.add(event.code);
        targetRef.current = null;
        setTarget(null);
      }
      if (key === 'e' && !event.repeat && !movementKey) {
        event.preventDefault();
        interaction.current();
      }
    };
    const keyUp = (event: KeyboardEvent) => keys.current.delete(event.code);
    const visibility = () => {
      if (document.hidden) reset();
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', visibility);
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!document.hidden) {
        const currentBindings = bindingRef.current;
        let x =
          dragMove.current.x +
          (keys.current.has(currentBindings.right) || keys.current.has('ArrowRight') ? 1 : 0) -
          (keys.current.has(currentBindings.left) || keys.current.has('ArrowLeft') ? 1 : 0);
        let y =
          dragMove.current.y +
          (keys.current.has(currentBindings.down) || keys.current.has('ArrowDown') ? 1 : 0) -
          (keys.current.has(currentBindings.up) || keys.current.has('ArrowUp') ? 1 : 0);
        const width = board.current?.clientWidth || 500,
          height = board.current?.clientHeight || 460;
        const currentTarget = targetRef.current;
        const followingTarget = Math.hypot(x, y) < 0.05 && !!currentTarget;
        if (followingTarget && currentTarget) {
          x = (currentTarget.x - positionRef.current.x) * width;
          y = (currentTarget.y - positionRef.current.y) * height;
          if (Math.hypot(x, y) < 4) {
            x = 0;
            y = 0;
            targetRef.current = null;
            setTarget(null);
          }
        } else if (Math.hypot(x, y) >= 0.05 && currentTarget) {
          targetRef.current = null;
          setTarget(null);
        }
        const length = Math.max(1, Math.hypot(x, y));
        const isWalking = Math.hypot(x, y) > 0.05;
        if (isWalking) {
          const speed = Math.max(125, Math.min(width, height) * 0.28);
          const step = followingTarget ? Math.min(speed * dt, Math.hypot(x, y)) : speed * dt;
          const next = clampHallPosition(
            positionRef.current.x + ((x / length) * step) / width,
            positionRef.current.y + ((y / length) * step) / height,
          );
          positionRef.current = next;
          setPosition(next);
          if (Math.abs(x) > 0.05) setFacing(x < 0 ? -1 : 1);
        }
        if (walkingRef.current !== isWalking) {
          walkingRef.current = isWalking;
          setWalking(isWalking);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', reset);
      document.removeEventListener('visibilitychange', visibility);
      reset();
    };
  }, [movingEnabled]);

  const approach = (npc: HallNpc) => {
    if (!movingEnabled) return;
    if (distanceTo(npc) <= INTERACTION_DISTANCE) {
      openService(npc);
      return;
    }
    setSelectedNpcId(npc.id);
    setTarget(clampHallPosition(npc.approach.x, npc.approach.y));
  };
  const stopPointer = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const held = drag.current;
    if (!held || held.id !== event.pointerId) return;
    if (!held.moved && !cancelled) {
      const rect = event.currentTarget.getBoundingClientRect();
      setSelectedNpcId(null);
      setTarget(
        clampHallPosition(
          (event.clientX - rect.left) / rect.width,
          (event.clientY - rect.top) / rect.height,
        ),
      );
    }
    drag.current = null;
    dragMove.current = { x: 0, y: 0 };
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const status =
    network === 'offline'
      ? '离线营地'
      : network === 'connecting'
        ? '寻觅同行旅人…'
        : `${onlineCount} 位同行旅人`;
  return (
    <section
      ref={viewport}
      className="npc-hall"
      data-motion-paused={!active || !pageVisible || undefined}
      aria-label="守望者营地，可走动与NPC交互"
    >
      <header className="hall-header">
        <div>
          <h2>守望者营地</h2>
        </div>
        <span
          className={`hall-connection ${network}`}
          role="status"
          title={
            labBackup
              ? '流派演武为独立体验，不会向大厅发布虚拟配装。'
              : !canPublish
                ? '访客可浏览大厅；登录云账号后，其他旅人才能看见你。'
                : '点击在线旅人查看配装与成就。'
          }
        >
          <i />
          {status}
        </span>
      </header>
      {otherPlayers.length > 0 && (
        <div className="hall-visitors" aria-label="大厅里的真实旅人">
          {otherPlayers.map((player) => (
            <button
              key={player.id}
              onClick={() => setInspectedPlayer(player)}
              title={`查看${player.name}的装备与成就`}
            >
              <img src={CHARACTER_ART[player.classId].src} alt="" draggable={false} />
              <span>{player.name}</span>
              <small>Lv.{player.level}</small>
            </button>
          ))}
        </div>
      )}
      <div
        ref={board}
        className={`hall-map ${walking ? 'is-walking' : ''} ${waitingForArt && !failedArt ? 'awaiting-art' : ''}`}
        style={
          {
            width: HALL_LAYOUT.world.width,
            height: HALL_LAYOUT.world.height,
            transform: `translate3d(${cameraX}px, ${cameraY}px, 0) scale(${worldScale})`,
            '--hall-character-size': compact ? `${actorSize / worldScale}px` : '88px',
            '--hall-npc-size': compact ? `${(actorSize * 0.9) / worldScale}px` : '68px',
            '--hall-label-factor': compact ? 1 / worldScale : 1,
          } as CSSProperties
        }
        role="group"
        aria-label={`营地地图，${(['up', 'left', 'down', 'right'] as const).map((action) => actionKey(save.preferences, action)).join(' ')}或方向键移动，点击地面前往，靠近居民后${keyboardInteract ? '按E或点击' : '点击'}交互`}
        aria-describedby="hall-controls-help"
        tabIndex={0}
        onPointerDown={(event) => {
          if (
            !movingEnabled ||
            event.button !== 0 ||
            !event.isPrimary ||
            drag.current ||
            (event.target as HTMLElement).closest('button')
          )
            return;
          drag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            radius: pointerDragRadius(event.pointerType),
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.focus({ preventScroll: true });
        }}
        onPointerMove={(event) => {
          const held = drag.current;
          if (!held || held.id !== event.pointerId) return;
          const x = event.clientX - held.x,
            y = event.clientY - held.y;
          if (Math.hypot(x, y) > 6) {
            held.moved = true;
            setTarget(null);
            setSelectedNpcId(null);
            const length = Math.max(held.radius, Math.hypot(x, y));
            dragMove.current = { x: x / length, y: y / length };
          }
        }}
        onPointerUp={(event) => stopPointer(event)}
        onPointerCancel={(event) => stopPointer(event, true)}
        onLostPointerCapture={(event) => stopPointer(event, true)}
      >
        <HallScene
          src={mapArt}
          onLoad={() => markArt(mapArt, 'ready')}
          onError={() => markArt(mapArt, 'error')}
        />
        <div className="hall-ground-light" />
        <button
          className="hall-portal"
          style={{ left: `${HALL_LAYOUT.portal.x * 100}%`, top: `${HALL_LAYOUT.portal.y * 100}%` }}
          aria-label="中央传送门，选择单人或组队远征"
          title="中央传送门 · 选择单人或组队远征"
          disabled={!movingEnabled}
          onClick={enterPortal}
        />
        <button
          className="hall-portal hall-portal-plaza"
          style={{
            left: `${HALL_LAYOUT.portalPlaza.x * 100}%`,
            top: `${HALL_LAYOUT.portalPlaza.y * 100}%`,
          }}
          aria-label="符文传送阵，选择单人或组队远征"
          title={`秘境传送 · 点击选择远征${keyboardInteract ? '，靠近后也可按 E' : ''}`}
          disabled={!movingEnabled}
          onClick={enterPortal}
        >
          <span className="hall-portal-label">秘境传送</span>
        </button>
        {HALL_NPCS.map((npc, index) => {
          const Icon = NPC_ICONS[npc.panel];
          const near = distanceTo(npc) <= INTERACTION_DISTANCE;
          return (
            <button
              key={npc.id}
              className={`hall-actor hall-npc npc-${npc.id} ${selectedNpcId === npc.id ? 'selected' : ''} ${near ? 'in-reach' : ''}`}
              data-actor-class={npc.classId}
              data-actor-role={npc.id}
              style={
                {
                  left: `${npc.x * 100}%`,
                  top: `${npc.y * 100}%`,
                  zIndex: Math.round(npc.y * 100),
                  '--npc-color': npc.color,
                  '--idle-delay': `${-index * 0.73}s`,
                } as CSSProperties
              }
              onClick={() => approach(npc)}
              aria-label={`${near ? '交互' : '走近'}${npc.name}，${npc.service}`}
              disabled={!movingEnabled}
            >
              <span className="hall-nameplate">
                <Icon size={13} />
                {npc.service}
              </span>
              <span className="hall-sprite">
                <span className="hall-idle-body actor-idle">
                  <img
                    className="npc-atlas-art"
                    style={{
                      left: `${-NPC_ART[npc.id].column * 100}%`,
                      top: `${-NPC_ART[npc.id].row * 100}%`,
                    }}
                    src={npcArt}
                    onLoad={() => markArt(npcArt, 'ready')}
                    onError={() => markArt(npcArt, 'error')}
                    alt={`${npc.name}，${NPC_ART[npc.id].description}`}
                    draggable={false}
                  />
                </span>
              </span>
              <span className="hall-actor-name">{npc.name}</span>
            </button>
          );
        })}
        {otherPlayers.map((player, index) => {
          const location = clampHallPosition(player.x, player.y);
          return (
            <button
              key={player.id}
              className="hall-actor hall-player hall-character"
              data-actor-class={player.classId}
              style={
                {
                  ...characterOrigin(player.classId),
                  left: `${location.x * 100}%`,
                  top: `${location.y * 100}%`,
                  zIndex: Math.round(location.y * 100) + 1,
                  '--idle-delay': `${-0.8 - index * 0.67}s`,
                } as CSSProperties
              }
              onClick={() => setInspectedPlayer(player)}
              aria-label={`查看在线旅人${player.name}的配装与成就`}
            >
              <span className="hall-nameplate">
                {player.name} · Lv.{player.level}
              </span>
              <span className="hall-sprite">
                <span className="hall-idle-body actor-idle">
                  <img src={CHARACTER_ART[player.classId].src} alt="" draggable={false} />
                </span>
              </span>
              <span className="hall-actor-name">{ACTIVITIES[player.activity] ?? '营地休整'}</span>
            </button>
          );
        })}
        {target && (
          <span
            className="hall-destination"
            style={{ left: `${target.x * 100}%`, top: `${target.y * 100}%` }}
          >
            ◇
          </span>
        )}
        <div
          className={`hall-actor hall-self hall-character ${walking ? 'walking' : ''}`}
          data-actor-class={save.classId}
          style={
            {
              ...characterOrigin(save.classId),
              left: `${position.x * 100}%`,
              top: `${position.y * 100}%`,
              zIndex: Math.round(position.y * 100) + 2,
              '--facing': facing,
            } as CSSProperties
          }
          aria-label={`你的位置，${character?.name ?? CLASSES.find((hero) => hero.id === save.classId)?.name}`}
        >
          <span className="hall-nameplate">
            {character?.name ?? '行者'}
            <b>你</b>
          </span>
          <span className="hall-sprite">
            <span className="hall-idle-body actor-idle">
              <img
                src={heroArt}
                onLoad={() => markArt(heroArt, 'ready')}
                onError={() => markArt(heroArt, 'error')}
                alt="你的营地角色"
                draggable={false}
              />
            </span>
          </span>
          <span className="hall-self-ring" />
        </div>
      </div>
      {(waitingForArt || failedArt) && (
        <div className="hall-art-status" role="status">
          {failedArt ? (
            <>
              营地贴图加载失败
              <button
                className="outline-button"
                onClick={() => {
                  setArtStatus({});
                  setArtAttempt((n) => n + 1);
                }}
              >
                重试加载
              </button>
            </>
          ) : (
            '正在载入营地画面…'
          )}
        </div>
      )}
      <div className="hall-touch-controls">
        <VirtualJoystick disabled={!movingEnabled} />
        {(inReach || selectedNpc) && (
          <button
            className="hall-interact"
            disabled={!movingEnabled || !inReach}
            onClick={() => interaction.current()}
          >
            {keyboardInteract && <kbd>E</kbd>}
            <span>
              <small>
                {interactingPortal
                  ? '秘境传送门'
                  : inReach
                    ? interactionNpc.name
                    : selectedNpc?.name}
              </small>
              {interactingPortal ? '选择远征方式' : inReach ? interactionNpc.service : '正在前往'}
            </span>
            <ChevronRight size={15} />
          </button>
        )}
      </div>
      <div
        id="hall-controls-help"
        className={`hall-dialogue ${inReach || selectedNpc ? 'has-interaction' : 'is-idle'}`}
        aria-live="polite"
      >
        <span>
          {interactingPortal
            ? '踏入传送阵，选择独自远征或与同行旅人组队。'
            : inReach
              ? `「${interactionNpc.greeting}」`
              : selectedNpc
                ? `正在前往${selectedNpc.name}，靠近后点击交互${keyboardInteract ? '或按 E' : ''}。`
                : '方向键 / 摇杆移动　·　点击居民或传送阵交互'}
        </span>
      </div>
      {publishError && (
        <p className="hall-network-note" role="status">
          {publishError}
        </p>
      )}
      {inspectedPlayer && (
        <div className="modal-backdrop">
          <div
            ref={profileRef}
            className="modal hall-profile"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hall-player-name"
            tabIndex={-1}
          >
            <header className="modal-header">
              <div>
                <span className="eyebrow">FELLOW WATCHER</span>
                <h2 id="hall-player-name">{inspectedPlayer.name}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="关闭旅人档案"
                onClick={() => setInspectedPlayer(null)}
              >
                <X />
              </button>
            </header>
            <div className="modal-body">
              <div className="hall-profile-hero">
                <HeroArt classId={inspectedPlayer.classId} />
                <div>
                  <h3>
                    {CLASSES.find((hero) => hero.id === inspectedPlayer.classId)?.name} · Lv.
                    {inspectedPlayer.level}
                  </h3>
                  <p>
                    {players.some((player) => player.id === inspectedPlayer.id)
                      ? (ACTIVITIES[inspectedPlayer.activity] ?? '营地休整')
                      : '旅人已离开大厅或连接暂不可用'}
                  </p>
                </div>
              </div>
              <div className="hall-profile-achievements">
                <span>
                  通关<b>{formatBigNumber(inspectedPlayer.achievements.clears)}次</b>
                </span>
                <span>
                  最高首通<b>{inspectedPlayer.achievements.clearedStage}层</b>
                </span>
                <span>
                  累计击败<b>{formatBigNumber(inspectedPlayer.achievements.kills)}</b>
                </span>
              </div>
              <h3>当前云端配装</h3>
              <div className="hall-profile-equipment">
                {inspectedPlayer.equipment.length ? (
                  inspectedPlayer.equipment.map((item) => (
                    <article
                      key={item.slot}
                      style={{ '--item-color': RARITY_COLORS[item.rarity] } as CSSProperties}
                    >
                      <small>
                        {SLOT_NAMES[item.slot]} · {RARITY_NAMES[item.rarity]}
                      </small>
                      <strong>{item.name}</strong>
                      <span>Lv.{item.level}</span>
                    </article>
                  ))
                ) : (
                  <p className="muted">这位旅人尚未穿戴装备。</p>
                )}
              </div>
              <p className="muted hall-profile-note">
                营地可查看旅人配装；通过组队远征入口邀请同行，共同挑战秘境。
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
