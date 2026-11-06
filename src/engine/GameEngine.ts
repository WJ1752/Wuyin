import { Application, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { pointerDragRadius } from '../core/pointerMovement';
import type {
  BossDef,
  CombatConfig,
  CombatSnapshot,
  CombatStats,
  GameCallbacks,
  Item,
  MonsterDef,
  SkillDef,
  Slot,
} from '../core/types';
import { RARITY_COLORS } from '../core/types';
import { getItemAppearanceKey } from '../data/visuals';
import { CLASSES } from '../data/classes';
import { SKILLS } from '../data/skillTrees';
import { SETS } from '../data/sets';
import { LEGENDARIES } from '../data/legendaries';
import { MONSTERS, BOSSES, ELITE_AFFIXES } from '../data/monsters';
import { RIFT_PYLON_SITES, RIFT_RULES, STAGES } from '../data/stages';
import { CharacterRig } from '../render/ProceduralRig';
import { getAtlasTexture, preloadAtlas } from '../render/TextureAtlas';
import { preloadCharacterTextures } from '../render/CharacterTextures';
import {
  getEffectTexture,
  getProjectileArt,
  getZoneTexture,
  preloadSkillTextures,
} from '../render/SkillTextures';
import { MonsterRig } from '../render/MonsterRenderer';
import { preloadMonsterTextures } from '../render/MonsterTextures';
import {
  createMap,
  createPropSprite,
  preloadMapTextures,
  preloadPropTextures,
} from '../render/MapGenerator';
import { VFXManager, ELEMENT_COLORS } from '../render/VFXManager';
import { FloatingText } from '../render/FloatingText';
import { calculateDamage, mitigateDamage } from './CombatSystem';
import { BuffManager, PYLONS } from './BuffAndPylon';
import { ProjectileSystem, type CastContext } from './ProjectileSystem';
import { selectAutoCast } from './AutoCastAI';
import { generateLoot } from './LootGenerator';
import { pixelEllipse, pixelPolygon, pixelLine, pixelStamp } from '../render/PixelArt';
import {
  createMonsterBrain,
  attackContains,
  stepMonsterAI,
  type MonsterBrain,
  type MonsterAIEvent,
} from './MonsterAI';
import { createRng } from '../core/random';
import { createBossBrain, stepBossAI, type BossBrain } from './BossAI';
import type {
  CoopActorFrame,
  CoopEngineOptions,
  CoopFrame,
  CoopInput,
  CoopMemberConfig,
  MonsterAttackPose,
} from '../core/coop';
import { coopBalance } from '../data/coopBalance';
import { PET_ART } from '../data/petVisuals';
import { preloadPetTexture, getPetTexture } from '../render/PetTextures';
import type { RunResult } from '../core/types';
import { DEFAULT_KEYS, getPreferences } from '../core/preferences';
import { CHALLENGES } from '../data/challenges';
import { combatFraming } from '../render/viewport';
import { isSkillAutoEnabled } from '../data/progression';

/** Rendering-free actors keep the production simulation usable by the server. */
class SimulationActor extends Container {
  attack(..._args: unknown[]) {}
  update(..._args: unknown[]) {}
  hit() {}
  drawHealth(..._args: unknown[]) {}
}

const arenaLimit = 780;
const pylonReach = 190;
function warningDecal(
  w: Pick<
    CoopFrame['warnings'][number],
    'shape' | 'range' | 'radius' | 'width' | 'angle' | 'x' | 'y'
  >,
) {
  if (w.shape === 'circle')
    return {
      texture: getEffectTexture('dangerCircle'),
      x: w.x,
      y: w.y,
      width: w.radius * 2,
      height: w.radius * 2,
      angle: 0,
    };
  const cone = w.shape === 'cone';
  return {
    texture: getEffectTexture(cone ? 'dangerCone' : 'dangerLine'),
    x: w.x + (Math.cos(w.angle) * w.range) / 2,
    y: w.y + (Math.sin(w.angle) * w.range) / 2,
    width: w.range,
    height: 2 * (cone ? w.range * Math.sin(w.width) : w.width),
    angle: w.angle,
  };
}
const clampArena = (value: number) => Math.max(-arenaLimit, Math.min(arenaLimit, value));
// Turn an outward spawn offset inward at the edge, keeping the intended distance from the player.
const spawnCoordinate = (origin: number, offset: number) =>
  Math.abs(origin + offset) <= arenaLimit ? origin + offset : origin - offset;

export function getActiveSkills(
  config: Pick<CombatConfig, 'classId' | 'skills'> &
    Partial<Pick<CombatConfig, 'autoSkills' | 'equipment'>>,
): SkillDef[] {
  const skills = SKILLS.filter(
    (s) => s.classId === config.classId && s.kind !== 'passive' && (config.skills[s.id] ?? 0) > 0,
  );
  const counts = new Map<string, number>();
  for (const item of Object.values(config.equipment ?? {}))
    if (item?.setId) counts.set(item.setId, (counts.get(item.setId) ?? 0) + 1);
  const main = SETS.find((s) => (counts.get(s.id) ?? 0) >= 2)?.skillId;
  const score = (s: SkillDef) =>
    (s.id === main ? 1000 : 0) +
    (config.autoSkills?.[s.id] === false ? -100 : 0) +
    (config.skills[s.id] ?? 0);
  const highest = (kind: string) =>
    skills.filter((s) => s.kind === kind).sort((a, b) => score(b) - score(a))[0];
  return [
    highest('basic'),
    highest('core'),
    ...skills.filter((s) => ['control', 'defense', 'movement'].includes(s.kind)).slice(0, 3),
    highest('ultimate'),
  ].filter((s): s is SkillDef => Boolean(s));
}
function isSkeletonWarrior(index: number) {
  return index < 6 || index >= 10;
}

interface Enemy {
  id: number;
  def: MonsterDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  view: MonsterRig;
  pose?: MonsterAttackPose;
  guestVelocity?: { x: number; y: number };
  elite: boolean;
  boss: boolean;
  minion: boolean;
  age: number;
  attackTimer: number;
  stun: number;
  frozenUntil?: number;
  slow: number;
  slowRatio?: number;
  armorReduction?: { value: number; expires: number };
  poison: number;
  poisonStacks: number;
  poisonSkill?: SkillDef;
  poisonOwner?: GameEngine;
  bleedOwner?: GameEngine;
  bleed?: number;
  bleedSkill?: SkillDef;
  vulnerability: number;
  vulnerabilities?: Record<string, { value: number; expires: number }>;
  lastQuarter: number;
  warning?: {
    x: number;
    y: number;
    angle: number;
    age: number;
    shape: 'circle' | 'cone' | 'line';
    view: Graphics;
  };
  deadTime?: number;
  goblin?: boolean;
  affix: number;
  brain?: MonsterBrain;
  bossBrain?: BossBrain;
  shield: number;
  shieldTime: number;
  elements?: Set<string>;
  exposure?: number;
  curse?: number;
  chainHit?: boolean;
}
interface Orb {
  kind: 'health' | 'progress' | 'gold' | 'item';
  x: number;
  y: number;
  age: number;
  view: Container;
  item?: Item;
  value: number;
}
function getDropTexture(key?: string, slot?: Slot): Texture | undefined {
  const appearance = key ?? (slot && getItemAppearanceKey({ slot, rarity: 'common' }));
  return (appearance && getAtlasTexture(appearance)) || getAtlasTexture('loot:item');
}
interface Zone {
  art?: Sprite;
  x: number;
  y: number;
  radius: number;
  life: number;
  age: number;
  tick: number;
  skill: SkillDef;
  view: Graphics;
  pull: boolean;
  multiplier: number;
  pulseTimes?: number[];
  cast?: CastContext;
}
interface SummonState {
  hp: number;
  maxHp: number;
  reviveIn: number;
}

/** Owns one run. Browser listeners, ticker, Pixi resources and timers are disposed together. */
export class GameEngine {
  private headless = false;
  private simulationResult?: RunResult;
  private simulationCommand = 0;
  private report: CombatStats = {
    seconds: 0,
    damageDealt: 0,
    damageTaken: 0,
    casts: 0,
    criticalHits: 0,
    kills: 0,
    damageBySkill: {},
    damageBySource: {},
    resourceStarvedSeconds: 0,
  };
  private objectiveProgress = 0;
  private environmentClock = 0;
  private hazards: { x: number; y: number; delay: number; radius: number; view: Graphics }[] = [];
  private objectiveMarker?: Graphics;
  private chargeWindow = 0;
  private bloodWindow = 0;
  private app?: Application;
  private initialized = false;
  private disposed = false;
  private host?: HTMLElement;
  private config!: CombatConfig;
  private callbacks!: GameCallbacks;
  private world = new Container();
  private floorLayer = new Container();
  private entityLayer = new Container();
  private effectsLayer = new Container();
  private textLayer = new Container();
  private hero!: CharacterRig;
  private pet = new Container();
  private vfx!: VFXManager;
  private numbers!: FloatingText;
  private projectiles!: ProjectileSystem;
  private enemies: Enemy[] = [];
  private orbs: Orb[] = [];
  private zones: Zone[] = [];
  private buffs = new BuffManager();
  private summons: CharacterRig[] = [];
  private summonStates = new Map<CharacterRig, SummonState>();
  private ravens: Graphics[] = [];
  private x = 0;
  private y = 0;
  private movement = { x: 0, y: 0 };
  private dragMovement = { x: 0, y: 0 };
  private keys = new Set<string>();
  private drag?: { x: number; y: number; pointerId: number; radius: number };
  private hp = 1;
  private resource = 100;
  private shield = 0;
  private shieldTime = 0;
  private shieldBurst?: { skill: SkillDef; multiplier: number };
  private shadowCharges = 0;
  private ultimateBonus = 0;
  private autoFanTimer = 0;
  private sigilReady = 0;
  private elapsed = 0;
  private progress = 0;
  private kills = 0;
  private combo = 0;
  private comboTimer = 0;
  private nextId = 1;
  private paused = false;
  private finished = false;
  private bossSpawned = false;
  private snapshotTimer = 0;
  private spawnTimer = 0;
  private castTimer = 0;
  private periodicTimer = 0;
  private conduitTimer = 0;
  private petTimer = 0;
  private lastDamage = -10;
  private shake = 0;
  private attackStacks = 0;
  private attackCount = 0;
  private laserStacks = 0;
  private fanCharge = 0;
  private fanTimer = 0;
  private moving = false;
  private movementDirection = { x: 0, y: 0 };
  private fps = 60;
  private cooldowns: Record<string, number> = {};
  private powers = new Map<string, number>();
  private setCounts = new Map<string, number>();
  private skills: SkillDef[] = [];
  private earned: Item[] = [];
  private gold = 0;
  private shards = 0;
  private facing = 1;
  private pylons: {
    id: string;
    name: string;
    used: boolean;
    x: number;
    y: number;
    view: Container;
  }[] = [];
  private random = createRng(Date.now());
  private enemyWarnings = new Map<number, Graphics>();
  private warningAnimations = new Map<
    number,
    { event: Extract<MonsterAIEvent, { kind: 'telegraph' }>; age: number; art?: Sprite }
  >();
  private slowUntil = 0;
  private slowRatio = 0;
  private resizeObserver?: ResizeObserver;
  private minimap = new Graphics();
  private portraitHud?: MediaQueryList;
  private compactViewport?: MediaQueryList;
  private mapClock = 0;
  private gamepadHeld = new Set<number>();
  private gamepadBlocked = false;
  private coop?: CoopEngineOptions;
  private coopParent?: GameEngine;
  private coopActors = new Map<string, GameEngine>();
  private coopLabels = new Map<string, Text>();
  private coopControls = new Map<
    string,
    { input: CoopInput; receivedAt: number; consumed: number; command: number }
  >();
  private coopSequence = 0;
  private coopActionSequence = 0;
  private coopInputClock = 0;
  private coopTimer?: ReturnType<typeof setInterval>;
  private coopWallClock = 0;
  private coopAccumulator = 0;
  private coopReceivedSequence = -1;
  private coopResults?: Record<string, RunResult>;
  private coopDownSeconds = 0;
  private coopInput: CoopInput = { sequence: 0, movement: { x: 0, y: 0 }, casts: [] };
  private coopVisuals = new Graphics();
  private coopStamps: Sprite[] = [];
  private recentEffects: NonNullable<CoopFrame['effects']> = [];
  private effectSequence = 0;
  private lastCast?: CoopActorFrame['cast'];
  private get coopHost(): GameEngine {
    return this.coopParent ?? this;
  }
  private get isCoopGuest() {
    return !!this.coop && this.coop.localId !== this.coop.hostId;
  }

  /** Configure before init: no peer ever starts an independent solo simulation. */
  initHeadless(config: CombatConfig, callbacks: GameCallbacks) {
    if (this.initialized) throw new Error('战斗已经初始化。');
    this.headless = true;
    this.setupCharacter(config, callbacks);
    this.random = createRng(config.seed ?? 4107);
    this.hero = new SimulationActor() as unknown as CharacterRig;
    this.pet.addChild(new Container());
    this.pet.position.set(-38, 32);
    this.vfx = new VFXManager(
      this.effectsLayer,
      (cue) => {
        this.recentEffects.push({ ...cue, sequence: ++this.effectSequence, time: this.elapsed });
        if (this.recentEffects.length > 32) this.recentEffects.shift();
      },
      'off',
    );
    this.numbers = new FloatingText(this.textLayer, 'off', false);
    this.projectiles = new ProjectileSystem(this.effectsLayer, false);
    if (config.classId === 'ranger' && this.learned('raven'))
      this.ravens = [new Graphics(), new Graphics()];
    if (config.classId === 'necromancer') this.createSummons();
    this.createPylons();
    this.initialized = true;
    this.startEncounter();
  }
  initHeadlessCoop(members: CoopMemberConfig[], seed: number, callbacks: GameCallbacks) {
    if (!members.length || members.length > 4) throw new Error('远征需要1至4名角色。');
    const leader = members[0];
    this.configureCoop({ localId: leader.id, hostId: leader.id, seed, members });
    this.initHeadless({ ...leader.config, seed }, callbacks);
    for (const [index, member] of members.entries()) {
      const actor = index === 0 ? this : new GameEngine();
      if (actor !== this) {
        actor.headless = true;
        actor.setupCharacter(member.config, {
          onSnapshot: () => {},
          onSound: () => {},
          onFinish: () => {},
        });
        this.linkCoopActor(actor);
        actor.hero = new SimulationActor() as unknown as CharacterRig;
        actor.pet.addChild(new Container());
        actor.projectiles = new ProjectileSystem(this.effectsLayer, false);
        actor.initialized = true;
        if (member.config.classId === 'ranger' && actor.learned('raven'))
          actor.ravens = [new Graphics(), new Graphics()];
        if (member.config.classId === 'necromancer') actor.createSummons();
      }
      actor.x = (index - (members.length - 1) / 2) * 55;
      actor.hero.position.set(actor.x, actor.y);
      this.coopActors.set(member.id, actor);
    }
  }
  stepHeadless(input?: CoopInput) {
    if (!this.headless || this.finished || this.disposed) return;
    if (this.coop) {
      this.updateCoop(1 / 30);
      return;
    }
    if (input) {
      this.setMovement(input.movement.x, input.movement.y);
      if (input.autoSkills) this.config.autoSkills = { ...input.autoSkills };
      for (const command of input.commands ?? []) {
        if (command.sequence <= this.simulationCommand) continue;
        if (command.id.startsWith('pylon:')) this.activatePylon(command.id.slice(6));
        else this.cast(command.id);
        this.simulationCommand = command.sequence;
      }
    } else this.setMovement(0, 0);
    this.update(1 / 30);
  }
  headlessFrame(actorId: string): CoopFrame {
    if (!this.coop) this.coopActors.set(actorId, this);
    if (this.simulationResult) this.coopResults = { [actorId]: this.simulationResult };
    if (!this.coop)
      this.coopControls.set(actorId, {
        input: this.coopInput,
        receivedAt: 0,
        consumed: 0,
        command: this.simulationCommand,
      });
    return this.coopFrame();
  }
  configureCoop(options: CoopEngineOptions) {
    if (this.initialized) throw new Error('请在初始化战场前配置队伍。');
    this.coop = options;
    this.coopInput.sequence = options.inputSequenceBase ?? 0;
    this.coopActionSequence = options.commandSequenceBase ?? 0;
  }
  async init(host: HTMLElement, config: CombatConfig, callbacks: GameCallbacks): Promise<void> {
    this.host = host;
    this.portraitHud = window.matchMedia('(max-width: 760px) and (orientation: portrait)');
    this.compactViewport = window.matchMedia('(max-width: 960px)');
    this.setupCharacter(config, callbacks);
    if (this.coop?.seed !== undefined || config.seed !== undefined)
      this.random = createRng(this.coop?.seed ?? config.seed!);
    const stage = STAGES[config.stage - 1] ?? STAGES[0];
    await Promise.all([
      preloadCharacterTextures(config.classId),
      preloadSkillTextures(this.skills.map((skill) => skill.id)),
      preloadPetTexture(config.petId),
      preloadAtlas(
        'assets/maps/rift-loot.webp',
        2,
        1,
        [
          ['loot:item', 0, 0],
          ['loot:gold', 1, 0],
        ],
        'nearest',
      ),
      preloadMapTextures(stage.theme),
      preloadPropTextures(),
      preloadMonsterTextures(),
    ]);
    if (this.disposed) return;
    this.app = new Application();
    await this.app.init({
      resizeTo: host,
      antialias: false,
      background: 0x142426,
      resolution:
        getPreferences(config.preferences).quality === 'low'
          ? 1
          : Math.min(window.devicePixelRatio || 1, 2),
      roundPixels: true,
      autoDensity: true,
      powerPreference: 'high-performance',
    });
    if (this.disposed) {
      this.app.destroy(true, { children: true });
      return;
    }
    this.initialized = true;
    host.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = 'none';
    this.app.canvas.setAttribute('aria-label', '秘境战场，使用 WASD 移动，空格施放位移技能');
    this.world.addChild(this.floorLayer, this.entityLayer, this.effectsLayer, this.textLayer);
    this.app.stage.addChild(this.world, this.minimap);
    this.entityLayer.sortableChildren = true;
    this.floorLayer.addChild(createMap(stage));
    this.hero = new CharacterRig(config.classId);
    this.entityLayer.addChild(this.hero);
    this.vfx = new VFXManager(
      this.effectsLayer,
      this.coop && !this.isCoopGuest
        ? (cue) => {
            this.recentEffects.push({
              ...cue,
              sequence: ++this.effectSequence,
              time: this.elapsed,
            });
            if (this.recentEffects.length > 32) this.recentEffects.shift();
          }
        : undefined,
      getPreferences(config.preferences).quality === 'low'
        ? 'reduced'
        : getPreferences(config.preferences).effects,
    );
    this.numbers = new FloatingText(
      this.textLayer,
      getPreferences(config.preferences).damageNumbers,
    );
    this.projectiles = new ProjectileSystem(this.effectsLayer);
    this.createPet();
    this.createPylons();
    if (config.classId === 'necromancer') this.createSummons();
    if (this.coop) await this.createCoopActors();
    if (this.disposed) return;
    if (!this.isCoopGuest) this.startEncounter();
    this.app.ticker.add(this.tick);
    this.app.ticker.maxFPS = getPreferences(config.preferences).quality === 'low' ? 30 : 60;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.app.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    this.resizeObserver = new ResizeObserver(() => {
      if (!this.disposed && this.app) this.app.renderer.resize(host.clientWidth, host.clientHeight);
    });
    this.resizeObserver.observe(host);
    if (this.coop) this.startCoopClock();
    this.emit();
  }
  private setupCharacter(config: CombatConfig, callbacks: GameCallbacks) {
    this.config = {
      ...config,
      autoSkills: { ...config.autoSkills },
      stats: { ...config.stats, independent: [...config.stats.independent] },
    };
    this.callbacks = callbacks;
    this.skills = getActiveSkills(config);
    this.hp = config.stats.hp;
    this.resource = config.stats.maxResource;
    for (const item of Object.values(config.equipment)) {
      if (!item) continue;
      if (item.setId) this.setCounts.set(item.setId, (this.setCounts.get(item.setId) ?? 0) + 1);
      if (item.legendaryId) {
        const def = LEGENDARIES.find((l) => l.id === item.legendaryId);
        if (def)
          this.powers.set(def.effect, Math.max(this.powers.get(def.effect) ?? 0, item.power));
      }
    }
    for (const id of Object.values(config.cube)) {
      const def = LEGENDARIES.find((l) => l.id === id);
      if (def) this.powers.set(def.effect, def.max);
    }
    this.applyStaticPowers();
  }
  private async createCoopActors() {
    const options = this.coop!;
    await Promise.all(
      options.members.map((member) =>
        Promise.all([
          preloadCharacterTextures(member.config.classId),
          preloadSkillTextures(getActiveSkills(member.config).map((skill) => skill.id)),
          preloadPetTexture(member.config.petId),
        ]),
      ),
    );
    if (this.disposed) return;
    for (const [index, member] of options.members.entries()) {
      let actor: GameEngine;
      if (member.id === options.localId) actor = this;
      else {
        actor = new GameEngine();
        actor.coopParent = this;
        actor.setupCharacter(member.config, {
          onSound: (name) => this.callbacks.onSound(name),
          onSnapshot: () => {},
          onFinish: () => {},
        });
        actor.initialized = true;
        this.linkCoopActor(actor);
        actor.hero = new CharacterRig(member.config.classId);
        this.entityLayer.addChild(actor.hero);
        actor.projectiles = new ProjectileSystem(this.effectsLayer);
        actor.createPet();
        if (member.config.classId === 'necromancer') actor.createSummons();
      }
      actor.x = (index - (options.members.length - 1) / 2) * 55;
      actor.hero.position.set(actor.x, actor.y);
      this.coopActors.set(member.id, actor);
      const label = new Text({
        text: member.name,
        style: {
          fontFamily: 'sans-serif',
          fontSize: 12,
          fill: member.id === options.localId ? 0xf4d791 : 0x9ee4d4,
          stroke: { color: 0x142226, width: 3 },
        },
      });
      label.anchor.set(0.5, 1);
      this.textLayer.addChild(label);
      this.coopLabels.set(member.id, label);
    }
    this.effectsLayer.addChild(this.coopVisuals);
  }

  private linkCoopActor(actor: GameEngine) {
    actor.coopParent = this;
    // These are one shared world. Character resources, skills, cooldowns,
    // projectiles, zones and passives stay independent on each actor.
    for (const key of [
      'enemies',
      'pylons',
      'elapsed',
      'progress',
      'kills',
      'gold',
      'shards',
      'nextId',
      'bossSpawned',
      'finished',
    ] as const)
      Object.defineProperty(actor, key, {
        configurable: true,
        get: () => this[key],
        set: (value) => {
          (this as any)[key] = value;
        },
      });
    actor.entityLayer = this.entityLayer;
    actor.effectsLayer = this.effectsLayer;
    actor.floorLayer = this.floorLayer;
    actor.textLayer = this.textLayer;
    actor.vfx = this.vfx;
    actor.numbers = this.numbers;
    actor.random = this.random;
    actor.orbs = this.orbs;
  }

  receiveCoopInput(id: string, input: CoopInput) {
    if (
      !this.coop ||
      this.isCoopGuest ||
      (!this.headless && id === this.coop.localId) ||
      !this.coopActors.has(id)
    )
      return;
    const previous = this.coopControls.get(id);
    if (
      !Number.isSafeInteger(input.sequence) ||
      input.sequence < 0 ||
      (previous && input.sequence <= previous.input.sequence)
    )
      return;
    this.coopControls.set(id, {
      input,
      receivedAt: performance.now(),
      consumed: previous?.consumed ?? -1,
      command: previous?.command ?? 0,
    });
  }

  private queueCoopCommand(id: string) {
    const commands = (this.coopInput.commands ??= []);
    if (commands.length < 12) commands.push({ sequence: ++this.coopActionSequence, id });
  }

  private sendCoopInput(dt: number) {
    const pad = navigator.getGamepads?.()?.find((p) => p?.connected);
    let x =
      this.movement.x +
      this.dragMovement.x +
      Number(this.keys.has('d') || this.keys.has('arrowright')) -
      Number(this.keys.has('a') || this.keys.has('arrowleft'));
    let y =
      this.movement.y +
      this.dragMovement.y +
      Number(this.keys.has('s') || this.keys.has('arrowdown')) -
      Number(this.keys.has('w') || this.keys.has('arrowup'));
    if (pad && !this.paused && !this.hasInputDialog()) {
      if (this.gamepadBlocked)
        this.gamepadBlocked =
          pad.buttons.slice(0, 6).some((b) => b.pressed) ||
          Math.abs(pad.axes[0] ?? 0) > 0.18 ||
          Math.abs(pad.axes[1] ?? 0) > 0.18;
      else {
        if (Math.abs(pad.axes[0] ?? 0) > 0.18) x += pad.axes[0];
        if (Math.abs(pad.axes[1] ?? 0) > 0.18) y += pad.axes[1];
        for (let i = 0; i < 6; i++) {
          if (pad.buttons[i]?.pressed && !this.gamepadHeld.has(i)) {
            this.gamepadHeld.add(i);
            if (this.skills[i]) this.cast(this.skills[i].id);
          } else if (!pad.buttons[i]?.pressed) this.gamepadHeld.delete(i);
        }
      }
    }
    const length = Math.max(1, Math.hypot(x, y));
    this.coopInput.movement = this.paused ? { x: 0, y: 0 } : { x: x / length, y: y / length };
    this.coopInputClock -= dt;
    if (this.coopInputClock > 0) return;
    this.coopInputClock = 0.08;
    this.coopInput.sequence++;
    this.coopInput.autoSkills = { ...this.config.autoSkills };
    this.coop?.onInput?.(structuredClone(this.coopInput));
  }

  private startCoopClock() {
    this.coopWallClock = performance.now();
    this.coopAccumulator = 0;
    if (this.isCoopGuest) this.sendCoopInput(0);
    else this.coop?.onFrame?.(this.coopFrame());
    // Rendering can fall to 1 FPS in a background tab. Simulation uses elapsed
    // monotonic time instead; a throttled timer still catches up in small steps.
    this.coopTimer = setInterval(this.advanceCoopClock, 50);
  }

  private advanceCoopClock = (now = performance.now()) => {
    const elapsed = Math.max(0, Math.min(2, (now - this.coopWallClock) / 1000));
    this.coopWallClock = now;
    if (!this.coop || this.disposed || this.finished) return;
    if (this.isCoopGuest) {
      this.sendCoopInput(elapsed);
      return;
    }
    const step = 1 / 30;
    this.coopAccumulator += elapsed;
    while (this.coopAccumulator + 1e-8 >= step && !this.finished && !this.disposed) {
      this.coopAccumulator = Math.max(0, this.coopAccumulator - step);
      this.updateCoop(step);
    }
  };

  private updateCoop(dt: number) {
    if (!this.coopActors.size) return;
    this.elapsed += dt;
    for (const [id, actor] of this.coopActors) {
      if (actor.hp <= 0) {
        actor.coopDownSeconds = Math.max(0, actor.coopDownSeconds - dt);
        if (!actor.coopDownSeconds) {
          actor.hp = actor.config.stats.hp * coopBalance(this.coopActors.size).reviveHealth;
          actor.buffs.add('invulnerable', '复苏庇护', 2);
          actor.hero.alpha = 1;
        } else continue;
      }
      const control = this.coopControls.get(id);
      if (actor !== this || this.headless) {
        const live = control && performance.now() - control.receivedAt < 750;
        actor.setMovement(live ? control.input.movement.x : 0, live ? control.input.movement.y : 0);
        if (control && live) {
          if (control.input.autoSkills) actor.config.autoSkills = { ...control.input.autoSkills };
          for (const command of control.input.commands ?? [])
            if (command.sequence > control.command) {
              if (command.id.startsWith('pylon:')) actor.activatePylon(command.id.slice(6));
              else actor.cast(command.id);
              control.command = command.sequence;
            }
          if (control.consumed !== control.input.sequence) {
            for (const skill of control.input.casts) actor.cast(skill);
            if (control.input.pylon) actor.activatePylon(control.input.pylon);
            control.consumed = control.input.sequence;
          }
        }
      }
      actor.updateActor(dt);
      if (this.finished) break;
    }
    if (!this.finished) {
      this.updateWaves(dt);
      this.updateEnemies(dt);
      this.updateWarningAnimations(dt);
      this.updateOrbs(dt);
      this.updateEnvironment(dt);
      if (this.progress >= 100 && !this.bossSpawned) this.summonBoss();
      for (const actor of this.coopActors.values())
        if (actor.hp <= 0 && !actor.coopDownSeconds) {
          actor.coopDownSeconds = coopBalance(this.coopActors.size).reviveSeconds;
          actor.hero.alpha = 0.3;
          actor.clearInput();
        }
      if (
        [...this.coopActors.values()].every((actor) => actor.hp <= 0) ||
        this.elapsed >= coopBalance(this.coopActors.size).timeLimit
      )
        this.finishCoop(false);
    }
    this.vfx.tick(dt);
    this.numbers.tick(dt);
    this.updateCoopLabels();
    this.snapshotTimer -= dt;
    if (this.snapshotTimer <= 0 || this.finished) {
      this.snapshotTimer = 0.1;
      this.emit();
      this.coop?.onFrame?.(this.coopFrame());
    }
  }

  private updateCoopLabels() {
    for (const [id, actor] of this.coopActors) {
      const label = this.coopLabels.get(id);
      if (!label) continue;
      const name = this.coop!.members.find((m) => m.id === id)!.name;
      label.text =
        actor.hp <= 0
          ? `${name} · ${Math.ceil(actor.coopDownSeconds)}秒复苏`
          : `${name} · ${Math.ceil((actor.hp / actor.config.stats.hp) * 100)}%`;
      label.position.set(actor.x, actor.y - 70);
    }
  }

  private coopFrame(): CoopFrame {
    return {
      sequence: ++this.coopSequence,
      elapsed: this.elapsed,
      progress: this.progress,
      kills: this.kills,
      effects: this.recentEffects.filter((e) => this.elapsed - e.time < 0.45),
      actors: [...this.coopActors].map(([id, actor]) => ({
        id,
        x: actor.x,
        y: actor.y,
        facing: actor.facing,
        moving: actor.moving,
        downSeconds: actor.coopDownSeconds,
        inputSequence: this.coopControls.get(id)?.command ?? 0,
        cast: actor.lastCast,
        pet: { x: actor.pet.x, y: actor.pet.y },
        summons: actor.summons.map((s) => ({ x: s.x, y: s.y, active: s.visible })),
        snapshot: actor.snapshot(),
      })),
      enemies: this.enemies.map((e) => ({
        id: e.id,
        defId: e.def.id,
        x: e.x,
        y: e.y,
        hp: e.hp,
        maxHp: e.maxHp,
        elite: e.elite,
        boss: e.boss,
        minion: e.minion,
        pose: e.pose,
      })),
      projectiles: [...this.coopActors.values()].flatMap((actor) =>
        actor.projectiles.items.map((p) => ({
          x: p.x,
          y: p.y,
          angle: Math.atan2(p.vy, p.vx),
          color: p.color,
          skillId: p.skillId,
          scale: p.scale,
        })),
      ),
      zones: [...this.coopActors.values()].flatMap((actor) =>
        actor.zones.map((z) => ({
          x: z.x,
          y: z.y,
          radius: z.radius,
          color: ELEMENT_COLORS[z.skill.element],
          skillId: z.skill.id,
        })),
      ),
      orbs: this.orbs.map((o) => ({
        x: o.x,
        y: o.y,
        kind: o.kind,
        rarity: o.item?.rarity,
        slot: o.item?.slot,
        appearanceKey: o.item ? getItemAppearanceKey(o.item) : undefined,
      })),
      warnings: [...this.warningAnimations]
        .map(([id, w]) => ({
          id,
          x: w.event.x,
          y: w.event.y,
          radius: w.event.radius,
          angle: w.event.angle,
          range: w.event.range,
          width: w.event.width,
          shape: w.event.shape,
          color: w.event.color,
        }))
        .concat(
          this.hazards.map((hazard, i) => ({
            id: 1000000 + i,
            x: hazard.x,
            y: hazard.y,
            radius: hazard.radius,
            angle: 0,
            range: 0,
            width: 0,
            shape: 'circle',
            color: 0xea8b68,
          })),
        ),
      pylons: this.pylons.map((p) => ({ id: p.id, used: p.used })),
      results: this.coopResults,
    };
  }

  private finishCoop(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.coopResults = Object.fromEntries(
      [...this.coopActors].map(([id, actor]) => [
        id,
        {
          partySize: this.coopActors.size,
          stats: actor.combatStats(),
          won,
          stage: this.config.stage,
          seconds: Math.min(300, this.elapsed),
          kills: this.kills,
          gold: this.gold,
          shards: this.shards,
          items: [...actor.earned],
        },
      ]),
    );
    // Publish before onFinish can unmount the view. The room stores this immutable result.
    this.coop?.onFrame?.(this.coopFrame());
    this.callbacks.onSound(won ? 'victory' : 'defeat');
    this.emit();
    this.callbacks.onFinish(this.coopResults[this.coop!.localId]);
  }

  receiveCoopFrame(frame: CoopFrame) {
    if (
      !this.isCoopGuest ||
      !this.initialized ||
      frame.sequence <= this.coopReceivedSequence ||
      this.finished
    )
      return;
    this.coopReceivedSequence = frame.sequence;
    const dt = Math.max(0.001, frame.elapsed - this.elapsed);
    this.elapsed = frame.elapsed;
    for (const cue of frame.effects ?? []) {
      if (cue.sequence <= this.effectSequence) continue;
      this.effectSequence = cue.sequence;
      if (frame.elapsed - cue.time < 0.45) this.vfx.replay(cue);
    }
    this.progress = frame.progress;
    this.kills = frame.kills;
    for (const state of frame.actors) {
      const actor = this.coopActors.get(state.id);
      if (!actor) continue;
      actor.x = state.x;
      actor.y = state.y;
      actor.hp = state.snapshot.hp;
      actor.resource = state.snapshot.resource;
      actor.cooldowns = { ...state.snapshot.cooldowns };
      actor.facing = state.facing;
      actor.moving = state.moving;
      if (state.cast && state.cast.sequence > (actor.lastCast?.sequence ?? -1)) {
        const skill = actor.skill(state.cast.skillId);
        if (skill) {
          actor.hero.attack(skill, state.cast.angle);
          this.vfx.signature(
            skill,
            state.x,
            state.y,
            state.cast.angle,
            state.cast.tx,
            state.cast.ty,
          );
        }
        actor.lastCast = state.cast;
      }
      actor.coopDownSeconds = state.downSeconds;
      actor.hero.position.set(state.x, state.y);
      actor.hero.zIndex = state.y;
      actor.hero.alpha = state.snapshot.hp <= 0 ? 0.3 : 1;
      if (state.pet) {
        actor.pet.position.set(state.pet.x, state.pet.y);
        actor.pet.zIndex = state.pet.y;
      }
      state.summons?.forEach((summon, index) => {
        const view = actor.summons[index];
        if (view) {
          view.position.set(summon.x, summon.y);
          view.zIndex = summon.y;
          view.visible = summon.active;
          view.update(frame.elapsed + index, dt, true, state.facing, false);
          view.scale.set(0.45);
        }
      });
      if (state.id === this.coop!.localId) {
        this.coopInput.commands = this.coopInput.commands?.filter(
          (c) => c.sequence > (state.inputSequence ?? 0),
        );
        this.callbacks.onSnapshot({
          ...state.snapshot,
          paused: this.paused,
          fps: Math.round(this.fps),
        });
      }
    }
    const existing = new Map(this.enemies.map((e) => [e.id, e]));
    const next: Enemy[] = [];
    for (const state of frame.enemies) {
      let enemy = existing.get(state.id);
      if (!enemy) {
        const def = [...MONSTERS, ...BOSSES].find((d) => d.id === state.defId) ?? {
          ...MONSTERS[0],
          id: state.defId,
          name: '盗宝哥布林',
          family: 'goblin',
          color: '#b6a660',
        };
        enemy = this.spawn(def, state.x, state.y, state.elite, state.boss, state.minion);
      }
      enemy.guestVelocity = { x: (state.x - enemy.x) / dt, y: (state.y - enemy.y) / dt };
      enemy.pose = state.pose;
      enemy.age = 0;
      if (state.hp < enemy.hp) enemy.view.hit();
      Object.assign(enemy, {
        id: state.id,
        x: state.x,
        y: state.y,
        hp: state.hp,
        maxHp: state.maxHp,
      });
      enemy.view.position.set(state.x, state.y);
      enemy.view.zIndex = state.y;
      enemy.view.alpha = state.hp > 0 ? 1 : 0.3;
      enemy.view.drawHealth(Math.max(0, state.hp / state.maxHp));
      next.push(enemy);
      existing.delete(state.id);
    }
    for (const enemy of existing.values()) enemy.view.destroy({ children: true });
    this.enemies = next;
    this.coopVisuals.clear();
    let usedStamps = 0;
    const stamp = (
      texture: Texture | undefined,
      x: number,
      y: number,
      w: number,
      h: number,
      angle: number,
      color: number,
      alpha: number,
    ) => {
      if (!texture) return false;
      const view = this.coopStamps[usedStamps] ?? this.effectsLayer.addChild(new Sprite(texture));
      this.coopStamps[usedStamps++] = view;
      view.texture = texture;
      view.visible = true;
      view.anchor.set(0.5);
      view.position.set(x, y);
      view.width = w;
      view.height = h;
      view.rotation = angle;
      view.alpha = alpha;
      view.tint = color;
      return true;
    };
    for (const p of frame.projectiles) {
      const size = 46 * (p.scale ?? 1);
      const art = getProjectileArt(p.skillId ?? '', p.color);
      if (stamp(art.texture, p.x, p.y, size, size, p.angle, art.tint, 1)) continue;
      pixelLine(
        this.coopVisuals,
        p.x - Math.cos(p.angle) * 12,
        p.y - Math.sin(p.angle) * 12,
        p.x,
        p.y,
        p.color,
        3,
      );
    }
    for (const z of frame.zones) {
      const diameter = Math.min(270, z.radius * 2);
      stamp(
        getZoneTexture(z.skillId, z.color === ELEMENT_COLORS.ice),
        z.x,
        z.y,
        diameter,
        diameter * 0.68,
        0,
        0xffffff,
        0.4,
      );
      pixelEllipse(this.coopVisuals, z.x, z.y, z.radius, z.radius * 0.6, z.color, 6, 0.3, true);
    }
    for (const o of frame.orbs) {
      const color = o.kind === 'health' ? 0xdd5269 : o.kind === 'progress' ? 0xb49be7 : 0xd7bb76;
      if (o.kind === 'gold' || o.kind === 'item') {
        const size = o.kind === 'gold' ? 25 : 32;
        const texture =
          o.kind === 'item'
            ? getDropTexture(o.appearanceKey, o.slot)
            : getAtlasTexture('loot:gold');
        if (stamp(texture, o.x, o.y, size, size, 0, 0xffffff, 1)) continue;
      }
      if (
        (o.kind === 'health' || o.kind === 'progress') &&
        stamp(getEffectTexture('globe'), o.x, o.y, 22, 22, 0, color, 1)
      )
        continue;
      this.coopVisuals.rect(o.x - 3, o.y - 3, 6, 6).fill(color);
    }
    for (const w of frame.warnings) {
      const d = warningDecal(w);
      stamp(d.texture, d.x, d.y, d.width, d.height, d.angle, 0xffffff, 0.5);
      if (w.shape === 'circle')
        pixelEllipse(this.coopVisuals, w.x, w.y, w.radius, w.radius, w.color, 6, 0.5, true);
      else if (w.shape === 'cone') {
        const points = [w.x, w.y];
        for (let i = 0; i <= 12; i++) {
          const angle = w.angle - w.width + (w.width * 2 * i) / 12;
          points.push(w.x + Math.cos(angle) * w.range, w.y + Math.sin(angle) * w.range);
        }
        pixelPolygon(this.coopVisuals, points, w.color, 6, 0.25);
      } else {
        const dx = Math.cos(w.angle) * w.range,
          dy = Math.sin(w.angle) * w.range;
        const ox = -Math.sin(w.angle) * w.width,
          oy = Math.cos(w.angle) * w.width;
        pixelPolygon(
          this.coopVisuals,
          [
            w.x + ox,
            w.y + oy,
            w.x + dx + ox,
            w.y + dy + oy,
            w.x + dx - ox,
            w.y + dy - oy,
            w.x - ox,
            w.y - oy,
          ],
          w.color,
          6,
          0.25,
        );
      }
    }
    for (const state of frame.pylons) {
      const pylon = this.pylons.find((p) => p.id === state.id);
      if (pylon) {
        pylon.used = state.used;
        pylon.view.alpha = state.used ? 0.4 : 1;
      }
    }
    for (let i = usedStamps; i < this.coopStamps.length; i++) this.coopStamps[i].visible = false;
    this.updateCoopLabels();
    const result = frame.results?.[this.coop!.localId];
    if (result) {
      this.finished = true;
      this.callbacks.onSound(result.won ? 'victory' : 'defeat');
      this.callbacks.onFinish(result);
    }
  }

  private applyStaticPowers() {
    const s = this.config.stats;
    const p = (id: string) => this.power(id);
    if (p('elements')) {
      s.elementDamage += p('elements');
      s.eliteDamage += 0.8;
    }
    if (p('sacred_walkers')) {
      s.moveSpeed += 220 * 0.35;
      s.independent.push(Math.max(0, s.moveSpeed / 220 - 1) * p('sacred_walkers'));
    }
    if (p('immortal_armor')) s.damageReduction = 1 - (1 - s.damageReduction) * 0.6;
    if (this.set('immortal_thorns', 2)) s.damageReduction = 1 - (1 - s.damageReduction) * 0.5;
    if (p('oraviel')) {
      s.critDamage += Math.max(0, s.critChance - 0.5) * p('oraviel');
      s.critChance = 0.5;
    }
    if (p('shield_of_ancients')) s.armor *= 1.2;
    if (this.learned('glass_cannon')) {
      s.independent.push(0.25 * this.rankScale('glass_cannon'));
      s.hp *= 0.9;
      this.hp = s.hp;
    }
    if (this.learned('thick_skin'))
      s.damageReduction = 1 - (1 - s.damageReduction) * (1 - 0.2 * this.rankScale('thick_skin'));
    if (this.learned('overwhelming_essence')) {
      s.maxResource += 40 * this.rankScale('overwhelming_essence');
      this.resource = s.maxResource;
    }
    if (p('reilena')) s.independent.push(s.maxResource * p('reilena'));
    if (this.learned('stormborn')) s.attackSpeed += 0.2 * this.rankScale('stormborn');
    if (this.learned('predator')) s.dodge += 0.08 * this.rankScale('predator');
  }
  private power(id: string) {
    return this.powers.get(id) ?? 0;
  }
  private set(id: string, pieces: number) {
    return (this.setCounts.get(id) ?? 0) >= pieces;
  }
  private learned(id: string) {
    return (this.config.skills[id] ?? 0) > 0;
  }
  private skill(id: string) {
    return SKILLS.find((s) => s.id === id);
  }
  setMovement(x: number, y: number) {
    const len = Math.max(1, Math.hypot(x, y));
    this.movement = { x: x / len, y: y / len };
  }
  setAuto(id: string, enabled: boolean) {
    this.config.autoSkills[id] = enabled;
    if (this.isCoopGuest) this.coopInput.autoSkills = { ...this.config.autoSkills };
  }
  getSkillCost(id: string) {
    const skill = this.skill(id);
    if (!skill || this.buffs.has('channeling')) return 0;
    const resolved = this.resolveSkill(skill);
    return resolved.cost * (this.power('grand_vizier') && resolved.effect === 'meteor' ? 0.5 : 1);
  }
  private clearInput() {
    this.keys.clear();
    this.setMovement(0, 0);
    this.drag = undefined;
    this.dragMovement = { x: 0, y: 0 };
    this.movementDirection = { x: 0, y: 0 };
    this.moving = false;
    this.gamepadHeld.clear();
    this.gamepadBlocked = true;
    this.coopInput.commands = [];
    this.coopInput.movement = { x: 0, y: 0 };
    if (this.isCoopGuest && this.initialized) {
      this.coopInputClock = 0;
      this.sendCoopInput(0);
    }
  }
  setPaused(paused: boolean) {
    if (this.finished) return;
    this.paused = paused;
    this.clearInput();
    this.emit();
  }
  togglePause() {
    this.setPaused(!this.paused);
  }
  private hasInputDialog() {
    return (
      typeof document !== 'undefined' &&
      !!document.querySelector('[role="dialog"][aria-modal="true"]')
    );
  }
  private inputKey(e: KeyboardEvent) {
    const code =
      e.code ||
      (e.key === ' '
        ? 'Space'
        : /^[a-z]$/i.test(e.key)
          ? `Key${e.key.toUpperCase()}`
          : /^\d$/.test(e.key)
            ? `Digit${e.key}`
            : e.key);
    const bindings = { ...DEFAULT_KEYS, ...getPreferences(this.config.preferences).keyBindings };
    const action = Object.entries(bindings).find(([, bound]) => bound === code)?.[0];
    if (action?.startsWith('skill')) return action.slice(5);
    if (action)
      return (
        { up: 'w', down: 's', left: 'a', right: 'd', movement: ' ' } as Record<string, string>
      )[action];
    return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(code)
      ? code.toLowerCase()
      : '';
  }
  private onKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (
      e.defaultPrevented ||
      e.isComposing ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      target?.closest?.(
        'input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="dialog"]',
      ) ||
      this.hasInputDialog()
    )
      return;
    const key = this.inputKey(e);
    if (this.paused && key !== 'escape') return;
    if (key === ' ' && target?.closest?.('button,a[href],[role="button"]')) return;
    if (
      ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright', ' '].includes(key)
    ) {
      e.preventDefault();
      this.keys.add(key);
      if (key === ' ' && !e.repeat) {
        const skill = this.skills.find((s) => s.kind === 'movement');
        if (skill) this.cast(skill.id);
      }
    }
    if (/^[1-6]$/.test(key) && !e.repeat) {
      const skill = this.skills[Number(key) - 1];
      if (skill) this.cast(skill.id);
    }
    if (key === 'escape' && !e.repeat) this.togglePause();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(this.inputKey(e));
  };
  private onBlur = () => {
    this.setPaused(true);
  };
  private onVisibility = () => {
    if (document.hidden) this.onBlur();
  };
  private onPointerDown = (e: PointerEvent) => {
    if (
      e.button !== 0 ||
      !e.isPrimary ||
      this.paused ||
      this.finished ||
      this.hasInputDialog() ||
      this.drag
    )
      return;
    this.drag = {
      x: e.clientX,
      y: e.clientY,
      pointerId: e.pointerId,
      radius: pointerDragRadius(e.pointerType),
    };
  };
  private onPointerMove = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return;
    const x = (e.clientX - this.drag.x) / this.drag.radius;
    const y = (e.clientY - this.drag.y) / this.drag.radius;
    const len = Math.max(1, Math.hypot(x, y));
    this.dragMovement = { x: x / len, y: y / len };
  };
  private onPointerUp = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return;
    this.drag = undefined;
    this.dragMovement = { x: 0, y: 0 };
  };
  private tick = () => {
    if (!this.app || this.disposed) return;
    const dt = Math.min(0.05, this.app.ticker.deltaMS / 1000);
    this.fps = this.app.ticker.FPS;
    if (!this.coop && !this.paused && !this.finished) this.update(dt);
    if (this.isCoopGuest && !this.finished) {
      const time = performance.now() / 1000;
      for (const actor of this.coopActors.values()) {
        if (actor.hp > 0) actor.hero.update(time, dt, actor.moving, actor.facing, false);
      }
      for (const e of this.enemies) {
        if (e.hp <= 0 || !e.guestVelocity) continue;
        e.age += dt;
        const movingTime = e.age <= 0.25 ? dt : 0;
        e.view.update(
          this.elapsed + e.age,
          dt,
          e.guestVelocity.x * movingTime,
          e.guestVelocity.y * movingTime,
          e.id,
          e.pose,
        );
      }
      this.vfx.tick(dt);
    }
    this.updateCamera(dt);
  };
  private update(dt: number) {
    this.elapsed += dt;
    this.updateActor(dt);
    this.updateWaves(dt);
    this.updateEnemies(dt);
    this.updateWarningAnimations(dt);
    this.updateOrbs(dt);
    this.updateEnvironment(dt);
    this.vfx.tick(dt);
    this.numbers.tick(dt);
    if (
      this.progress >= 100 &&
      !this.bossSpawned &&
      !this.config.training &&
      this.objectiveComplete()
    )
      this.summonBoss();
    if (this.hp <= 0 && !this.config.training) this.finish(false);
    if (this.elapsed >= 300 && !this.config.training) this.finish(false);
    if (this.config.training) this.hp = this.config.stats.hp;
    this.snapshotTimer -= dt;
    if (this.snapshotTimer <= 0) {
      this.snapshotTimer = 0.1;
      this.emit();
    }
  }
  private updateActor(dt: number) {
    this.buffs.tick(dt);
    this.updateShield(dt);
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;
    for (const id of Object.keys(this.cooldowns)) {
      this.cooldowns[id] = Math.max(0, this.cooldowns[id] - dt);
      if (!this.cooldowns[id]) delete this.cooldowns[id];
    }
    let mx = this.paused ? 0 : this.movement.x + this.dragMovement.x,
      my = this.paused ? 0 : this.movement.y + this.dragMovement.y;
    mx +=
      (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) -
      (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0);
    my +=
      (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) -
      (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0);
    const gamepadSkills: SkillDef[] = [];
    const pad =
      !this.coopParent && !this.paused
        ? globalThis.navigator?.getGamepads?.()?.find((p) => p?.connected)
        : undefined;
    if (pad && !this.hasInputDialog() && this.gamepadBlocked) {
      // Require neutral input after a pause or reconnect before accepting a held action.
      this.gamepadBlocked =
        pad.buttons.slice(0, 6).some((button) => button.pressed) ||
        Math.abs(pad.axes[0] ?? 0) > 0.18 ||
        Math.abs(pad.axes[1] ?? 0) > 0.18;
    } else if (pad && !this.hasInputDialog()) {
      if (Math.abs(pad.axes[0] ?? 0) > 0.18) mx += pad.axes[0];
      if (Math.abs(pad.axes[1] ?? 0) > 0.18) my += pad.axes[1];
      for (let i = 0; i < 6; i++) {
        if (pad.buttons[i]?.pressed && !this.gamepadHeld.has(i)) {
          this.gamepadHeld.add(i);
          const skill = this.skills[i];
          if (skill) gamepadSkills.push(skill);
        } else if (!pad.buttons[i]?.pressed) this.gamepadHeld.delete(i);
      }
    } else {
      this.gamepadHeld.clear();
      this.gamepadBlocked = true;
    }
    const len = Math.max(1, Math.hypot(mx, my));
    mx /= len;
    my /= len;
    this.moving = Math.hypot(mx, my) > 0.1;
    this.movementDirection = { x: mx, y: my };
    if (mx) this.facing = mx;
    for (const skill of gamepadSkills) this.cast(skill.id);
    const speed =
      this.config.stats.moveSpeed *
      (this.elapsed < this.slowUntil && !this.buffs.has('ultimate') ? 1 - this.slowRatio : 1) *
      (this.buffs.has('speed') ? 1.6 : 1) *
      (this.buffs.has('berserker') ? 1.4 : 1) *
      (this.buffs.has('wolf') ? 1.4 : 1) *
      (this.set('wasteland', 2) && this.buffs.has('whirlwind') ? 1.4 : 1) *
      (this.power('bulkathos') && this.buffs.has('whirlwind') ? 1 + this.power('bulkathos') : 1);
    this.x += mx * speed * dt;
    this.y += my * speed * dt;
    if (
      !this.buffs.has('speed') &&
      !this.buffs.has('whirlwind') &&
      !this.buffs.has('invulnerable')
    ) {
      for (const e of this.enemies) {
        const distance = this.distance(e),
          limit = 18 + e.radius * 0.5;
        if (e.hp > 0 && distance > 0 && distance < limit) {
          this.x += ((this.x - e.x) / distance) * (limit - distance);
          this.y += ((this.y - e.y) / distance) * (limit - distance);
        }
      }
    }
    this.x = clampArena(this.x);
    this.y = clampArena(this.y);
    this.hero.position.set(this.x, this.y);
    this.hero.zIndex = this.y;
    this.hero.update(
      this.elapsed,
      dt,
      this.moving,
      this.facing,
      this.buffs.has('power') || this.buffs.has('ultimate'),
    );
    this.resource = Math.min(
      this.config.stats.maxResource,
      this.resource + dt * this.config.stats.resourceRegen,
    );
    this.hp = Math.min(this.config.stats.hp, this.hp + this.config.stats.regen * dt);
    this.castTimer -= dt;
    const targets = this.enemies.filter((e) => e.hp > 0 && this.distance(e) < 420);
    if (
      targets.length &&
      this.skills.some(
        (skill) =>
          skill.kind === 'core' &&
          isSkillAutoEnabled(this.config.autoSkills, skill) &&
          !this.cooldowns[skill.id] &&
          this.resource < this.getSkillCost(skill.id),
      )
    )
      this.report.resourceStarvedSeconds! += dt;
    if (this.castTimer <= 0 && targets.length) {
      const selected = selectAutoCast(this.skills, {
        hpRatio: this.hp / this.config.stats.hp,
        nearby: targets.filter((e) => this.distance(e) < 150).length,
        enemies: targets.length,
        elite: targets.some((e) => e.elite || e.boss),
        resource: this.resource,
        costs: Object.fromEntries(
          this.skills.map((skill) => [skill.id, this.getSkillCost(skill.id)]),
        ),
        free: this.buffs.has('channeling'),
        cooldowns: this.cooldowns,
        auto: this.config.autoSkills,
        focus:
          this.set('vyr', 2) && this.buffs.has('archon')
            ? this.skills.find((skill) => skill.kind === 'basic')?.id
            : this.set('immortal_thorns', 4)
              ? 'war_cry'
              : undefined,
      });
      if (selected) {
        if (this.coop && this.paused) this.perform(selected, false);
        else this.cast(selected.id);
      }
    }
    for (const p of [...this.projectiles.items])
      if (
        p.skillId === 'frozen_orb' &&
        p.proc &&
        Math.floor((p.age + dt) * 4) > Math.floor(p.age * 4)
      ) {
        for (let i = 0; i < 6; i++)
          this.projectiles.spawn(p.x, p.y, (i * Math.PI) / 3, 0xa7e1ed, p.skillId, {
            scale: 0.4,
            multiplier: p.multiplier * 0.12,
            proc: false,
            pierce: 1,
            life: 0.5,
          });
      }
    this.projectiles.tick(
      dt,
      this.enemies,
      (p, id) => {
        const enemy = this.enemies.find((e) => e.id === id);
        const skill = this.skill(p.skillId);
        if (!enemy || !skill) return;
        this.hit(enemy, skill, p.multiplier, p.proc, false, p.cast);
        if (p.proc && ['explosive', 'elemental', 'orb'].includes(skill.effect)) {
          this.explode(
            enemy.x,
            enemy.y,
            skill.effect === 'orb' ? 80 : 45,
            skill,
            p.multiplier * 0.4 * (skill.effect === 'orb' && this.set('delsere', 2) ? 2 : 1),
            true,
            p.cast,
          );
        }
        if (p.proc && skill.id === 'magic_missile' && this.learned('seeking_missile'))
          for (let j = 0; j < 2; j++)
            this.projectiles.spawn(
              enemy.x,
              enemy.y,
              this.random() * Math.PI * 2,
              p.color,
              'seeking_missile',
              { homing: true, proc: false, multiplier: skill.multiplier },
            );
        if (p.proc && skill.effect === 'spear' && this.learned('shatter_spear'))
          for (let j = 0; j < 3; j++)
            this.projectiles.spawn(
              enemy.x,
              enemy.y,
              this.random() * Math.PI * 2,
              p.color,
              'shatter_spear',
              {
                pierce: 2 + (this.power('bone_relic') ? 2 : 0),
                proc: false,
                multiplier: skill.multiplier,
              },
            );
        if (skill.effect === 'elemental' && this.set('frost_hunter', 4))
          for (let j = 0; j < 6; j++)
            this.projectiles.spawn(enemy.x, enemy.y, (j * Math.PI) / 3, p.color, 'frost_pierce', {
              pierce: 2,
              multiplier: 0.4,
              proc: false,
            });
      },
      (p) => {
        if (p.skillId === 'flying_blade' && this.learned('return_blade'))
          this.resource = Math.min(
            this.config.stats.maxResource,
            this.resource + 5 * this.rankScale('return_blade'),
          );
      },
      (p) => {
        if (p.skillId === 'frozen_orb' && p.proc) {
          const skill = this.skill(p.skillId);
          if (skill) this.explode(p.x, p.y, 110, skill, p.multiplier);
        }
      },
    );
    this.updateZones(dt);
    this.updatePet(dt);
    this.periodic(dt);
  }
  private objectiveComplete() {
    const rule = CHALLENGES.find((c) => c.id === this.config.challenge?.id);
    return !rule || this.objectiveProgress >= rule.target;
  }
  private updateEnvironment(dt: number) {
    if (this.config.training || this.finished) return;
    const mode = this.config.challenge?.id;
    if (mode === 'ward' && this.objectiveProgress < 18) {
      if (!this.headless && !this.objectiveMarker) {
        this.objectiveMarker = new Graphics()
          .circle(0, 0, 140)
          .fill({ color: 0x70c5e8, alpha: 0.12 })
          .stroke({ color: 0xb9e5f5, width: 4 });
        this.floorLayer.addChild(this.objectiveMarker);
      }
      if (this.hp > 0 && Math.hypot(this.x, this.y) <= 140)
        this.objectiveProgress = Math.min(18, this.objectiveProgress + dt);
    }
    this.environmentClock += dt;
    const interval = mode === 'hazards' ? 4 : 13;
    if ((mode === 'hazards' || this.config.stage >= 16) && this.environmentClock >= interval) {
      this.environmentClock = 0;
      const view = new Graphics();
      const radius = mode === 'hazards' ? 110 : 85;
      const x = this.x,
        y = this.y;
      if (!this.headless) {
        view
          .circle(x, y, radius)
          .fill({ color: 0xea8b68, alpha: 0.15 })
          .stroke({ color: 0xffb68b, width: 4 });
        view
          .moveTo(x - 10, y)
          .lineTo(x + 10, y)
          .moveTo(x, y - 10)
          .lineTo(x, y + 10)
          .stroke({ color: 0xffedc5, width: 3 });
        this.floorLayer.addChild(view);
      }
      this.hazards.push({ x, y, radius, delay: 1.2, view });
    }
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hazard = this.hazards[i];
      hazard.delay -= dt;
      if (hazard.delay > 0) continue;
      if (mode === 'hazards') this.objectiveProgress = Math.min(6, this.objectiveProgress + 1);
      for (const actor of this.coop ? this.coopActors.values() : [this]) {
        if (actor.hp <= 0 || Math.hypot(actor.x - hazard.x, actor.y - hazard.y) > hazard.radius)
          continue;
        const theme = STAGES[this.config.stage - 1].theme;
        actor.takeDamage(
          (actor.config.stats.hp * 0.2) / STAGES[this.config.stage - 1].damageMultiplier,
          ['荆棘蔓生', '墓穴寒潮', '熔岩喷涌', '虚空震荡'][theme],
        );
        if (theme === 0 || theme === 1) {
          actor.slowUntil = this.elapsed + 2;
          actor.slowRatio = 0.35;
        }
        if (theme === 3) {
          actor.x = clampArena(actor.x + (actor.x >= hazard.x ? 70 : -70));
        }
      }
      this.vfx.ring(hazard.x, hazard.y, 0xea8b68, hazard.radius);
      hazard.view.destroy();
      this.hazards.splice(i, 1);
    }
  }
  private updateCamera(dt: number) {
    if (!this.app) return;
    this.mapClock -= dt;
    if (this.mapClock <= 0) {
      this.mapClock = 0.2;
      this.drawMinimap();
    }
    const w = this.app.screen.width,
      h = this.app.screen.height;
    const framing = combatFraming(w, h, this.compactViewport?.matches ?? false);
    const scale = framing.scale;
    this.world.scale.set(scale);
    this.shake = Math.max(0, this.shake - dt * 22);
    const shake =
      getPreferences(this.config.preferences).screenShake &&
      !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? this.shake
        : 0;
    this.world.position.set(
      framing.x - this.x * scale + (Math.random() - 0.5) * shake,
      framing.y - this.y * scale + (Math.random() - 0.5) * shake,
    );
  }
  private drawMinimap() {
    if (!this.app) return;
    const g = this.minimap;
    const compact = this.compactViewport?.matches ?? false;
    g.visible = !compact;
    g.scale.set(compact ? 0.65 : 1);
    g.position.set(this.app.screen.width - (compact ? 76 : 120), compact ? 112 : 84);
    g.clear()
      .circle(52, 52, 51)
      .fill({ color: 0x101e23, alpha: 0.82 })
      .stroke({ color: 0x9b997e, alpha: 0.5, width: 1 });
    const point = (x: number, y: number) => ({
      x: 52 + (x - this.x) / 16,
      y: 52 + (y - this.y) / 16,
    });
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const p = point(e.x, e.y);
      if (Math.hypot(p.x - 52, p.y - 52) > 47) continue;
      g.rect(p.x - 1, p.y - 1, e.boss ? 5 : 2, e.boss ? 5 : 2).fill(
        e.boss ? 0xf78f9d : e.elite ? 0xe4c785 : 0x9f8b83,
      );
    }
    for (const o of this.orbs) {
      if (!o.item && o.kind !== 'progress') continue;
      const p = point(o.x, o.y);
      if (Math.hypot(p.x - 52, p.y - 52) > 47) continue;
      g.poly([p.x, p.y - 3, p.x + 3, p.y, p.x, p.y + 3, p.x - 3, p.y]).fill(
        o.item ? RARITY_COLORS[o.item.rarity] : 0xc5a5ef,
      );
    }
    for (const pylon of this.pylons) {
      if (pylon.used) continue;
      const p = point(pylon.x, pylon.y);
      if (Math.hypot(p.x - 52, p.y - 52) <= 47) g.rect(p.x - 2, p.y - 2, 4, 4).fill(0xb5a3e0);
    }
    g.poly([52, 46, 56, 56, 52, 54, 48, 56]).fill(0xd5efcf);
  }
  private distance(e: { x: number; y: number }) {
    return Math.hypot(e.x - this.x, e.y - this.y);
  }
  private spawn(
    def: MonsterDef,
    x: number,
    y: number,
    elite = false,
    boss = false,
    minion = false,
  ): Enemy {
    x = clampArena(x);
    y = clampArena(y);
    const stage = STAGES[this.config.stage - 1] ?? STAGES[0];
    const view = this.headless
      ? (new SimulationActor() as unknown as MonsterRig)
      : new MonsterRig(def, elite, boss, minion);
    const balance = coopBalance(this.coopHost.coop?.members.length ?? 1);
    const hp =
      def.hp *
      stage.hpMultiplier *
      (elite ? 5 : 1) *
      (minion ? 1.6 : 1) *
      (boss ? balance.bossHp : balance.monsterHp);
    const e: Enemy = {
      id: this.nextId++,
      def,
      x,
      y,
      hp,
      maxHp: hp,
      radius: boss ? 48 : def.radius,
      view,
      elite,
      boss,
      minion,
      age: 0,
      attackTimer: 1 + this.random(),
      stun: 0,
      slow: 0,
      poison: 0,
      poisonStacks: 0,
      vulnerability: 0,
      lastQuarter: 4,
      affix: Math.floor(this.random() * 10),
      brain: boss ? undefined : createMonsterBrain(this.nextId * 7307 + this.config.stage),
      bossBrain: boss ? createBossBrain() : undefined,
      shield: 0,
      shieldTime: 0,
    };
    view.position.set(x, y);
    this.entityLayer.addChild(view);
    this.enemies.push(e);
    return e;
  }
  private startEncounter() {
    this.spawnWave();
    if (!this.config.training && this.random() < RIFT_RULES.goblinChance) this.spawnGoblin();
  }
  private updateWaves(dt: number) {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && !this.bossSpawned) this.spawnWave();
  }
  private spawnWave() {
    this.spawnTimer = RIFT_RULES.waveInterval;
    if (this.config.training) {
      if (!this.enemies.length)
        for (let i = 0; i < 3; i++)
          this.spawn(
            {
              ...MONSTERS[0],
              id: 'training_dummy',
              name: '符文训练木桩',
              family: 'dummy',
              behavior: 'dummy',
              hp: 1e100,
              attack: 0,
              speed: 0,
              color: '#aa8f62',
            },
            (i - 1) * 130,
            -140,
          );
      return;
    }
    const alive = this.enemies.filter((e) => e.hp > 0).length;
    if (alive > 55) return;
    // Match the opening crowd to a character who has only a basic attack.
    const count = Math.min(12, 4 + this.config.stage * 2, this.config.stage * 8 - alive);
    for (let i = 0; i < count; i++) {
      const a = this.random() * Math.PI * 2,
        d = 260 + this.random() * 180;
      const def =
        MONSTERS[
          (Math.floor(this.random() * 6) + (STAGES[this.config.stage - 1]?.theme ?? 0) * 6) %
            MONSTERS.length
        ];
      this.spawn(
        def,
        spawnCoordinate(this.x, Math.cos(a) * d),
        spawnCoordinate(this.y, Math.sin(a) * d),
      );
    }
    if (
      this.elapsed > 4 &&
      Math.floor(this.elapsed / RIFT_RULES.waveInterval) % 3 === 1 &&
      (this.config.stage >= 5 || !this.enemies.some((e) => e.elite && e.hp > 0))
    ) {
      const a = this.random() * 6.28,
        x = spawnCoordinate(this.x, Math.cos(a) * 350),
        y = spawnCoordinate(this.y, Math.sin(a) * 350);
      this.spawn(MONSTERS[this.config.stage % MONSTERS.length], x, y, true);
      for (let i = 0; i < 3; i++)
        this.spawn(
          MONSTERS[this.config.stage % MONSTERS.length],
          x + (i - 1) * 35,
          y + 30,
          false,
          false,
          true,
        );
    }
  }
  private spawnGoblin() {
    const def = {
      ...MONSTERS[0],
      id: 'treasure_goblin',
      name: '黄金盗宝哥布林',
      hp: MONSTERS[0].hp * 5,
      color: '#b6a660',
      speed: 130,
      family: 'goblin',
    };
    const e = this.spawn(def, this.x + 220, this.y - 180);
    e.goblin = true;
    this.numbers.show(e.x, e.y, '盗宝者出现', true, 0xf2cd7d);
  }
  private summonBoss() {
    this.bossSpawned = true;
    for (const id of this.enemyWarnings.keys()) this.clearWarning(id);
    for (const e of this.enemies) {
      e.hp = 0;
      if (e.brain) e.brain.pending.length = 0;
      e.deadTime = 0.15;
      e.view.alpha = 0.5;
    }
    this.vfx.ring(this.x, this.y, 0xf1dfaa, 650);
    this.shake = 12;
    this.callbacks.onSound('boss');
    const def = BOSSES[(this.config.stage - 1) % BOSSES.length];
    // The first guardians meet a hero with a single basic attack and no guaranteed gear.
    const openingHealth = Math.min(1, 0.25 + (this.config.stage - 1) * 0.15);
    const boss = this.spawn(
      { ...def, hp: def.hp * openingHealth },
      this.x,
      spawnCoordinate(this.y, -220),
      false,
      true,
    );
    this.numbers.show(boss.x, boss.y + 90, def.name, true, 0xf2ba9b);
  }
  private updateEnemies(dt: number) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.age += dt;
      if (this.config.training && e.def.family === 'dummy') {
        e.x = (i - 1) * 130;
        e.y = -140;
      }
      if (!e.goblin) this.stepEnemyBrain(e, dt);
      e.shieldTime = Math.max(0, e.shieldTime - dt);
      if (e.shieldTime === 0) e.shield = 0;
      if (e.hp <= 0) {
        e.deadTime = (e.deadTime ?? 0.4) - dt;
        e.view.alpha = Math.max(0, e.deadTime / 0.4);
        e.view.rotation += dt * 2;
        e.view.y -= dt * 18;
        if (e.deadTime <= 0 && !e.brain?.pending.length) {
          e.warning?.view.destroy();
          e.view.destroy({ children: true });
          this.enemies.splice(i, 1);
        }
        continue;
      }
      e.stun = Math.max(0, e.stun - dt);
      e.curse = Math.max(0, (e.curse ?? 0) - dt);
      e.exposure = Math.max(0, (e.exposure ?? 0) - dt);
      if (e.exposure === 0) e.elements?.clear();
      if (e.vulnerabilities) {
        for (const [key, buff] of Object.entries(e.vulnerabilities))
          if (buff.expires <= this.elapsed) delete e.vulnerabilities[key];
        e.vulnerability = Object.values(e.vulnerabilities).reduce(
          (sum, buff) => sum + buff.value,
          0,
        );
      }
      e.slow = Math.max(0, e.slow - dt);
      if (e.slow === 0) e.slowRatio = undefined;
      if (e.armorReduction && e.armorReduction.expires <= this.elapsed)
        e.armorReduction = undefined;
      if ((e.curse ?? 0) > 0 && !e.boss && e.hp / e.maxHp < 0.15) {
        e.hp = 0;
        this.kill(e);
        continue;
      }
      e.attackTimer -= dt;
      const d = this.distance(e),
        a = Math.atan2(this.y - e.y, this.x - e.x);
      const speed =
        e.def.speed *
        (e.slow > 0 ? 1 - (e.slowRatio ?? 0.6) : 1) *
        (e.stun > 0 ? 0 : 1) *
        (e.goblin ? -1.7 : 1);
      if (e.goblin) {
        if (e.age > 5) {
          this.vfx.ring(e.x, e.y, 0xb798f0, 45);
          e.hp = 0;
          e.deadTime = 0.2;
          continue;
        }
        if (Math.floor((e.age - dt) * 3) !== Math.floor(e.age * 3)) this.drop('gold', e.x, e.y, 3);
      }
      if (e.goblin && d > 35) {
        e.x += Math.cos(a) * speed * dt;
        e.y += Math.sin(a) * speed * dt;
      }
      if (this.buffs.has('speed') && d < 50) {
        e.stun = Math.max(e.stun, 0.6);
        e.x -= Math.cos(a) * dt * 200;
        e.y -= Math.sin(a) * dt * 200;
      }
      e.x = clampArena(e.x);
      e.y = clampArena(e.y);
      if (e.poison > 0) {
        const poisonTime = Math.min(dt, e.poison);
        e.poison = Math.max(0, e.poison - dt);
        (e.poisonOwner ?? this).hit(
          e,
          e.poisonSkill ?? this.skills[0],
          poisonTime * 0.4 * Math.max(1, e.poisonStacks),
          false,
          true,
        );
        if (e.poison === 0) e.poisonStacks = 0;
      }
      if ((e.bleed ?? 0) > 0) {
        e.bleed = Math.max(0, e.bleed! - dt);
        const owner = e.bleedOwner ?? this;
        owner.hit(e, e.bleedSkill, dt * (owner.learned('blood_fan') ? 1.6 : 1), false, true);
      }
      if (e.hp <= 0) continue;
      if (e.pose && this.elapsed >= e.pose.start + e.pose.duration) e.pose = undefined;
      e.view.update(this.elapsed, dt, e.x - e.view.x, e.y - e.view.y, e.id, e.pose);
      e.view.position.set(e.x, e.y);
      e.view.zIndex = e.y;
      e.view.drawHealth(e.hp / e.maxHp);
    }
  }
  private enemyTarget(e: Enemy): { x: number; y: number } {
    const intercept = !e.boss && ['melee', 'swarm', 'charge', 'slam'].includes(e.def.behavior);
    if (!this.coop && (!intercept || !this.summons.length)) return { x: this.x, y: this.y };
    let target: GameEngine | CharacterRig = this;
    let nearest = Infinity;
    for (const actor of this.coop ? this.coopActors.values() : [this]) {
      if (actor.hp <= 0) continue;
      const playerDistance = (actor.x - e.x) ** 2 + (actor.y - e.y) ** 2;
      if (playerDistance <= nearest) {
        nearest = playerDistance;
        target = actor;
      }
      if (!intercept) continue;
      for (const [index, summon] of actor.summons.entries()) {
        if (!isSkeletonWarrior(index) || (actor.summonStates.get(summon)?.hp ?? 0) <= 0) continue;
        const distance = (summon.x - e.x) ** 2 + (summon.y - e.y) ** 2;
        if (distance <= 120 ** 2 && distance < nearest) {
          nearest = distance;
          target = summon;
        }
      }
    }
    return target instanceof GameEngine ? { x: target.x, y: target.y } : target;
  }
  private stepEnemyBrain(e: Enemy, dt: number) {
    if (this.config.training) return;
    const target = this.enemyTarget(e);
    const input = {
      dt,
      time: this.elapsed,
      id: e.id,
      behavior: e.def.behavior,
      family: e.def.family,
      x: e.x,
      y: e.y,
      playerX: target.x,
      playerY: target.y,
      hp: e.hp,
      maxHp: e.maxHp,
      attack: e.def.attack,
      speed: e.def.speed * (e.slow > 0 ? 1 - (e.slowRatio ?? 0.6) : 1),
      elite: e.elite,
      affix: ELITE_AFFIXES[e.affix]?.id,
      stunned: e.stun > 0,
    };
    const result = e.bossBrain
      ? stepBossAI(e.bossBrain, input, e.def as BossDef)
      : e.brain
        ? stepMonsterAI(e.brain, input)
        : undefined;
    if (!result) return;
    e.x += result.velocity.x * dt;
    e.y += result.velocity.y * dt;
    for (const event of result.events) this.handleEnemyEvent(e, event);
  }
  private clearWarning(id: number) {
    this.warningAnimations.get(id)?.art?.destroy();
    this.enemyWarnings.get(id)?.destroy();
    this.enemyWarnings.delete(id);
    this.warningAnimations.delete(id);
  }
  private updateWarningAnimations(dt: number) {
    for (const [id, animation] of this.warningAnimations) {
      const view = this.enemyWarnings.get(id);
      if (!view) {
        this.warningAnimations.delete(id);
        continue;
      }
      animation.age += dt;
      const t = Math.min(1, animation.age / Math.max(0.01, animation.event.delay));
      const e = animation.event;
      view.alpha = 0.6 + t * 0.4;
      if (e.shape === 'circle') {
        view.clear();
        pixelEllipse(view, e.x, e.y, e.radius, e.radius, e.color, 6, 0.12);
        pixelEllipse(view, e.x, e.y, e.radius * t, e.radius * t, e.color, 6, 0.9, true);
      }
    }
  }
  private handleEnemyEvent(e: Enemy, event: MonsterAIEvent) {
    if (event.kind === 'telegraph' || event.kind === 'strike') {
      e.pose = {
        angle: event.angle,
        start: this.elapsed,
        duration: event.kind === 'strike' ? 0.32 : event.delay,
        strike: event.kind === 'strike',
      };
    }
    if (event.kind === 'telegraph') {
      this.clearWarning(event.id);
      const g = new Graphics();
      const color = event.color;
      if (event.shape === 'circle') {
        pixelEllipse(g, event.x, event.y, event.radius, event.radius, color, 6, 0.15);
        pixelEllipse(g, event.x, event.y, event.radius, event.radius, color, 6, 0.8, true);
      } else {
        const points = event.shape === 'cone' ? [event.x, event.y] : [];
        if (event.shape === 'cone') {
          for (let i = 0; i <= 12; i++) {
            const a = event.angle - event.width + (event.width * 2 * i) / 12;
            points.push(event.x + Math.cos(a) * event.range, event.y + Math.sin(a) * event.range);
          }
        } else {
          const dx = Math.cos(event.angle) * event.range,
            dy = Math.sin(event.angle) * event.range;
          const ox = -Math.sin(event.angle) * event.width,
            oy = Math.cos(event.angle) * event.width;
          points.push(
            event.x + ox,
            event.y + oy,
            event.x + dx + ox,
            event.y + dy + oy,
            event.x + dx - ox,
            event.y + dy - oy,
            event.x - ox,
            event.y - oy,
          );
        }
        pixelPolygon(g, points, color, 6, 0.18);
        for (let i = 0; i < points.length; i += 2) {
          const j = (i + 2) % points.length;
          pixelLine(g, points[i], points[i + 1], points[j], points[j + 1], color, 4, 0.8);
        }
      }
      const decal = warningDecal(event);
      const art = decal.texture ? new Sprite(decal.texture) : undefined;
      if (art) {
        art.anchor.set(0.5);
        art.position.set(decal.x, decal.y);
        art.width = decal.width;
        art.height = decal.height;
        art.rotation = decal.angle;
        art.alpha = 0.5;
        this.floorLayer.addChild(art);
      }
      this.floorLayer.addChild(g);
      this.enemyWarnings.set(event.id, g);
      this.warningAnimations.set(event.id, { event, age: 0, art });
      if (e.boss) this.callbacks.onSound('warning');
    } else if (event.kind === 'strike') {
      this.clearWarning(event.id);
      this.vfx.ring(event.targetX, event.targetY, event.color, event.radius);
      if (event.shape === 'line')
        this.vfx.lightning(
          event.x,
          event.y,
          event.x + Math.cos(event.angle) * event.range,
          event.y + Math.sin(event.angle) * event.range,
          ELEMENT_COLORS[event.element],
        );
      if (event.shape === 'cone')
        this.vfx.slash(event.x, event.y, event.angle, ELEMENT_COLORS[event.element], event.range);
      if (e.boss) {
        this.shake = Math.max(this.shake, 5);
        this.vfx.burst(event.targetX, event.targetY, ELEMENT_COLORS[event.element], 18, true);
      }
      for (const actor of this.coop ? this.coopActors.values() : [this])
        actor.applyEnemyStrike(e, event);
    } else if (event.kind === 'heal') {
      for (const other of this.enemies)
        if (
          other.hp > 0 &&
          (other === e ||
            (event.radius > 0 && Math.hypot(other.x - e.x, other.y - e.y) < event.radius))
        )
          other.hp = Math.min(other.maxHp, other.hp + event.amount);
      this.vfx.ring(e.x, e.y, 0x9ccd98, 35);
    } else if (event.kind === 'shield') {
      e.shield = event.amount;
      e.shieldTime = event.duration;
      this.vfx.ring(e.x, e.y, 0xdecfa0, 45);
    } else if (event.kind === 'teleport') {
      this.vfx.ring(e.x, e.y, 0xc9a3db, 40);
      e.x = event.x;
      e.y = event.y;
      this.vfx.ring(e.x, e.y, 0xc9a3db, 40);
    } else if (event.kind === 'summon') {
      for (let i = 0; i < event.count && this.enemies.length < 85; i++) {
        const copy = this.spawn(
          e.boss ? MONSTERS[0] : e.def,
          e.x + (i - 1) * 40,
          e.y + 25,
          false,
          false,
          true,
        );
        copy.hp = copy.maxHp = e.maxHp * event.hpRatio;
      }
    } else if (event.kind === 'selfDestruct') {
      e.hp = 0;
      this.kill(e);
    }
  }
  private applyEnemyStrike(e: Enemy, event: Extract<MonsterAIEvent, { kind: 'strike' }>) {
    for (const summon of this.summons) {
      const state = this.summonStates.get(summon);
      if (!state || state.hp <= 0 || !attackContains(event, summon.x, summon.y)) continue;
      state.hp = Math.max(
        0,
        state.hp -
          mitigateDamage(
            event.damage * (STAGES[this.config.stage - 1]?.damageMultiplier ?? 1),
            this.config.stats,
          ),
      );
      summon.alpha = 0.25 + (0.4 * state.hp) / state.maxHp;
      if (state.hp <= 0) this.defeatSummon(summon);
    }
    if (this.hp > 0 && attackContains(event, this.x, this.y)) {
      this.takeDamage(event.damage, e.def.name);
      if (event.slow && !this.buffs.has('ultimate') && !this.buffs.has('invulnerable')) {
        this.slowUntil = this.elapsed + event.slow.duration;
        this.slowRatio = event.slow.ratio;
      }
      if (this.config.classId === 'barbarian')
        this.resource = Math.min(
          this.config.stats.maxResource,
          this.resource + 8 + (this.learned('thick_skin') ? 6 : 0),
        );
      if (this.config.stats.thorns > 0 && e.hp > 0) {
        if (this.set('immortal_thorns', 4) && this.skills[0])
          this.hitThorns(e, this.skills[0], this.config.stats.thorns);
        else {
          const damage = this.config.stats.thorns * (1 + this.power('shield_of_ancients'));
          const dealt = Math.min(e.hp, damage);
          this.report.damageDealt += dealt;
          this.report.damageBySkill.thorns = (this.report.damageBySkill.thorns ?? 0) + dealt;
          e.hp -= damage;
          this.numbers.show(e.x, e.y, damage);
          if (e.hp <= 0) this.kill(e);
        }
      }
    }
  }
  private takeDamage(raw: number, source = '环境冲击') {
    if (this.hp <= 0 || this.buffs.has('invulnerable')) return;
    raw *= coopBalance(this.coopHost.coop?.members.length ?? 1).monsterDamage;
    if (this.random() < this.config.stats.dodge) {
      this.numbers.show(this.x, this.y, '闪避', false, 0x9ddbcc);
      if (this.power('immortal_armor') && this.random() < this.power('immortal_armor'))
        this.drop('health', this.x, this.y);
      return;
    }
    let damage = mitigateDamage(raw * (STAGES[this.config.stage - 1]?.damageMultiplier ?? 1), {
      ...this.config.stats,
      armor: this.config.stats.armor * (this.buffs.has('warcry') ? 1.5 : 1),
    });
    if (this.power('aquila') && this.resource > this.config.stats.maxResource * 0.75) damage *= 0.5;
    if (this.shield > 0) {
      const absorbed = Math.min(damage, this.shield);
      this.shield -= absorbed;
      damage -= absorbed;
    }
    if (damage > 0) {
      const received = Math.min(this.hp, damage);
      this.report.damageTaken += received;
      this.report.damageBySource[source] = (this.report.damageBySource[source] ?? 0) + received;
      this.hp -= damage;
      this.lastDamage = this.elapsed;
      this.numbers.show(this.x, this.y, `−${Math.round(damage)}`, false, 0xef8b98);
      this.callbacks.onSound('hurt');
      this.shake = 4;
    }
    if (this.hp <= 0 && this.learned('final_service') && !this.buffs.has('final_service_cd')) {
      this.hp = this.config.stats.hp * 0.25 * this.rankScale('final_service');
      this.buffs.add('invulnerable', '灵魂庇护', 3);
      this.buffs.add('final_service_cd', '命匣冷却', 60);
    }
  }
  private updateShield(dt: number) {
    this.shieldTime = Math.max(0, this.shieldTime - dt);
    if (this.shieldTime > 0) return;
    this.shield = 0;
    if (this.shieldBurst) {
      const { skill, multiplier } = this.shieldBurst;
      this.shieldBurst = undefined;
      this.area(this.x, this.y, skill.radius, skill, multiplier);
      this.vfx.burst(this.x, this.y, ELEMENT_COLORS[skill.element], 18, true);
    }
  }
  private slowEnemy(e: Enemy, ratio: number, duration: number) {
    e.slowRatio = e.slow > 0 ? Math.max(e.slowRatio ?? 0.6, ratio) : ratio;
    e.slow = Math.max(e.slow, duration);
  }
  private freeze(e: Enemy, duration: number) {
    const seconds = duration + (this.power('froststring') ? 1 : 0);
    e.frozenUntil = Math.max(e.frozenUntil ?? 0, this.elapsed + seconds);
    e.stun = Math.max(e.stun, seconds);
    if (this.set('delsere', 4)) delete this.cooldowns.teleport;
  }
  private applyVulnerability(e: Enemy, key: string, value: number, duration: number) {
    e.vulnerabilities ??= {};
    e.vulnerabilities[key] = { value, expires: this.elapsed + duration };
    e.vulnerability = Object.values(e.vulnerabilities).reduce((sum, buff) => sum + buff.value, 0);
  }
  cast(id: string) {
    if (this.isCoopGuest) {
      if (!this.paused && !this.finished) this.queueCoopCommand(id);
      return;
    }
    if (this.paused || this.finished || !this.initialized || this.hp <= 0) return;
    const skill = this.skill(id);
    if (
      !skill ||
      skill.classId !== this.config.classId ||
      skill.kind === 'passive' ||
      !this.learned(id) ||
      this.cooldowns[id]
    )
      return;
    this.perform(skill, false);
  }
  private perform(skill: SkillDef, free: boolean, multiplier = 1) {
    skill = this.resolveSkill(skill);
    const cast: CastContext = { resourceGranted: false };
    const cost = this.getSkillCost(skill.id);
    const zero = free || cost === 0;
    if (!zero && this.resource < cost) return;
    if (!free && this.shadowCharges > 0 && ['basic', 'core', 'control'].includes(skill.kind)) {
      multiplier *= 1 + this.power('shadowfang');
      this.shadowCharges--;
      if (!this.shadowCharges) this.buffs.remove('shadowfang');
    }
    if (!free) {
      if (!zero) this.resource -= cost;
      let cd =
        skill.cooldown *
        (1 - (this.buffs.has('channeling') ? 0.8 : Math.min(0.75, this.config.stats.cooldown)));
      if (skill.id === 'vengeance') cd *= 1 - this.power('dawn');
      if (skill.effect === 'teleport') cd *= 1 - this.power('cosmic_strand');
      if (skill.effect === 'rain' && this.set('stormcaller', 2)) cd *= 0.4;
      if (skill.effect === 'archon' && this.set('vyr', 4)) cd *= 0.3;
      if (skill.effect === 'summon' && this.set('rathma', 2)) cd *= 0.3;
      this.cooldowns[skill.id] = Math.max(0.1, cd);
      const speed =
        this.config.stats.attackSpeed *
        (this.buffs.has('speed') ? 1.5 : 1) *
        (this.buffs.has('berserker') ? 1.5 : 1) *
        (this.buffs.has('wolf') ? 1.6 : 1) *
        (1 + this.buffs.stacks('frenzy') * 0.05) *
        (1 + (this.set('marauder', 4) ? this.buffs.stacks('barrage') * 0.08 : 0)) *
        (this.set('storm_wolf', 4) && skill.effect === 'claw' ? 1.8 : 1) *
        (this.set('trang_oul', 2) && skill.effect === 'scythe' ? 1.5 : 1) *
        (this.power('bulkathos') && this.buffs.has('whirlwind') ? 1 + this.power('bulkathos') : 1) *
        (this.power('oathkeeper') && skill.kind === 'basic' ? 1.5 : 1) *
        (1 + (this.power('berserker_charm') ? Math.min(15, this.attackStacks) * 0.03 : 0));
      if (['basic', 'core'].includes(skill.kind) && skill.cooldown <= 1)
        this.cooldowns[skill.id] = Math.max(0.06, this.cooldowns[skill.id] / speed);
      this.castTimer = Math.max(0.09, 0.38 / speed);
      this.attackStacks = Math.min(15, this.attackStacks + 1);
      this.attackCount++;
      this.report.casts++;
      if (skill.effect === 'charge') this.chargeWindow = this.elapsed + 4;
      if (skill.effect === 'bloodstep') this.bloodWindow = this.elapsed + 4;
    }
    const targets = this.enemies
      .filter((e) => e.hp > 0 && this.distance(e) < 600)
      .sort((a, b) => this.distance(a) - this.distance(b));
    const nearest = targets[0];
    const cluster = [...targets].sort(
      (a, b) =>
        targets.filter((e) => Math.hypot(e.x - b.x, e.y - b.y) < 120).length -
        targets.filter((e) => Math.hypot(e.x - a.x, e.y - a.y) < 120).length,
    )[0];
    const angle = nearest
      ? Math.atan2(nearest.y - this.y, nearest.x - this.x)
      : this.facing < 0
        ? Math.PI
        : 0;
    const tx = cluster?.x ?? this.x,
      ty = cluster?.y ?? this.y;
    const color = ELEMENT_COLORS[skill.element];
    if (!free) {
      this.hero.attack(skill, angle, this.castTimer);
      if (this.coopHost.coop || this.headless)
        this.lastCast = { sequence: this.attackCount, skillId: skill.id, angle, tx, ty };
    }
    this.vfx.signature(skill, this.x, this.y, angle, tx, ty);
    this.callbacks.onSound(skill.effect);
    if (!free && this.config.petId.includes('imp'))
      this.vfx.burst(this.x, this.y - 20, 0xff9b58, 5);
    if (!free && ['basic', 'core'].includes(skill.kind) && this.buffs.has('vengeance')) {
      for (let i = 0; i < 4; i++)
        this.projectiles.spawn(this.x, this.y - 20, (i * Math.PI) / 2, 0xcfbdf4, 'hunting_arrow', {
          homing: true,
          proc: false,
        });
    }
    if (!free && ['basic', 'core'].includes(skill.kind) && this.buffs.has('wolf')) {
      for (const [index, e] of targets.slice(0, this.power('stormheart') ? 3 : 1).entries()) {
        this.vfx.lightning(this.x, this.y - 25, e.x, e.y);
        this.hit(e, this.skill('storm_claw'), index === 0 ? 1 : this.power('stormheart'), false);
      }
    }
    if (this.buffs.has('archon') && skill.kind === 'basic') {
      const beam = { ...skill, element: 'arcane' as const, effect: 'archon_beam' };
      const beamTargets = targets.filter(
        (e) =>
          Math.abs(Math.sin(Math.atan2(e.y - this.y, e.x - this.x) - angle) * this.distance(e)) <
          35,
      );
      for (const e of beamTargets) this.hit(e, beam, multiplier * 2, true, false, cast);
      this.vfx.lightning(
        this.x,
        this.y - 25,
        this.x + Math.cos(angle) * 600,
        this.y + Math.sin(angle) * 600,
        0xd2aaff,
      );
      if (this.set('vyr', 2))
        for (const e of targets.slice(0, 3)) {
          this.hit(e, beam, multiplier, true, false, cast);
          this.vfx.lightning(tx, ty, e.x, e.y, 0xd2aaff);
        }
      return;
    }
    if (skill.kind === 'ultimate') {
      if (skill.effect === 'archon') this.laserStacks = 0;
      this.ultimateBonus = skill.multiplier;
      this.buffs.add('ultimate', skill.name, skill.duration || 15, '#' + color.toString(16));
      this.buffs.add(skill.effect, skill.name, skill.duration || 15);
      if (skill.effect === 'army')
        this.area(this.x, this.y, 420, { ...skill, multiplier: 12 }, multiplier);
      this.vfx.ring(this.x, this.y, color, 180);
      return;
    }
    if (skill.kind === 'movement') {
      const start = { x: this.x, y: this.y };
      const mx =
        this.movement.x +
        (this.dragMovement?.x ?? 0) +
        (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) -
        (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0);
      const my =
        this.movement.y +
        (this.dragMovement?.y ?? 0) +
        (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) -
        (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0);
      const movement =
        Math.hypot(mx, my) > 0.1
          ? Math.atan2(my, mx)
          : this.moving
            ? Math.atan2(this.movementDirection.y, this.movementDirection.x)
            : angle;
      this.vfx.ring(this.x, this.y, color, 45);
      if (skill.effect === 'shadowstep' && nearest && this.distance(nearest) <= skill.radius) {
        this.x = clampArena(nearest.x + Math.cos(angle) * 30);
        this.y = clampArena(nearest.y + Math.sin(angle) * 30);
        if (this.power('shadowfang')) {
          this.shadowCharges = 3;
          this.buffs.add('shadowfang', '暗影獠牙 · 3次攻击', 60);
        }
        this.hit(nearest, skill, multiplier, true, false, cast, true);
      } else {
        this.x = clampArena(this.x + Math.cos(movement) * skill.radius);
        this.y = clampArena(this.y + Math.sin(movement) * skill.radius);
      }
      if (skill.effect === 'teleport') {
        this.shield = this.config.stats.hp * (0.4 + (this.power('cosmic_strand') ? 0.2 : 0));
        this.shieldTime = skill.duration;
        this.shieldBurst = undefined;
      } else this.buffs.add('invulnerable', '无敌', skill.duration);
      const dx = this.x - start.x,
        dy = this.y - start.y;
      const crossed = this.enemies.filter((e) => {
        const u = Math.max(
          0,
          Math.min(1, ((e.x - start.x) * dx + (e.y - start.y) * dy) / (dx * dx + dy * dy || 1)),
        );
        return (
          e.hp > 0 && Math.hypot(e.x - start.x - dx * u, e.y - start.y - dy * u) < e.radius + 20
        );
      });
      if (skill.effect === 'bloodstep' && crossed.length)
        this.hp = Math.min(
          this.config.stats.hp,
          this.hp + this.config.stats.hp * 0.05 * this.rankScale(skill.id),
        );
      if (skill.effect === 'dodge') {
        this.resource = Math.min(this.config.stats.maxResource, this.resource + 40);
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 45));
        for (let i = 0; i <= steps; i++)
          this.makeZone(
            start.x + (dx * i) / steps,
            start.y + (dy * i) / steps,
            30,
            3,
            { ...skill, effect: 'caltrops' },
            0,
          );
      }
      if (skill.effect === 'charge')
        for (const e of crossed) {
          this.hit(e, skill, multiplier);
          if (!e.boss) {
            e.x += Math.cos(movement) * 45;
            e.y += Math.sin(movement) * 45;
          }
        }
      return;
    }
    if (skill.effect === 'shield' || skill.effect === 'warcry') {
      this.shieldBurst = skill.effect === 'shield' ? { skill, multiplier } : undefined;
      this.shieldTime =
        (skill.duration || 8) *
        (skill.effect === 'shield' && this.power('earthward')
          ? 2
          : skill.effect === 'warcry'
            ? 1 + this.power('pride')
            : 1);
      if (skill.effect === 'shield')
        this.shield =
          this.config.stats.hp * (0.45 + this.power('earthward')) * this.rankScale(skill.id);
      this.buffs.add(
        skill.effect === 'warcry' ? 'warcry' : 'shield',
        skill.name,
        (skill.duration || 8) *
          (skill.effect === 'shield' && this.power('earthward')
            ? 2
            : skill.effect === 'warcry'
              ? 1 + this.power('pride')
              : 1),
      );
      if (skill.effect === 'warcry')
        for (const e of targets) {
          if (this.distance(e) < skill.radius)
            this.applyVulnerability(e, 'warcry', 0.35 * this.rankScale(skill.id), this.shieldTime);
        }
      if (this.set('immortal_thorns', 4) && skill.effect === 'warcry')
        for (const enemy of targets)
          if (this.distance(enemy) < 420 + enemy.radius) this.hitThorns(enemy, skill);
      this.vfx.ring(this.x, this.y, color, 100);
      return;
    }
    if (['rain', 'meteor', 'blackhole', 'vines', 'whirlwind'].includes(skill.effect)) {
      const centered = skill.effect === 'whirlwind';
      let radius = skill.radius || 110;
      if (skill.effect === 'rain' && this.set('stormcaller', 4)) radius *= 1.5;
      if (centered && this.set('wasteland', 2)) radius *= 1.4;
      if (centered && this.learned('hurricane')) radius *= 1 + 0.25 * this.rankScale('hurricane');
      if (skill.effect === 'vines' && this.set('wild_vines', 2)) radius = 420;
      const duration =
        (skill.duration || 3) * (skill.effect === 'blackhole' && this.set('vyr', 2) ? 2 : 1);
      this.makeZone(
        centered ? this.x : tx,
        centered ? this.y : ty,
        radius,
        duration,
        skill,
        multiplier,
      );
      if (centered) this.buffs.add('whirlwind', '旋风斩', duration);
      if (skill.effect === 'meteor') {
        if (this.learned('meteor_shower'))
          for (let j = 0; j < 5; j++) {
            const mx = tx + (this.random() - 0.5) * 220,
              my = ty + (this.random() - 0.5) * 220;
            this.vfx.meteor(mx, my, color, radius * 0.65);
            this.area(mx, my, radius * 0.65, skill, multiplier * 0.45);
          }
        else this.vfx.meteor(tx, ty, color, radius);
        if (!this.learned('meteor_shower')) this.area(tx, ty, radius, skill, multiplier);
        if (this.set('tal_rasha', 4))
          for (let i = 0; i < 3; i++) {
            const x = tx + Math.cos((i * Math.PI * 2) / 3) * 32,
              y = ty + Math.sin((i * Math.PI * 2) / 3) * 32;
            this.vfx.meteor(x, y, color, radius);
            this.area(x, y, radius, skill, multiplier);
          }
      }
      if (skill.effect === 'rain') this.vfx.ring(tx, ty, color, radius);
      return;
    }
    if (skill.effect === 'summon') {
      for (const summon of this.summons) {
        if ((this.summonStates.get(summon)?.hp ?? 0) <= 0) continue;
        this.explode(
          summon.x,
          summon.y,
          skill.radius * (this.set('rathma', 4) ? 2 : 1),
          skill,
          multiplier,
          false,
        );
        this.defeatSummon(summon);
      }
      this.buffs.add('summon_fury', '骸骨狂热', skill.duration);
      return;
    }
    if (skill.effect === 'nova') {
      this.explode(this.x, this.y, skill.radius, skill, multiplier);
      return;
    }
    if (['pull', 'curse', 'raven'].includes(skill.effect)) {
      const radius = skill.radius || 180;
      for (const e of targets.filter((e) => this.distance(e) < radius)) {
        if (skill.effect === 'pull') {
          e.x = this.x + (e.x - this.x) * 0.25;
          e.y = this.y + (e.y - this.y) * 0.25;
          if (skill.id === 'iron_hook') e.stun = Math.max(e.stun, skill.duration);
          if (skill.id === 'hurricane_break')
            e.armorReduction = { value: 0.35, expires: this.elapsed + skill.duration };
        }
        if (skill.effect === 'curse') {
          e.curse = skill.duration;
          this.slowEnemy(e, 0.6, skill.duration);
          if (!e.boss && e.hp / e.maxHp < 0.15) {
            e.hp = 0;
            this.kill(e);
          }
        }
        if (skill.effect === 'raven') {
          this.applyVulnerability(
            e,
            'raven',
            0.3 * this.rankScale(skill.id) + this.power('ravenwing'),
            6,
          );
          e.stun = Math.max(e.stun, 1.5);
        }
        this.hit(e, skill, multiplier);
      }
      this.vfx.ring(this.x, this.y, color, radius);
      return;
    }
    if (['hammer', 'bash', 'frenzy', 'scythe', 'claw', 'spike', 'siphon'].includes(skill.effect)) {
      let radius = skill.radius || 90;
      if (skill.effect === 'claw' && this.set('storm_wolf', 4))
        radius = this.skill('thunder_wolf')!.radius;
      if (skill.effect === 'claw' && this.power('moonfang')) radius *= 1.3;
      if (skill.effect === 'hammer') radius *= 1 + this.buffs.stacks('earthbreaker') * 0.08;
      if (skill.effect === 'bash' && this.learned('seismic_bash')) {
        radius *= 1.3;
        for (const e of targets) if (this.distance(e) < radius) e.stun = Math.max(e.stun, 1);
      }
      if (skill.effect === 'siphon') {
        const drained = targets
          .filter((e) => this.distance(e) < radius)
          .slice(0, this.learned('blood_drain') ? 3 : 1);
        for (const e of drained) this.hit(e, skill, multiplier, true, false, cast);
        if (drained.length)
          this.hp = Math.min(
            this.config.stats.hp,
            this.hp +
              this.config.stats.hp *
                (this.learned('blood_drain') ? 0.04 * this.rankScale('blood_drain') : 0.02) *
                (this.power('funerary_pick') ? 2 : 1),
          );
      } else {
        for (let i = 0; i < (skill.effect === 'claw' ? 3 : 1); i++)
          this.area(this.x, this.y, radius, skill, multiplier, cast);
      }
      this.vfx.slash(this.x, this.y, angle, color, radius);
      if (skill.effect === 'bash')
        for (const e of targets)
          if (!e.boss && this.distance(e) < radius + e.radius) {
            e.x += Math.cos(angle) * 35;
            e.y += Math.sin(angle) * 35;
          }
      if (skill.effect === 'scythe' && this.set('trang_oul', 2)) {
        for (const offset of [-0.3, 0.3])
          this.projectiles.spawn(this.x, this.y, angle + offset, color, skill.id, {
            pierce: 25,
            multiplier: 0.5 * multiplier,
            proc: false,
          });
      }
      if (skill.effect === 'spike' && this.learned('bone_splinters'))
        for (let j = 0; j < 3; j++)
          this.projectiles.spawn(this.x, this.y, angle + (j - 1) * 0.2, color, 'bone_splinters', {
            pierce: 10 + (this.power('bone_relic') ? 2 : 0),
            proc: false,
            multiplier: skill.multiplier,
          });
      if (skill.effect === 'claw' && this.learned('thunder_claw'))
        for (const e of targets.slice(0, 3)) {
          this.vfx.lightning(this.x, this.y - 20, e.x, e.y);
          this.hit(e, this.skill('thunder_claw'), 1, false);
        }
      if (skill.effect === 'hammer') {
        this.shake = 7;
        if (this.power('judgment') && targets.filter((e) => this.distance(e) < radius).length <= 3)
          this.resource = Math.min(this.config.stats.maxResource, this.resource + cost);
        if (this.power('gavel')) {
          this.area(
            this.x + Math.cos(angle) * 90,
            this.y + Math.sin(angle) * 90,
            radius,
            { ...skill, multiplier: this.power('gavel') },
            multiplier,
          );
          for (const e of targets)
            if (
              !e.boss &&
              Math.hypot(e.x - this.x - Math.cos(angle) * 90, e.y - this.y - Math.sin(angle) * 90) <
                radius + e.radius
            ) {
              e.x += Math.cos(angle) * 45;
              e.y += Math.sin(angle) * 45;
            }
        }
      }
      if (skill.effect === 'frenzy')
        this.buffs.add(
          'frenzy',
          '狂乱',
          skill.duration,
          undefined,
          this.learned('frenzy_flurry') ? 10 : 5,
        );
      if (skill.effect === 'scythe' && this.power('corroded_fang'))
        for (const e of this.enemies)
          if (e.hp > 0 && e.poison > 0)
            this.hit(
              e,
              e.poisonSkill,
              e.poison * 0.4 * Math.max(1, e.poisonStacks) * this.power('corroded_fang'),
              false,
              true,
            );
      return;
    }
    if (skill.effect === 'chain') {
      let previous = { x: this.x, y: this.y };
      for (const e of targets.slice(
        0,
        3 + (this.power('serpent_spark') ? 2 : 0) + (this.learned('chain_lightning') ? 3 : 0),
      )) {
        this.vfx.lightning(previous.x, previous.y, e.x, e.y);
        this.hit(e, skill, multiplier, true, false, cast);
        previous = e;
      }
      return;
    }
    if (skill.effect === 'fan') {
      multiplier *= 1 + (this.power('greenstone') ? this.fanCharge * this.power('greenstone') : 0);
      const count = this.set('shadow_blades', 4) ? 32 : 16;
      for (let i = 0; i < count; i++)
        this.projectile(skill, (i / count) * Math.PI * 2, multiplier, {
          returning: this.set('shadow_blades', 4),
          pierce: this.set('shadow_blades', 4) ? 99 : 4,
        });
      this.fanCharge = 0;
      return;
    }
    const count =
      skill.effect === 'multishot'
        ? 6 +
          (this.set('marauder', 2) ? 4 : 0) +
          (this.power('ninth_satchel') ? 2 : 0) +
          (this.learned('fan_barrage') ? 6 : 0)
        : skill.effect === 'boomerang' && this.learned('return_blade')
          ? 3
          : skill.id === 'magic_missile'
            ? 3
            : this.learned('split_arrow') && skill.id === 'hunting_arrow'
              ? 3
              : 1;
    if (skill.effect === 'multishot') this.buffs.add('barrage', '狂暴弹幕', 6, undefined, 10);
    for (let i = 0; i < count; i++) {
      const extra =
        skill.effect === 'boomerang' && i > 0 && this.learned('return_blade')
          ? 0.6 * this.rankScale('return_blade')
          : skill.effect === 'multishot' && this.power('ninth_satchel') && i >= count - 2
            ? this.power('ninth_satchel')
            : 1;
      this.projectile(skill, angle + (i - (count - 1) / 2) * 0.075, multiplier * extra, {
        cast,
        homing: skill.effect === 'homing',
        pierce:
          skill.effect === 'boomerang' ||
          skill.effect === 'spear' ||
          skill.effect === 'orb' ||
          this.set('marauder', 2) ||
          (skill.id === 'hunting_arrow' && this.learned('frost_pierce')) ||
          (skill.id === 'rapid_fire' && this.learned('laser_arrow'))
            ? 25
            : 0,
        returning: skill.effect === 'boomerang',
        scale: skill.effect === 'orb' ? 2.2 : 1,
        life: skill.effect === 'orb' ? (this.set('delsere', 2) ? 3 : 1.5) : 1.3,
        ...(skill.effect === 'orb' ? { vx: Math.cos(angle) * 150, vy: Math.sin(angle) * 150 } : {}),
      });
    }
  }
  private resolveSkill(input: SkillDef): SkillDef {
    if ((input as SkillDef & { resolved?: boolean }).resolved) return input;
    const skill = { ...input, resolved: true };
    skill.multiplier *= this.rankScale(skill.id);
    if (skill.id === 'hunting_arrow') {
      if (this.learned('split_arrow')) skill.multiplier *= 0.65 * this.rankScale('split_arrow');
      if (this.learned('frost_pierce')) skill.element = 'ice';
    }
    if (skill.id === 'rapid_fire') {
      if (this.learned('fan_barrage')) skill.multiplier *= 0.75 * this.rankScale('fan_barrage');
      if (this.learned('laser_arrow')) {
        skill.multiplier *= 1 + 0.3 * this.rankScale('laser_arrow');
        skill.element = 'arcane';
      }
    }
    if (skill.id === 'bash' && this.learned('seismic_bash'))
      skill.multiplier *= 1 + 0.4 * this.rankScale('seismic_bash');
    if (skill.id === 'whirlwind' && this.learned('lava_whirl')) skill.element = 'fire';
    if (skill.id === 'meteor' && this.learned('frost_meteor')) {
      skill.element = 'ice';
      skill.multiplier *= 1 + 0.1 * this.rankScale('frost_meteor');
    }
    return skill;
  }
  private rankScale(id: string) {
    return 1 + Math.max(0, (this.config.skills[id] ?? 1) - 1) * 0.1;
  }
  private projectile(
    skill: SkillDef,
    angle: number,
    multiplier: number,
    options: Record<string, unknown> = {},
  ) {
    this.projectiles.spawn(this.x, this.y - 20, angle, ELEMENT_COLORS[skill.element], skill.id, {
      ...options,
      scale: (options.scale as number) ?? 1,
      multiplier,
    });
  }
  private area(
    x: number,
    y: number,
    radius: number,
    skill: SkillDef,
    multiplier = 1,
    cast?: CastContext,
  ) {
    for (const e of this.enemies)
      if (e.hp > 0 && Math.hypot(e.x - x, e.y - y) < radius + e.radius)
        this.hit(e, skill, multiplier * (1 + this.config.stats.areaDamage), true, false, cast);
  }
  private hit(
    e: Enemy,
    skill: SkillDef | undefined,
    multiplier = 1,
    canProc = true,
    dot = false,
    cast?: CastContext,
    forceCrit = false,
  ) {
    if (!skill || e.hp <= 0) return;
    skill = this.resolveSkill(skill);
    const stats = { ...this.config.stats, independent: [...this.config.stats.independent] };
    const frozen = (e.frozenUntil ?? 0) > this.elapsed;
    let chance = stats.critChance;
    if (this.buffs.has('berserker')) chance += 0.3;
    if (skill.effect === 'hammer') chance += Math.floor(this.resource / 5) * 0.01;
    if (this.learned('prodigy') && this.resource > stats.maxResource * 0.9) chance += 0.1;
    if (this.power('winterglass') && frozen) chance += this.power('winterglass');
    const crit =
      !dot &&
      (skill.effect !== 'thorns' || this.set('immortal_thorns', 4)) &&
      (forceCrit || this.random() < chance);
    const independent: number[] = [];
    if (this.buffs.has('ultimate')) independent.push(this.ultimateBonus);
    if (this.buffs.has('power')) independent.push(2);
    if (this.power('aquila') && this.resource > stats.maxResource * 0.75)
      independent.push(this.power('aquila'));
    if (this.power('squirt') && (this.shield > 0 || this.elapsed - this.lastDamage >= 3))
      independent.push(this.power('squirt'));
    if (this.power('olda')) independent.push(this.buffs.stacks('olda') * this.power('olda'));
    if (this.power('berserker_charm'))
      stats.critDamage += this.attackStacks * this.power('berserker_charm');
    for (const set of SETS) {
      if (!this.set(set.id, 4)) continue;
      let applies = set.skillId === skill.id;
      if (set.id === 'frost_hunter') applies = e.slow > 0 || frozen;
      if (set.id === 'wild_vines') applies = e.poison > 0;
      if (set.id === 'inarius') applies = this.distance(e) < 150;
      if (set.id === 'immortal_thorns') applies = skill.effect === 'thorns';
      if (set.id === 'marauder' && skill.effect === 'multishot') {
        independent.push(this.buffs.stacks('barrage') * 0.9);
        continue;
      }
      if (set.id === 'earthbreaker' && skill.effect === 'hammer') {
        independent.push(this.buffs.stacks('earthbreaker') * 1.2);
        continue;
      }
      if (set.id === 'vyr') applies = this.buffs.has('archon') && skill.effect === 'archon_beam';
      if (set.id === 'trang_oul') applies = skill.element === 'poison';
      if (set.id === 'delsere') applies = ['orb', 'nova'].includes(skill.effect);
      if (applies)
        independent.push(set.id === 'vyr' ? Math.min(9, this.laserStacks * 0.15) : set.multiplier);
    }
    if (
      this.power('dead_mans') &&
      e.hp / e.maxHp < 0.75 &&
      ['rain', 'multishot'].includes(skill.effect)
    )
      independent.push(this.power('dead_mans'));
    if (this.power('froststring') && skill.element === 'ice')
      independent.push(this.power('froststring'));
    if (
      this.power('judgment') &&
      skill.effect === 'hammer' &&
      this.enemies.filter((n) => n.hp > 0 && this.distance(n) < skill.radius).length <= 3
    )
      independent.push(this.power('judgment'));
    if (this.power('oathkeeper') && skill.kind === 'basic')
      independent.push(this.power('oathkeeper'));
    if (this.power('grand_vizier') && skill.effect === 'meteor')
      independent.push(this.power('grand_vizier'));
    if (this.power('deathwish') && this.buffs.has('archon'))
      independent.push(this.power('deathwish'));
    if (this.power('serpent_spark') && skill.element === 'lightning')
      independent.push(this.power('serpent_spark'));
    if (this.power('jesseth') && skill.effect === 'summon') independent.push(this.power('jesseth'));
    if (this.power('nayr') && skill.element === 'poison') independent.push(this.power('nayr'));
    if (this.power('bone_relic') && skill.effect === 'spear')
      independent.push(this.power('bone_relic'));
    if (this.power('bloodtide') && ['nova', 'army'].includes(skill.effect))
      independent.push(
        Math.min(10, this.enemies.filter((n) => n.hp > 0 && this.distance(n) < 150).length) *
          this.power('bloodtide'),
      );
    if (this.power('funerary_pick') && skill.effect === 'siphon')
      independent.push(this.power('funerary_pick'));
    if (this.power('venom_source') && skill.effect === 'vines')
      stats.critDamage += this.power('venom_source');
    if (this.power('moonfang') && skill.effect === 'claw') independent.push(this.power('moonfang'));
    if (this.learned('steady_aim'))
      independent.push(
        Math.min(0.45, (this.distance(e) / 420) * 0.45) * this.rankScale('steady_aim'),
      );
    if (this.learned('ballistics') && ['rain', 'homing'].includes(skill.effect))
      independent.push(0.5 * this.rankScale('ballistics'));
    if (this.learned('ruthless') && e.hp / e.maxHp < 0.3)
      independent.push(0.4 * this.rankScale('ruthless'));
    if (this.learned('predator') && (e.slow > 0 || e.stun > 0))
      independent.push(0.3 * this.rankScale('predator'));
    if (this.learned('toxic_blood') && (skill.element === 'poison' || skill.effect === 'fan'))
      independent.push(0.35 * this.rankScale('toxic_blood'));
    if (this.learned('spreading_malediction'))
      independent.push(
        Math.min(10, this.enemies.filter((n) => (n.curse ?? 0) > 0 && n.hp > 0).length) * 0.08,
      );
    if (this.learned('elemental_exposure')) {
      e.elements ??= new Set();
      e.elements.add(skill.element);
      e.exposure = 5;
      this.applyVulnerability(
        e,
        'elements',
        Math.min(4, e.elements.size) * 0.1 * this.rankScale('elemental_exposure'),
        5,
      );
    }
    if (this.power('winterglass') && skill.element === 'ice') independent.push(0.3);
    if (skill.effect === 'chain' && this.learned('chain_lightning')) {
      if (e.chainHit) independent.push(0.25 * this.rankScale('chain_lightning'));
      e.chainHit = true;
    }
    let damage = calculateDamage({
      stats,
      multiplier: skill.multiplier * multiplier,
      elite: e.elite || e.boss || e.minion,
      crit,
      independent,
      vulnerability: e.vulnerability,
      armor:
        ((e.boss ? 35 : e.elite ? 20 : 5) + this.config.stage * 0.2) *
        (e.armorReduction && e.armorReduction.expires > this.elapsed
          ? 1 - e.armorReduction.value
          : 1),
    });
    if (e.shield > 0) {
      const absorbed = Math.min(e.shield, damage);
      e.shield -= absorbed;
      damage -= absorbed;
    }
    e.hp -= damage;
    const dealt = Math.max(0, Math.min(e.hp + damage, damage));
    this.report.damageDealt += dealt;
    this.report.damageBySkill[skill.id] = (this.report.damageBySkill[skill.id] ?? 0) + dealt;
    if (crit) this.report.criticalHits++;
    e.view.hit();
    this.hp = Math.min(stats.hp, this.hp + stats.lifeOnHit * (dot ? 0.1 : 1));
    if (!dot) this.numbers.show(e.x, e.y, damage, crit);
    if (crit) {
      this.callbacks.onSound('critical');
      if (!e.boss) {
        const distance = Math.max(1, this.distance(e));
        e.x += ((e.x - this.x) / distance) * 4;
        e.y += ((e.y - this.y) / distance) * 4;
      }
      this.shake = Math.max(this.shake, 2.5);
      if (this.random() < 0.25) this.vfx.burst(e.x, e.y, ELEMENT_COLORS[skill.element], 5);
    }
    if (this.buffs.has('archon') && skill.effect === 'archon_beam')
      this.laserStacks = Math.min(60, this.laserStacks + 1);
    if (!dot && canProc && skill.kind === 'basic' && !cast?.resourceGranted) {
      this.resource = Math.min(
        stats.maxResource,
        this.resource +
          (['explosive_arrow', 'magic_missile', 'bone_spike', 'flying_blade'].includes(skill.id)
            ? 15
            : skill.effect === 'bash'
              ? 18
              : 12) +
          (this.learned('prodigy') ? 8 * this.rankScale('prodigy') : 0),
      );
      if (cast) cast.resourceGranted = true;
    }
    if (skill.effect === 'rain' && this.set('stormcaller', 2))
      this.resource = Math.min(stats.maxResource, this.resource + 3);
    if (this.learned('bloodthirst') && skill.cost > 0 && !dot)
      this.hp = Math.min(stats.hp, this.hp + stats.hp * 0.02 * this.rankScale('bloodthirst'));
    if (this.learned('frenzy_flurry') && this.buffs.has('frenzy') && !dot)
      this.hp = Math.min(
        stats.hp,
        this.hp + damage * 0.01 * this.buffs.stacks('frenzy') * this.rankScale('frenzy_flurry'),
      );
    if (crit && this.learned('stormborn') && skill.element === 'lightning')
      this.resource = Math.min(stats.maxResource, this.resource + 8);
    if (skill.element === 'ice') {
      this.slowEnemy(
        e,
        skill.id === 'hunting_arrow' ? 0.3 : 0.4,
        skill.id === 'hunting_arrow' || skill.id === 'elemental_arrow' ? 2 : 3,
      );
      if (skill.id === 'meteor' && this.learned('frost_meteor')) this.freeze(e, 2);
      if (this.set('frost_hunter', 2) && canProc) {
        this.vfx.ring(e.x, e.y, 0xa3def4, 40);
        for (const other of this.enemies)
          if (other.hp > 0 && Math.hypot(other.x - e.x, other.y - e.y) < 40)
            this.hit(other, skill, 0.2, false);
      }
    }
    if (!dot && skill.effect === 'fan') {
      e.bleed = this.learned('blood_fan') ? 5 : 3;
      e.bleedOwner = this;
      e.bleedSkill = { ...skill, multiplier: 0.6 };
    }
    if (!dot && skill.effect === 'whirlwind' && this.power('lamentation')) {
      e.bleed = 3;
      e.bleedOwner = this;
      e.bleedSkill = { ...skill, multiplier: this.power('lamentation') };
    }
    if (skill.element === 'poison' && !dot) {
      if (e.poison <= 0) e.poisonStacks = 0;
      e.poison = (skill.effect === 'scythe' ? skill.duration : 4) + (this.power('nayr') ? 2 : 0);
      e.poisonOwner = this;
      e.poisonSkill =
        skill.effect === 'scythe'
          ? {
              ...skill,
              multiplier:
                (0.35 / 0.4) *
                this.rankScale(skill.id) *
                (this.learned('poison_scythe') ? 1 + 0.5 * this.rankScale('poison_scythe') : 1),
            }
          : skill;
      e.poisonStacks = Math.min(
        5,
        e.poisonStacks +
          (skill.effect === 'scythe' && this.set('trang_oul', 4) && this.elapsed < this.bloodWindow
            ? 2
            : 1),
      );
      if (e.poisonStacks === 5 && this.set('trang_oul', 4) && canProc) {
        e.poisonStacks = 0;
        for (const other of this.enemies)
          if (other.hp > 0 && Math.hypot(other.x - e.x, other.y - e.y) < 95 + other.radius)
            this.hit(other, { ...skill, effect: 'plague_nova' }, 2, false);
        this.vfx.ring(e.x, e.y, 0xb9d97b, 95);
      }
    }
    if (e.elite || e.boss) {
      const quarter = Math.max(0, Math.ceil((e.hp / e.maxHp) * 4));
      for (let i = quarter; i < e.lastQuarter; i++)
        this.drop('health', e.x + (this.random() - 0.5) * 25, e.y);
      e.lastQuarter = quarter;
    }
    if (canProc && !dot) {
      if (skill.kind === 'core' && this.power('etched_sigil') && this.elapsed >= this.sigilReady) {
        this.sigilReady = this.elapsed + 6;
        const blackHole = this.skill('black_hole');
        if (blackHole) this.perform(blackHole, true, this.power('etched_sigil'));
      }
      if (this.power('immortal_armor') && this.random() < this.power('immortal_armor'))
        this.drop('health', this.x, this.y);
      if (this.power('zodiac') && skill.cost > 0) {
        const cds = Object.keys(this.cooldowns);
        const key = cds[Math.floor(this.random() * cds.length)];
        if (key) this.cooldowns[key] = Math.max(0, this.cooldowns[key] - this.power('zodiac'));
      }
      if (crit && this.learned('night_hunt')) {
        this.resource = Math.min(
          stats.maxResource,
          this.resource + 5 * this.rankScale('night_hunt'),
        );
        for (const key of Object.keys(this.cooldowns))
          this.cooldowns[key] = Math.max(
            0,
            this.cooldowns[key] - 0.3 * this.rankScale('night_hunt'),
          );
      }
      if (this.set('earthbreaker', 2) && skill.effect === 'hammer' && this.random() < 0.35)
        this.drop('health', e.x, e.y);
      if (this.set('immortal_thorns', 2)) {
        this.hitThorns(e, skill);
      }
      if (this.power('windforce') && this.random() < this.power('windforce')) {
        e.x += (e.x - this.x) * 0.08;
        e.y += (e.y - this.y) * 0.08;
        e.stun = Math.max(e.stun, 1);
      }
    }
    if (e.hp <= 0) this.kill(e);
  }
  private hitThorns(
    enemy: Enemy,
    source: SkillDef,
    base = this.config.stats.armor * 10 + this.config.stats.thorns,
  ) {
    this.hit(
      enemy,
      {
        ...source,
        id: 'thorns',
        effect: 'thorns',
        kind: 'passive',
        element: 'physical',
        multiplier: 1,
      },
      (base / Math.max(1, this.config.stats.attack)) * (1 + this.power('shield_of_ancients')),
      false,
    );
  }
  private kill(e: Enemy) {
    if (e.deadTime !== undefined) return;
    e.deadTime = 0.4;
    this.kills++;
    if (this.config.challenge?.id === 'pursuit' && e.elite && !e.minion) this.objectiveProgress++;
    this.combo++;
    this.comboTimer = 3;
    this.gold += 3;
    this.vfx.burst(e.x, e.y, 0x899d84, 7);
    if (this.config.classId === 'necromancer')
      this.resource = Math.min(
        this.config.stats.maxResource,
        this.resource + 10 + (this.learned('overwhelming_essence') ? 6 : 0),
      );
    if (e.poison > 0 && this.learned('toxic_blood'))
      this.hp = Math.min(this.config.stats.hp, this.hp + this.config.stats.hp * 0.03);
    if (!e.boss && !e.elite && !e.goblin && !this.config.training)
      this.progress = Math.min(100, this.progress + 0.8 + this.random() * 0.7);
    if (this.random() < 0.25) this.drop('health', e.x, e.y);
    if (e.elite) for (let i = 0; i < 3; i++) this.drop('progress', e.x + (i - 1) * 24, e.y + 8, 12);
    this.drop('gold', e.x + 14, e.y, 4);
    if (e.goblin) {
      this.shards += 150;
      for (let i = 0; i < 6; i++)
        this.dropItem(
          e.x + (i - 3) * 20,
          e.y,
          generateLoot(this.config.classId, this.config.stage, {
            rng: this.random,
            source: 'goblin',
            ownedSetPieces: this.config.ownedSetPieces,
          }),
        );
    } else if (
      !this.config.training &&
      (e.elite || this.random() < 0.035 * (1 + this.config.stats.luck))
    )
      this.dropItem(
        e.x,
        e.y,
        generateLoot(this.config.classId, this.config.stage, { rng: this.random }),
      );
    if ((this.power('plaguebranch') || this.learned('poison_scythe')) && e.poison > 0)
      for (const n of this.enemies)
        if (
          n.hp > 0 &&
          Math.hypot(n.x - e.x, n.y - e.y) <
            (this.learned('poison_scythe') ? this.skill('poison_scythe')!.radius : 200)
        ) {
          n.poison = Math.max(n.poison, e.poison);
          n.poisonSkill = e.poisonSkill;
          n.poisonOwner = e.poisonOwner;
          n.poisonStacks = Math.max(n.poisonStacks, 2);
          if (this.power('plaguebranch'))
            this.hit(
              n,
              { ...(e.poisonSkill ?? this.skills[0]), multiplier: this.power('plaguebranch') },
              1,
              false,
              true,
            );
        }
    if (this.set('wild_vines', 4) && e.poison > 0)
      for (const n of this.enemies)
        if (n.hp > 0) {
          n.poison = 4;
          n.poisonSkill = e.poisonSkill;
          n.poisonOwner = e.poisonOwner;
          n.poisonStacks = Math.max(n.poisonStacks, 1);
        }
    if (e.boss && this.coopHost.coop) {
      const host = this.coopHost;
      host.shards += 100 + this.config.stage * 12;
      host.gold += 400 + this.config.stage * 40;
      for (const actor of host.coopActors.values()) {
        const owned = [...Object.values(actor.config.equipment), ...actor.earned]
          .filter(Boolean)
          .map((i) => `${i!.setId}:${i!.slot}`)
          .concat(actor.config.ownedSetPieces ?? []);
        for (let i = 0; i < 4; i++) {
          const item = generateLoot(actor.config.classId, actor.config.stage, {
            rng: host.random,
            source: 'boss',
            ownedSetPieces: owned,
          });
          actor.earned.push(item);
          if (item.setId) owned.push(`${item.setId}:${item.slot}`);
        }
      }
      host.finishCoop(true);
      return;
    }
    if (e.boss) {
      this.shards += 100 + this.config.stage * 12;
      this.gold += 400 + this.config.stage * 40;
      const owned = [
        ...Object.values(this.config.equipment),
        ...this.earned,
        ...this.orbs.map((o) => o.item),
      ]
        .filter(Boolean)
        .map((i) => `${i!.setId}:${i!.slot}`)
        .concat(this.config.ownedSetPieces ?? []);
      for (let i = 0; i < 4; i++) {
        const item = generateLoot(this.config.classId, this.config.stage, {
          rng: this.random,
          source: 'boss',
          ownedSetPieces: owned,
        });
        this.earned.push(item);
        if (item.setId) owned.push(`${item.setId}:${item.slot}`);
      }
      for (const orb of this.orbs) if (orb.item) this.earned.push(orb.item);
      this.finish(true);
    }
  }
  private explode(
    x: number,
    y: number,
    radius: number,
    skill: SkillDef,
    multiplier: number,
    repeat = true,
    cast?: CastContext,
  ) {
    if (skill.effect === 'nova')
      for (const e of this.enemies)
        if (e.hp > 0 && Math.hypot(e.x - x, e.y - y) < radius + e.radius)
          this.freeze(e, skill.duration);
    this.area(x, y, radius, skill, multiplier, cast);
    this.vfx.burst(x, y, ELEMENT_COLORS[skill.element], 18, true);
    this.vfx.ring(x, y, ELEMENT_COLORS[skill.element], radius);
    if (repeat && ['orb', 'nova'].includes(skill.effect) && this.power('endless_depths'))
      this.makeZone(
        x,
        y,
        radius,
        0.4,
        skill,
        multiplier * this.power('endless_depths'),
        [0.2, 0.4],
        cast,
      );
  }
  private makeZone(
    x: number,
    y: number,
    radius: number,
    life: number,
    skill: SkillDef,
    multiplier = 1,
    pulseTimes?: number[],
    cast?: CastContext,
  ) {
    if (this.zones.length > 35) return;
    const view = new Graphics();
    const texture = getZoneTexture(skill.id, skill.element === 'ice');
    const art = texture && !pulseTimes ? new Sprite(texture) : undefined;
    if (art) {
      art.anchor.set(0.5);
      art.position.set(x, y);
      art.width = Math.min(270, radius * 2);
      art.height = art.width * 0.68;
      art.alpha = 0.4;
      this.floorLayer.addChild(art);
    }
    this.floorLayer.addChild(view);
    this.zones.push({
      x,
      y,
      radius,
      life,
      age: 0,
      tick: 0,
      skill,
      view,
      pull: skill.effect === 'blackhole',
      art,
      multiplier,
      pulseTimes,
      cast,
    });
  }
  private updateZones(dt: number) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.age += dt;
      if (z.pulseTimes) {
        while (z.pulseTimes.length && z.age >= z.pulseTimes[0]) {
          z.pulseTimes.shift();
          this.explode(z.x, z.y, z.radius, z.skill, z.multiplier, false, z.cast);
        }
        if (!z.pulseTimes.length) {
          z.view.destroy();
          this.zones.splice(i, 1);
        }
        continue;
      }
      if (
        z.skill.effect === 'vines' &&
        this.set('wild_vines', 2) &&
        Math.floor(z.age) > Math.floor(z.age - dt)
      ) {
        this.vfx.burst(z.x, z.y, 0xb4d378, 12, true);
        this.area(z.x, z.y, z.radius, z.skill, 0.35);
      }
      z.tick -= dt;
      const color = ELEMENT_COLORS[z.skill.element];
      if (z.skill.effect === 'whirlwind') {
        z.x = this.x;
        z.y = this.y;
      }
      if (!this.headless) {
        z.view.clear();
        if (z.art) {
          z.art.position.set(z.x, z.y);
          z.art.alpha = (0.4 + 0.12 * Math.sin(z.age * 4)) * Math.min(1, (z.life - z.age) * 4);
        }
        pixelEllipse(z.view, z.x, z.y, z.radius, z.radius * 0.68, color, 6, 0.08);
        pixelEllipse(z.view, z.x, z.y, z.radius, z.radius * 0.68, color, 6, 0.4, true);
        for (let j = 0; j < 5; j++) {
          const a = this.elapsed * 2 + j * Math.PI * 0.4;
          pixelLine(
            z.view,
            z.x + Math.cos(a) * z.radius * 0.7,
            z.y + Math.sin(a) * z.radius * 0.5,
            z.x + Math.cos(a + 0.4) * z.radius * 0.9,
            z.y + Math.sin(a + 0.4) * z.radius * 0.6,
            color,
            3,
            0.7,
          );
        }
      }
      if (z.pull)
        for (const e of this.enemies)
          if (e.hp > 0 && Math.hypot(e.x - z.x, e.y - z.y) < z.radius * 1.6) {
            e.x += (z.x - e.x) * dt * 1.4;
            e.y += (z.y - e.y) * dt * 1.4;
          }
      if (z.tick <= 0) {
        z.tick = 0.4;
        if (z.skill.effect === 'caltrops') {
          for (const e of this.enemies)
            if (e.hp > 0 && Math.hypot(e.x - z.x, e.y - z.y) < z.radius + e.radius)
              this.slowEnemy(e, 0.6, 3);
        } else
          this.area(
            z.x,
            z.y,
            z.radius,
            z.skill,
            (z.multiplier * 0.4) /
              (['rain', 'blackhole', 'vines', 'meteor'].includes(z.skill.effect) ? z.life : 1),
          );
        if (z.skill.effect === 'rain') {
          for (let j = 0; j < 5; j++) {
            const px = z.x + (this.random() - 0.5) * z.radius,
              py = z.y + (this.random() - 0.5) * z.radius;
            this.vfx.lightning(px - 20, py - 75, px, py, color);
          }
          if (this.set('stormcaller', 4)) {
            const e = this.enemies.find(
              (e) => e.hp > 0 && Math.hypot(e.x - z.x, e.y - z.y) < z.radius,
            );
            if (e) {
              this.vfx.lightning(e.x, e.y - 180, e.x, e.y);
              this.hit(e, z.skill, 0.5, false);
            }
          }
        }
        if (z.skill.effect === 'whirlwind') {
          this.vfx.slash(this.x, this.y, this.elapsed * 12, color, z.radius);
          if (this.power('bulkathos')) this.resource = this.config.stats.maxResource;
          if (this.set('wasteland', 2) || this.learned('hurricane'))
            for (const e of this.enemies)
              if (e.hp > 0 && this.distance(e) < 300) {
                e.x += (this.x - e.x) * 0.15;
                e.y += (this.y - e.y) * 0.15;
              }
          if (
            this.set('wasteland', 4) &&
            Math.floor(z.age) > Math.floor(Math.max(0, z.age - 0.4))
          ) {
            const nearest = this.enemies
              .filter((e) => e.hp > 0)
              .sort((a, b) => this.distance(a) - this.distance(b))[0];
            const heading = nearest
              ? Math.atan2(nearest.y - this.y, nearest.x - this.x)
              : this.elapsed;
            for (let j = 0; j < 4; j++)
              this.projectiles.spawn(
                this.x,
                this.y,
                heading + (j * Math.PI) / 2,
                color,
                z.skill.id,
                { pierce: 10, homing: j === 0 || this.elapsed < this.chargeWindow, life: 1.6 },
              );
          }
        }
      }
      if (z.age >= z.life) {
        if (z.skill.effect === 'vines' && this.learned('spore_vine')) {
          this.area(
            z.x,
            z.y,
            z.radius,
            { ...z.skill, multiplier: 2 * this.rankScale('spore_vine') },
            1,
          );
          for (const e of this.enemies)
            if (e.hp > 0 && Math.hypot(e.x - z.x, e.y - z.y) < z.radius) {
              e.poison = 4;
              e.poisonStacks = 3;
              e.poisonSkill = z.skill;
              e.poisonOwner = this;
            }
          this.vfx.burst(z.x, z.y, 0xb7d67e, 20, true);
        }
        z.art?.destroy();
        z.view.destroy();
        this.zones.splice(i, 1);
      }
    }
  }
  private drop(kind: Orb['kind'], x: number, y: number, value = 0, item?: Item) {
    if (this.orbs.length > 180) return;
    const view = new Container(),
      g = new Graphics();
    let color = kind === 'health' ? 0xdd5269 : kind === 'progress' ? 0xb49be7 : 0xd7bb76;
    if (item) color = Number.parseInt(RARITY_COLORS[item.rarity].slice(1), 16);
    const texture =
      kind === 'item' && item
        ? getDropTexture(getItemAppearanceKey(item), item.slot)
        : kind === 'gold'
          ? getAtlasTexture('loot:gold')
          : undefined;
    if (kind === 'item') {
      if (!texture)
        pixelStamp(
          g,
          [
            '..oo....',
            '.ohho...',
            '.ohhho..',
            '..ohhho.',
            '...ohhho',
            '..oohoo.',
            '.ooo....',
            '.o......',
          ],
          { o: 0x152128, h: color },
          -12,
          -12,
          3,
        );
      // Only build-defining drops claim a tall beacon; ordinary gear stays readable on the floor.
      if (item && ['legendary', 'set', 'primal'].includes(item.rarity)) {
        const texture = getEffectTexture('beacon');
        if (texture) {
          const beam = new Sprite(texture);
          beam.anchor.set(0.5, 1);
          beam.width = 40;
          beam.height = 112;
          beam.tint = color;
          view.addChild(beam);
        } else {
          g.rect(-6, -108, 12, 96).fill({ color, alpha: 0.15 });
          g.rect(-2, -108, 4, 96).fill({ color, alpha: 0.8 });
        }
        pixelEllipse(g, 0, 8, 18, 7, color, 3, 0.7, true);
      }
    } else if (kind === 'gold') {
      if (!texture)
        pixelStamp(
          g,
          ['.gggg.', 'ghhhhg', 'ghgghg', 'ghgghg', '.gggg.'],
          { g: 0x9b6c3e, h: 0xf1cc70 },
          -9,
          -6,
          3,
        );
    } else if (getEffectTexture('globe')) {
      const globe = new Sprite(getEffectTexture('globe'));
      globe.anchor.set(0.5);
      globe.width = globe.height = kind === 'health' ? 22 : 26;
      globe.tint = color;
      view.addChild(globe);
    } else {
      pixelStamp(
        g,
        ['..oo..', '.ohho.', 'ohhhho', 'ohhhho', '.ohho.', '..oo..'],
        { o: 0x20303a, h: color },
        -9,
        -9,
        3,
      );
      g.rect(-3, -6, 3, 6).fill(0xf9ecd2);
      pixelEllipse(g, 0, 10, 10, 4, color, 3, 0.2);
    }
    view.addChild(g);
    if (texture) {
      const loot = new Sprite(texture);
      loot.anchor.set(0.5);
      loot.width = loot.height = kind === 'gold' ? 25 : 32;
      view.addChild(loot);
    }
    view.position.set(x, y);
    this.effectsLayer.addChild(view);
    this.orbs.push({ kind, x, y, age: 0, view, item, value });
  }
  private dropItem(x: number, y: number, item: Item) {
    if (this.coopHost.coop) {
      const source = this.enemies.some(
        (e) => e.goblin && e.deadTime !== undefined && Math.hypot(e.x - x, e.y - y) < 100,
      )
        ? 'goblin'
        : 'world';
      for (const actor of this.coopHost.coopActors.values())
        actor.earned.push(
          actor === this
            ? item
            : generateLoot(actor.config.classId, actor.config.stage, {
                rng: this.coopHost.random,
                source,
                ownedSetPieces: actor.config.ownedSetPieces,
              }),
        );
      this.vfx.ring(x, y, Number.parseInt(RARITY_COLORS[item.rarity].slice(1), 16), 25);
      return;
    }
    this.drop('item', x, y, 0, item);
    this.callbacks.onSound(
      item.rarity === 'primal'
        ? 'primal'
        : item.rarity === 'set'
          ? 'set'
          : item.rarity === 'legendary'
            ? 'legendary'
            : 'pickup',
    );
    if (item.rarity === 'primal') {
      this.shake = 9;
      this.vfx.ring(x, y, 0xf94365, 150);
    }
  }
  private updateOrbs(dt: number) {
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.age += dt;
      if (this.coop && this.coopActors.size) {
        const collector = [...this.coopActors.values()]
          .filter((a) => a.hp > 0)
          .sort((a, b) => a.distance(o) - b.distance(o))[0];
        if (
          collector &&
          collector !== this &&
          collector.distance(o) < collector.config.stats.pickupRadius + 35
        ) {
          // Execute the existing pickup rules with the collecting character's passives.
          const rest = this.orbs;
          collector.orbs = [o];
          collector.updateOrbs(0);
          if (!collector.orbs.length) rest.splice(i, 1);
          collector.orbs = rest;
          continue;
        }
      }
      const pickup = this.hp > 0 ? this.config.stats.pickupRadius + 35 : 0;
      const player = this.distance(o) < pickup;
      const pet = this.hp > 0 && Math.hypot(o.x - this.pet.x, o.y - this.pet.y) < 25;
      if (o.age > 0.25 && (player || pet)) {
        if (o.kind === 'health') {
          this.hp = Math.min(
            this.config.stats.hp,
            this.hp +
              this.config.stats.hp *
                0.15 *
                (this.learned('bloodthirst') ? 1 + 0.5 * this.rankScale('bloodthirst') : 1) *
                (this.config.petId === 'wisp' ? 1.2 : 1),
          );
          this.resource = Math.min(this.config.stats.maxResource, this.resource + 10);
          if (this.power('olda')) this.buffs.add('olda', '奥尔达之力', 15, undefined, 10);
          if (this.set('earthbreaker', 4))
            this.buffs.add('earthbreaker', '血球共鸣', 15, undefined, 8);
          this.callbacks.onSound('health');
          this.vfx.burst(this.x, this.y - 18, 0xaff3ba, 12, false, true);
        }
        if (o.kind === 'progress') {
          this.progress = Math.min(100, this.progress + o.value);
          this.callbacks.onSound('progress');
          this.numbers.show(this.x, this.y - 35, '秘境进度 +12%', false, 0xc5a5ef);
        }
        if (o.kind === 'gold') {
          this.gold += o.value;
          this.callbacks.onSound('pickup');
        }
        if (o.item) this.earned.push(o.item);
        o.view.destroy({ children: true });
        this.orbs.splice(i, 1);
      } else {
        o.view.position.set(
          o.x,
          o.y - Math.max(0, Math.sin(Math.min(1, o.age / 0.5) * Math.PI) * 15),
        );
        if (o.age > 40 && o.kind === 'gold') {
          o.view.destroy({ children: true });
          this.orbs.splice(i, 1);
        }
      }
    }
  }
  private createPet() {
    const id = this.config.petId;
    const art = PET_ART[id] ?? PET_ART.owl;
    const sprite = new Sprite(getPetTexture(id));
    sprite.anchor.set(art.anchorX, art.ground);
    sprite.width = 36;
    sprite.height = 36;
    this.pet.addChild(sprite);
    this.pet.position.set(-38, 32);
    this.entityLayer.addChild(this.pet);
    if (this.config.classId === 'ranger' && this.learned('raven'))
      for (let i = 0; i < 2; i++) {
        const raven = new Graphics();
        pixelStamp(
          raven,
          [
            'o...........o',
            'obo.......obo',
            '.obbo...obbo.',
            '..obbobobbo..',
            '...bbbhbbb...',
            '.....bhh.....',
            '......h......',
          ],
          { o: 0x15242d, b: 0x425762, h: 0xa9b9c0 },
          -19,
          -12,
          3,
        );
        this.entityLayer.addChild(raven);
        this.ravens.push(raven);
      }
  }
  private updatePet(dt: number) {
    this.ravens.forEach((r, i) => {
      const angle = this.elapsed * 1.7 + i * Math.PI;
      r.position.set(this.x + Math.cos(angle) * 65, this.y - 55 + Math.sin(angle) * 25);
      r.skew.y = Math.sin(this.elapsed * 12) * 0.14;
      r.zIndex = this.y + 60;
    });
    const nearest = this.orbs
      .filter((o) => o.age > 0.3)
      .sort(
        (a, b) =>
          Math.hypot(a.x - this.pet.x, a.y - this.pet.y) -
          Math.hypot(b.x - this.pet.x, b.y - this.pet.y),
      )[0];
    const target = nearest ?? { x: this.x - 38, y: this.y + 30 };
    const dx = target.x - this.pet.x,
      dy = target.y - this.pet.y,
      d = Math.hypot(dx, dy);
    const speed =
      (this.config.petId.includes('goblin') ? 420 : 290) *
      (1 + ((this.config.petLevel ?? 1) - 1) * 0.02);
    this.pet.x += (dx / Math.max(1, d)) * Math.min(d, speed * dt);
    this.pet.y += (dy / Math.max(1, d)) * Math.min(d, speed * dt);
    this.pet.zIndex = this.pet.y;
    this.pet.children[0].y = Math.sin(this.elapsed * 8) * 3;
    this.petTimer -= dt;
    if (this.petTimer <= 0) {
      this.petTimer = 3;
      if (this.config.petId.includes('dragon'))
        for (const e of this.enemies)
          if (e.hp > 0 && this.distance(e) < 200) {
            e.slow = 3;
            this.applyVulnerability(
              e,
              'dragon',
              0.3 * (1 + ((this.config.petLevel ?? 1) - 1) * 0.05),
              3,
            );
            this.vfx.ring(e.x, e.y, 0x96dce8, 20);
          }
    }
    this.updateSummons(dt);
  }
  private reviveSummon(summon: CharacterRig) {
    const state = this.summonStates.get(summon);
    if (!state) return;
    state.hp = state.maxHp;
    state.reviveIn = 0;
    summon.visible = true;
    summon.alpha = 0.65;
    const angle = (this.summons.indexOf(summon) / Math.max(1, this.summons.length)) * Math.PI * 2;
    summon.x = this.x + Math.cos(angle) * 55;
    summon.y = this.y + Math.sin(angle) * 40;
    this.vfx.burst(summon.x, summon.y, 0xc5d8b1, 6);
  }
  private defeatSummon(summon: CharacterRig) {
    const state = this.summonStates.get(summon);
    if (!state) return;
    state.hp = 0;
    state.reviveIn = 3;
    summon.visible = false;
    if (this.set('rathma', 2)) this.reviveSummon(summon);
  }
  private updateSummons(dt: number) {
    this.summons.forEach((s, i) => {
      const state = this.summonStates.get(s);
      if (!state) return;
      if (state.hp <= 0) {
        state.reviveIn = Math.max(0, state.reviveIn - dt);
        if (state.reviveIn === 0) this.reviveSummon(s);
        else return;
      }
      const a = this.elapsed * 0.4 + (i / this.summons.length) * Math.PI * 2;
      const target = this.enemies.find((e) => e.hp > 0 && this.distance(e) < 320);
      const warrior = isSkeletonWarrior(i);
      const tx =
          target && warrior
            ? target.x + Math.cos(a) * 24
            : this.x + Math.cos(a) * (65 + (i % 2) * 35),
        ty = target && warrior ? target.y + Math.sin(a) * 24 : this.y + Math.sin(a) * 50;
      s.x += (tx - s.x) * dt * 5;
      s.y += (ty - s.y) * dt * 5;
      s.zIndex = s.y;
      s.update(this.elapsed + i, dt, true, Math.cos(a), false);
      s.scale.set(0.45);
    });
  }
  private createSummons() {
    const count = this.set('inarius', 2) ? 16 : 10;
    for (let i = 0; i < count; i++) {
      const rig = this.headless
        ? (new SimulationActor() as unknown as CharacterRig)
        : new CharacterRig(isSkeletonWarrior(i) ? 'necromancer' : 'sorcerer', { summon: true });
      rig.scale.set(0.45);
      rig.alpha = 0.65;
      rig.tint = isSkeletonWarrior(i) ? 0xc1c4aa : 0xb4cdce;
      this.entityLayer.addChild(rig);
      this.summons.push(rig);
      const maxHp = Math.max(1, this.config.stats.hp * 0.35);
      this.summonStates.set(rig, { hp: maxHp, maxHp, reviveIn: 0 });
      this.reviveSummon(rig);
    }
  }
  private createPylons() {
    const shuffled = [...PYLONS].sort(() => this.random() - 0.5).slice(0, RIFT_PYLON_SITES.length);
    this.pylons = shuffled.map((p, i) => {
      const view = new Container(),
        g = new Graphics(),
        color = Number.parseInt(p.color.slice(1), 16);
      const { x, y } = RIFT_PYLON_SITES[i];
      if (this.headless) return { id: p.id, name: p.name, used: false, x, y, view };
      pixelEllipse(g, 0, 8, 30, 12, color, 3, 0.7, true);
      view.addChild(g);
      const shrine = createPropSprite(p.id, 91);
      if (shrine) {
        shrine.y = 9;
        view.addChild(shrine);
      } else {
        pixelStamp(
          g,
          [
            '...oo...',
            '..ohho..',
            '.ohhhho.',
            '..ohho..',
            '...oo...',
            '..sshs..',
            '..shhs..',
            '..shhs..',
            '..shhs..',
            '.sshss..',
            '.sssss..',
            'ssssssss',
          ],
          { o: 0x20313c, h: color, s: 0x778182 },
          -16,
          -68,
          4,
        );
        g.rect(-4, -116, 8, 48).fill({ color, alpha: 0.2 });
        g.rect(-2, -116, 4, 48).fill({ color, alpha: 0.6 });
      }
      const label = new Text({
        text: p.name,
        style: { fontFamily: 'monospace', fontSize: 12, fill: color },
      });
      label.anchor.set(0.5);
      label.position.set(0, 25);
      view.addChild(label);
      view.position.set(x, y);
      view.eventMode = 'static';
      view.cursor = 'pointer';
      view.on('pointertap', () => this.activatePylon(p.id));
      this.entityLayer.addChild(view);
      return { id: p.id, name: p.name, used: false, x, y, view };
    });
  }
  activatePylon(id: string) {
    if (this.paused || this.finished || this.hp <= 0) return;
    if (this.isCoopGuest) {
      this.queueCoopCommand(`pylon:${id}`);
      return;
    }
    const p = this.pylons.find((p) => p.id === id);
    if (!p || p.used) return;
    if (this.distance(p) > pylonReach) {
      this.numbers.show(this.x, this.y, '靠近圣坛后激活', false, 0xc7bd9f);
      return;
    }
    p.used = true;
    p.view.alpha = 0.4;
    const def = PYLONS.find((d) => d.id === id)!;
    for (const actor of this.coopHost.coop ? this.coopHost.coopActors.values() : [this])
      actor.buffs.add(id, def.name, 25 * (1 + this.power('nemesis')), def.color);
    this.vfx.ring(p.x, p.y, Number.parseInt(def.color.slice(1), 16), 230);
    this.callbacks.onSound('pylon');
    if (this.power('nemesis')) {
      this.spawn(MONSTERS[this.config.stage % MONSTERS.length], p.x + 70, p.y, true);
      for (let i = 0; i < 3; i++)
        this.spawn(
          MONSTERS[this.config.stage % MONSTERS.length],
          p.x + 50 + i * 20,
          p.y + 30,
          false,
          false,
          true,
        );
    }
    this.emit();
  }
  private periodic(dt: number) {
    this.autoFanTimer -= dt;
    if (this.set('shadow_blades', 2) && this.moving && this.autoFanTimer <= 0) {
      this.autoFanTimer = 0.8;
      const skill = this.skill('fan_of_knives');
      if (skill) this.perform(skill, true);
    }
    this.conduitTimer -= dt;
    if (this.buffs.has('conduit') && this.conduitTimer <= 0) {
      this.conduitTimer = 0.15;
      for (const e of this.enemies.filter((e) => e.hp > 0 && this.distance(e) < 420).slice(0, 5)) {
        this.vfx.lightning(this.x, this.y - 25, e.x, e.y);
        this.hit(e, this.skills[0], 8, false);
      }
    }
    this.fanTimer += dt;
    if (this.fanTimer >= 1) {
      this.fanTimer -= 1;
      this.fanCharge = Math.min(5, this.fanCharge + 1);
    }
    this.periodicTimer -= dt;
    if (this.periodicTimer > 0) return;
    this.periodicTimer = 1;
    if (this.learned('lava_whirl') && this.buffs.has('whirlwind')) {
      const s = this.skill('whirlwind');
      if (s)
        this.makeZone(
          this.x,
          this.y,
          60,
          3,
          { ...s, effect: 'lava', element: 'fire', multiplier: 1.2 * this.rankScale('lava_whirl') },
          0.33,
        );
    }
    if (this.set('storm_wolf', 2)) this.buffs.add('wolf', '雷霆狼人', 2);
    if (this.set('storm_wolf', 2)) {
      this.buffs.add('ultimate', '雷霆狼神', 2);
      this.ultimateBonus = 0.85 * this.rankScale('thunder_wolf');
    }
    if (this.set('tal_rasha', 2) && Math.floor(this.elapsed) % 2 === 0) {
      const s = this.skill('meteor');
      if (s) this.perform(s, true);
    }
    if (this.power('yang') && this.buffs.has('barrage')) {
      const s = this.skill('arrow_rain');
      if (s) this.perform(s, true, this.power('yang'));
    }
    if (this.power('pride') && this.buffs.has('warcry'))
      this.hp = Math.min(this.config.stats.hp, this.hp + this.config.stats.hp * 0.02);
    const near = this.enemies.filter((e) => e.hp > 0 && this.distance(e) < 350);
    if (this.ravens.length && near.length) {
      const skill = this.skill('raven');
      if (skill)
        for (let i = 0; i < this.ravens.length; i++) {
          const e = near[i % near.length];
          this.vfx.slash(e.x, e.y, this.elapsed, 0xb5cbd0, 25);
          this.hit(e, skill, 0.2, false);
        }
    }
    if (this.summons.length && near.length) {
      const s = this.skill('command_skeletons');
      if (s)
        for (let i = 0; i < this.summons.length; i++) {
          const e = near[i % near.length];
          const summon = this.summons[i];
          if ((this.summonStates.get(summon)?.hp ?? 0) <= 0) continue;
          if (isSkeletonWarrior(i)) {
            if (Math.hypot(e.x - summon.x, e.y - summon.y) > 80) continue;
            this.vfx.slash(
              summon.x,
              summon.y,
              Math.atan2(e.y - summon.y, e.x - summon.x),
              0xc5d8b1,
              45,
            );
          } else this.vfx.lightning(summon.x, summon.y - 10, e.x, e.y, 0xacc7ab);
          summon.attack();
          this.hit(e, s, 0.25 * (this.buffs.has('summon_fury') ? 2 : 1), false);
        }
    }
    if (this.set('inarius', 2) || this.buffs.has('army')) {
      const s = this.skill(this.buffs.has('army') ? 'army_of_dead' : 'bone_spear');
      if (s) this.area(this.x, this.y, 150, s, 0.4);
      this.vfx.ring(this.x, this.y, 0xc5d7b1, 150);
    }
  }
  private finish(won: boolean) {
    if (this.coopHost.coop) {
      this.coopHost.finishCoop(won);
      return;
    }
    if (this.finished || this.config.training) return;
    this.finished = true;
    this.callbacks.onSound(won ? 'victory' : 'defeat');
    this.emit();
    const result: RunResult = {
      stats: this.combatStats(),
      ...(this.config.challenge
        ? { challenge: { ...this.config.challenge, completed: this.objectiveComplete() } }
        : {}),
      won,
      stage: this.config.stage,
      seconds: Math.min(300, this.elapsed),
      kills: this.kills,
      gold: this.gold,
      shards: this.shards,
      items: [...this.earned],
    };
    this.simulationResult = result;
    this.callbacks.onFinish(result);
  }
  private combatStats(): CombatStats {
    const boss = this.enemies.find((e) => e.boss);
    return {
      ...this.report,
      seconds: this.elapsed,
      kills: this.kills,
      damageBySkill: { ...this.report.damageBySkill },
      damageBySource: { ...this.report.damageBySource },
      bossRemaining: boss ? Math.max(0, boss.hp / boss.maxHp) : undefined,
    };
  }
  private snapshot(): CombatSnapshot {
    const boss = this.enemies.find((e) => e.boss && e.hp > 0);
    const snapshot: CombatSnapshot = {
      stats: this.combatStats(),
      objective: this.config.challenge
        ? {
            name: CHALLENGES.find((c) => c.id === this.config.challenge!.id)!.name,
            progress: this.objectiveProgress,
            target: CHALLENGES.find((c) => c.id === this.config.challenge!.id)!.target,
          }
        : undefined,
      hp: Math.max(0, this.hp),
      maxHp: this.config.stats.hp,
      resource: this.resource,
      maxResource: this.config.stats.maxResource,
      progress: this.progress,
      seconds: Math.max(0, 300 - this.elapsed),
      kills: this.kills,
      combo: this.combo,
      boss: boss
        ? {
            name: boss.def.name,
            hp: boss.hp,
            maxHp: boss.maxHp,
            shield: boss.shield,
            enrageSeconds: Math.max(0, 120 - (boss.bossBrain?.age ?? 0)),
            enraged: boss.bossBrain?.enraged ?? false,
          }
        : undefined,
      cooldowns: { ...this.cooldowns },
      buffs: this.buffs.snapshot(),
      paused: this.paused,
      finished: this.finished,
      pylons: this.pylons.map((p) => ({
        id: p.id,
        name: p.name,
        used: p.used,
        inReach: this.distance(p) <= pylonReach,
      })),
      fps: Math.round(this.fps),
    };
    return snapshot;
  }
  private emit() {
    if (this.callbacks) this.callbacks.onSnapshot(this.snapshot());
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    clearInterval(this.coopTimer);
    this.coopTimer = undefined;
    this.resizeObserver?.disconnect();
    if (this.headless) {
      for (const actor of this.coopActors.values()) if (actor !== this) actor.destroy();
      this.coopActors.clear();
      if (this.hero && !this.hero.destroyed) this.hero.destroy({ children: true });
      for (const raven of this.ravens) if (!raven.destroyed) raven.destroy({ children: true });
      for (const layer of [
        this.world,
        this.floorLayer,
        this.entityLayer,
        this.effectsLayer,
        this.textLayer,
        this.minimap,
        this.coopVisuals,
        this.pet,
      ])
        if (!layer.destroyed) layer.destroy({ children: true });
      this.hazards.forEach((h) => {
        if (!h.view.destroyed) h.view.destroy();
      });
      this.hazards = [];
      return;
    }
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    if (this.initialized && this.app) {
      this.app.canvas.removeEventListener('pointerdown', this.onPointerDown);
      this.numbers.destroy();
      this.app.destroy(true, { children: true });
    }
  }
}
