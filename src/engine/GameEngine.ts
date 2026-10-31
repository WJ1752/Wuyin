import { Application, Container, Graphics, Text } from 'pixi.js';
import type {
  BossDef,
  CombatConfig,
  CombatSnapshot,
  GameCallbacks,
  Item,
  MonsterDef,
  SkillDef,
} from '../core/types';
import { RARITY_COLORS } from '../core/types';
import { CLASSES } from '../data/classes';
import { SKILLS } from '../data/skillTrees';
import { SETS } from '../data/sets';
import { LEGENDARIES } from '../data/legendaries';
import { MONSTERS, BOSSES, ELITE_AFFIXES } from '../data/monsters';
import { STAGES } from '../data/stages';
import { CharacterRig } from '../render/ProceduralRig';
import { MonsterRig } from '../render/MonsterRenderer';
import { createMap } from '../render/MapGenerator';
import { VFXManager, ELEMENT_COLORS } from '../render/VFXManager';
import { FloatingText } from '../render/FloatingText';
import { calculateDamage, mitigateDamage } from './CombatSystem';
import { BuffManager, PYLONS } from './BuffAndPylon';
import { ProjectileSystem } from './ProjectileSystem';
import { selectAutoCast } from './AutoCastAI';
import { generateLoot } from './LootGenerator';
import {
  createMonsterBrain,
  stepMonsterAI,
  type MonsterBrain,
  type MonsterAIEvent,
} from './MonsterAI';
import { createRng } from '../core/random';
import { createBossBrain, stepBossAI, type BossBrain } from './BossAI';

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
interface Enemy {
  id: number;
  def: MonsterDef;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  view: MonsterRig;
  elite: boolean;
  boss: boolean;
  minion: boolean;
  age: number;
  attackTimer: number;
  stun: number;
  slow: number;
  poison: number;
  poisonStacks: number;
  poisonSkill?: SkillDef;
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
interface Zone {
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
}

/** Owns one run. Browser listeners, ticker, Pixi resources and timers are disposed together. */
export class GameEngine {
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
  private ravens: Graphics[] = [];
  private x = 0;
  private y = 0;
  private movement = { x: 0, y: 0 };
  private keys = new Set<string>();
  private drag?: { x: number; y: number };
  private hp = 1;
  private resource = 100;
  private shield = 0;
  private shieldTime = 0;
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
    { event: Extract<MonsterAIEvent, { kind: 'telegraph' }>; age: number }
  >();
  private slowUntil = 0;
  private slowRatio = 0;
  private resizeObserver?: ResizeObserver;
  private minimap = new Graphics();
  private mapClock = 0;
  private gamepadHeld = new Set<number>();
  async init(host: HTMLElement, config: CombatConfig, callbacks: GameCallbacks): Promise<void> {
    this.host = host;
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
    this.app = new Application();
    await this.app.init({
      resizeTo: host,
      antialias: true,
      background: 0x142426,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
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
    this.floorLayer.addChild(createMap(STAGES[config.stage - 1]?.theme ?? 0));
    this.hero = new CharacterRig(config.classId, config.equipment);
    this.entityLayer.addChild(this.hero);
    this.vfx = new VFXManager(this.effectsLayer);
    this.numbers = new FloatingText(this.textLayer);
    this.projectiles = new ProjectileSystem(this.effectsLayer);
    this.createPet();
    this.createPylons();
    if (config.classId === 'necromancer') this.createSummons();
    this.spawnWave();
    if (this.random() < 0.18 && !config.training) this.spawnGoblin();
    this.app.ticker.add(this.tick);
    this.app.ticker.maxFPS = 120;
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
    this.emit();
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
    if (p('reilena')) s.independent.push(s.maxResource * p('reilena'));
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
  }
  togglePause() {
    if (this.finished) return;
    this.paused = !this.paused;
    this.keys.clear();
    this.setMovement(0, 0);
    this.emit();
  }
  private onKeyDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.matches('input,select,textarea')) return;
    const key = e.key.toLowerCase();
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
    this.keys.delete(e.key.toLowerCase());
  };
  private onBlur = () => {
    this.keys.clear();
    this.setMovement(0, 0);
    this.drag = undefined;
    if (!this.finished) {
      this.paused = true;
      this.emit();
    }
  };
  private onVisibility = () => {
    if (document.hidden) this.onBlur();
  };
  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.drag = { x: e.clientX, y: e.clientY };
  };
  private onPointerMove = (e: PointerEvent) => {
    if (this.drag) this.setMovement((e.clientX - this.drag.x) / 65, (e.clientY - this.drag.y) / 65);
  };
  private onPointerUp = () => {
    this.drag = undefined;
    this.setMovement(0, 0);
  };
  private tick = () => {
    if (!this.app || this.disposed) return;
    const dt = Math.min(0.05, this.app.ticker.deltaMS / 1000);
    this.fps = this.app.ticker.FPS;
    if (!this.paused && !this.finished) this.update(dt);
    this.updateCamera(dt);
  };
  private update(dt: number) {
    this.elapsed += dt;
    this.buffs.tick(dt);
    this.shieldTime = Math.max(0, this.shieldTime - dt);
    if (this.shieldTime === 0) this.shield = 0;
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;
    for (const id of Object.keys(this.cooldowns)) {
      this.cooldowns[id] = Math.max(0, this.cooldowns[id] - dt);
      if (!this.cooldowns[id]) delete this.cooldowns[id];
    }
    let mx = this.movement.x,
      my = this.movement.y;
    mx +=
      (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) -
      (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0);
    my +=
      (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) -
      (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0);
    const pad = navigator.getGamepads?.()?.find((p) => p?.connected);
    if (pad) {
      if (Math.abs(pad.axes[0] ?? 0) > 0.18) mx += pad.axes[0];
      if (Math.abs(pad.axes[1] ?? 0) > 0.18) my += pad.axes[1];
      for (let i = 0; i < 6; i++) {
        if (pad.buttons[i]?.pressed && !this.gamepadHeld.has(i)) {
          this.gamepadHeld.add(i);
          const skill = this.skills[i];
          if (skill) this.cast(skill.id);
        } else if (!pad.buttons[i]?.pressed) this.gamepadHeld.delete(i);
      }
    }
    const len = Math.max(1, Math.hypot(mx, my));
    mx /= len;
    my /= len;
    this.moving = Math.hypot(mx, my) > 0.1;
    if (mx) this.facing = mx;
    const speed =
      this.config.stats.moveSpeed *
      (this.elapsed < this.slowUntil && !this.buffs.has('ultimate') ? 1 - this.slowRatio : 1) *
      (this.buffs.has('speed') ? 1.6 : 1) *
      (this.buffs.has('berserker') ? 1.4 : 1) *
      (this.buffs.has('wolf') ? 1.45 : 1) *
      (this.set('wasteland', 2) && this.buffs.has('whirlwind') ? 1.4 : 1) *
      (this.power('bulkathos') && this.buffs.has('whirlwind') ? 1 + this.power('bulkathos') : 1);
    this.x = Math.max(-780, Math.min(780, this.x + mx * speed * dt));
    this.y = Math.max(-780, Math.min(780, this.y + my * speed * dt));
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
    if (this.castTimer <= 0 && targets.length) {
      const selected = selectAutoCast(this.skills, {
        hpRatio: this.hp / this.config.stats.hp,
        nearby: targets.filter((e) => this.distance(e) < 150).length,
        enemies: targets.length,
        elite: targets.some((e) => e.elite || e.boss),
        resource: this.resource,
        free: this.buffs.has('channeling'),
        cooldowns: this.cooldowns,
        auto: this.config.autoSkills,
      });
      if (selected) this.cast(selected.id);
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && !this.bossSpawned) {
      this.spawnWave();
      this.spawnTimer = 5;
    }
    this.updateEnemies(dt);
    this.updateWarningAnimations(dt);
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
        this.hit(enemy, skill, p.multiplier, p.proc);
        if (p.proc && ['explosive', 'elemental', 'orb'].includes(skill.effect)) {
          this.vfx.burst(enemy.x, enemy.y, p.color, 8);
          this.area(
            enemy.x,
            enemy.y,
            skill.effect === 'orb' ? 80 : 45,
            skill,
            0.4 *
              (skill.effect === 'orb' && this.set('delsere', 2) ? 2 : 1) *
              (this.power('endless_depths') && skill.effect === 'orb'
                ? 1 + 2 * this.power('endless_depths')
                : 1),
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
              { pierce: 2, proc: false, multiplier: skill.multiplier },
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
          if (skill) {
            this.vfx.burst(p.x, p.y, p.color, 18, true);
            this.area(p.x, p.y, 110, skill, p.multiplier);
          }
        }
      },
    );
    this.updateZones(dt);
    this.updateOrbs(dt);
    this.updatePet(dt);
    this.periodic(dt);
    this.vfx.tick(dt);
    this.numbers.tick(dt);
    if (this.progress >= 100 && !this.bossSpawned && !this.config.training) this.summonBoss();
    if (this.hp <= 0 && !this.config.training) this.finish(false);
    if (this.elapsed >= 300 && !this.config.training) this.finish(false);
    if (this.config.training) this.hp = this.config.stats.hp;
    this.snapshotTimer -= dt;
    if (this.snapshotTimer <= 0) {
      this.snapshotTimer = 0.1;
      this.emit();
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
    const scale = Math.min(1.2, Math.max(0.72, Math.min(w / 700, h / 660)));
    this.world.scale.set(scale);
    this.shake = Math.max(0, this.shake - dt * 22);
    this.world.position.set(
      w / 2 - this.x * scale + (this.random() - 0.5) * this.shake,
      h * 0.52 - this.y * scale + (this.random() - 0.5) * this.shake,
    );
  }
  private drawMinimap() {
    if (!this.app) return;
    const g = this.minimap;
    g.position.set(this.app.screen.width - 120, 16);
    g.clear()
      .roundRect(0, 0, 104, 104, 4)
      .fill({ color: 0x101e23, alpha: 0.82 })
      .stroke({ color: 0x9b997e, alpha: 0.5, width: 1 });
    const point = (x: number, y: number) => ({
      x: 52 + (x - this.x) / 16,
      y: 52 + (y - this.y) / 16,
    });
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const p = point(e.x, e.y);
      if (p.x < 4 || p.x > 100 || p.y < 4 || p.y > 100) continue;
      g.rect(p.x - 1, p.y - 1, e.boss ? 5 : 2, e.boss ? 5 : 2).fill(
        e.boss ? 0xf78f9d : e.elite ? 0xe4c785 : 0x9f8b83,
      );
    }
    for (const o of this.orbs) {
      if (!o.item) continue;
      const p = point(o.x, o.y);
      if (p.x < 4 || p.x > 100 || p.y < 4 || p.y > 100) continue;
      g.poly([p.x, p.y - 3, p.x + 3, p.y, p.x, p.y + 3, p.x - 3, p.y]).fill(
        RARITY_COLORS[o.item.rarity],
      );
    }
    for (const pylon of this.pylons) {
      if (pylon.used) continue;
      const p = point(pylon.x, pylon.y);
      if (p.x > 4 && p.x < 100 && p.y > 4 && p.y < 100)
        g.rect(p.x - 2, p.y - 2, 4, 4).fill(0xb5a3e0);
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
    const stage = STAGES[this.config.stage - 1] ?? STAGES[0];
    const view = new MonsterRig(def, elite, boss, minion);
    const hp = def.hp * stage.hpMultiplier * (elite ? 5 : 1) * (minion ? 1.6 : 1);
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
  private spawnWave() {
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
    if (this.enemies.filter((e) => e.hp > 0).length > 55) return;
    const count = this.config.training ? 8 : 12;
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
        Math.max(-800, Math.min(800, this.x + Math.cos(a) * d)),
        Math.max(-800, Math.min(800, this.y + Math.sin(a) * d)),
      );
    }
    if (this.elapsed > 4 && Math.floor(this.elapsed / 5) % 3 === 1) {
      const a = this.random() * 6.28,
        x = this.x + Math.cos(a) * 350,
        y = this.y + Math.sin(a) * 350;
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
    for (const view of this.enemyWarnings.values()) view.destroy();
    this.enemyWarnings.clear();
    this.warningAnimations.clear();
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
    this.spawn(def, this.x, this.y - 220, false, true);
    this.numbers.show(this.x, this.y - 130, def.name, true, 0xf2ba9b);
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
      e.attackTimer -= dt;
      const d = this.distance(e),
        a = Math.atan2(this.y - e.y, this.x - e.x);
      const speed =
        e.def.speed * (e.slow > 0 ? 0.4 : 1) * (e.stun > 0 ? 0 : 1) * (e.goblin ? -1.7 : 1);
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
        e.stun = 0.6;
        e.x -= Math.cos(a) * dt * 200;
        e.y -= Math.sin(a) * dt * 200;
      }
      if (e.poison > 0) {
        e.poison -= dt;
        this.hit(
          e,
          e.poisonSkill ?? this.skills[0],
          dt * 0.4 * Math.max(1, e.poisonStacks),
          false,
          true,
        );
      }
      if ((e.bleed ?? 0) > 0) {
        e.bleed = Math.max(0, e.bleed! - dt);
        this.hit(e, e.bleedSkill, dt * (this.learned('blood_fan') ? 1.6 : 1), false, true);
      }
      if (e.hp <= 0) continue;
      e.view.position.set(e.x, e.y);
      e.view.zIndex = e.y;
      e.view.update(this.elapsed + e.id, dt, d > 35);
      e.view.drawHealth(e.hp / e.maxHp);
    }
  }
  private stepEnemyBrain(e: Enemy, dt: number) {
    if (this.config.training) return;
    const input = {
      dt,
      time: this.elapsed,
      id: e.id,
      behavior: e.def.behavior,
      family: e.def.family,
      x: e.x,
      y: e.y,
      playerX: this.x,
      playerY: this.y,
      hp: e.hp,
      maxHp: e.maxHp,
      attack: e.def.attack,
      speed: e.def.speed * (e.slow > 0 ? 0.4 : 1),
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
      if (e.shape === 'circle')
        view
          .clear()
          .circle(e.x, e.y, e.radius)
          .fill({ color: e.color, alpha: 0.12 })
          .circle(e.x, e.y, e.radius * t)
          .stroke({ color: e.color, alpha: 0.9, width: 2.5 });
    }
  }
  private handleEnemyEvent(e: Enemy, event: MonsterAIEvent) {
    if (event.kind === 'telegraph') {
      this.enemyWarnings.get(event.id)?.destroy();
      const g = new Graphics();
      const color = event.color;
      if (event.shape === 'circle')
        g.circle(event.x, event.y, event.radius)
          .fill({ color, alpha: 0.12 })
          .stroke({ color, alpha: 0.65, width: 1.5 });
      else if (event.shape === 'cone')
        g.moveTo(event.x, event.y)
          .arc(event.x, event.y, event.range, event.angle - event.width, event.angle + event.width)
          .closePath()
          .fill({ color, alpha: 0.15 })
          .stroke({ color, alpha: 0.6, width: 1.5 });
      else {
        const dx = Math.cos(event.angle) * event.range,
          dy = Math.sin(event.angle) * event.range,
          ox = -Math.sin(event.angle) * event.width,
          oy = Math.cos(event.angle) * event.width;
        g.poly([
          event.x + ox,
          event.y + oy,
          event.x + dx + ox,
          event.y + dy + oy,
          event.x + dx - ox,
          event.y + dy - oy,
          event.x - ox,
          event.y - oy,
        ])
          .fill({ color, alpha: 0.15 })
          .stroke({ color, alpha: 0.65, width: 1.5 });
      }
      this.floorLayer.addChild(g);
      this.enemyWarnings.set(event.id, g);
      this.warningAnimations.set(event.id, { event, age: 0 });
      if (e.boss) this.callbacks.onSound('warning');
    } else if (event.kind === 'strike') {
      this.enemyWarnings.get(event.id)?.destroy();
      this.enemyWarnings.delete(event.id);
      this.warningAnimations.delete(event.id);
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
      if (event.playerHit) {
        this.takeDamage(event.damage);
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
          e.hp -= this.config.stats.thorns;
          this.numbers.show(e.x, e.y, this.config.stats.thorns);
          if (e.hp <= 0) this.kill(e);
        }
      }
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
  private takeDamage(raw: number) {
    if (this.buffs.has('invulnerable')) return;
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
  private applyVulnerability(e: Enemy, key: string, value: number, duration: number) {
    e.vulnerabilities ??= {};
    e.vulnerabilities[key] = { value, expires: this.elapsed + duration };
    e.vulnerability = Object.values(e.vulnerabilities).reduce((sum, buff) => sum + buff.value, 0);
  }
  cast(id: string) {
    if (this.paused || this.finished || !this.initialized) return;
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
    let cost = skill.cost;
    if (this.power('grand_vizier') && skill.effect === 'meteor') cost *= 0.5;
    const zero = free || this.buffs.has('channeling');
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
        (this.buffs.has('wolf') ? 1.5 : 1) *
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
    this.hero.attack();
    this.callbacks.onSound(skill.effect);
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
      const beamTargets = targets.filter(
        (e) =>
          Math.abs(Math.sin(Math.atan2(e.y - this.y, e.x - this.x) - angle) * this.distance(e)) <
          35,
      );
      for (const e of beamTargets) this.hit(e, { ...skill, element: 'arcane' }, multiplier * 2);
      this.vfx.lightning(
        this.x,
        this.y - 25,
        this.x + Math.cos(angle) * 600,
        this.y + Math.sin(angle) * 600,
        0xd2aaff,
      );
      if (this.set('vyr', 2))
        for (const e of targets.slice(0, 3)) {
          this.hit(e, skill, multiplier);
          this.vfx.lightning(tx, ty, e.x, e.y, 0xd2aaff);
        }
      return;
    }
    if (skill.kind === 'ultimate') {
      this.ultimateBonus = skill.multiplier;
      this.buffs.add('ultimate', skill.name, skill.duration || 15, '#' + color.toString(16));
      this.buffs.add(skill.effect, skill.name, skill.duration || 15);
      if (skill.effect === 'army')
        this.area(this.x, this.y, 420, { ...skill, multiplier: 12 }, multiplier);
      this.vfx.ring(this.x, this.y, color, 180);
      return;
    }
    if (skill.kind === 'movement') {
      const movement = this.moving
        ? Math.atan2(
            this.movement.y || (this.keys.has('s') ? 1 : 0) - (this.keys.has('w') ? 1 : 0),
            this.movement.x || (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0),
          )
        : angle;
      this.vfx.ring(this.x, this.y, color, 45);
      if (skill.effect === 'shadowstep' && nearest) {
        this.x = nearest.x + Math.cos(angle) * 30;
        this.y = nearest.y + Math.sin(angle) * 30;
        this.buffs.add('guaranteed_crit', '暗影伏击', 3);
        if (this.power('shadowfang')) {
          this.shadowCharges = 3;
          this.buffs.add('shadowfang', '暗影獠牙 · 3次攻击', 60);
        }
        this.hit(nearest, skill, multiplier);
      } else {
        this.x = Math.max(-780, Math.min(780, this.x + Math.cos(movement) * 170));
        this.y = Math.max(-780, Math.min(780, this.y + Math.sin(movement) * 170));
      }
      this.buffs.add('invulnerable', '无敌', 0.8);
      if (skill.effect === 'teleport') {
        this.shield = this.config.stats.hp * (0.4 + (this.power('cosmic_strand') ? 0.2 : 0));
        this.shieldTime = 5;
      }
      if (skill.effect === 'bloodstep')
        this.hp = Math.min(
          this.config.stats.hp,
          this.hp + this.config.stats.hp * 0.05 * this.rankScale(skill.id),
        );
      if (skill.effect === 'dodge')
        this.resource = Math.min(this.config.stats.maxResource, this.resource + 40);
      if (skill.effect === 'charge') this.area(this.x, this.y, 80, skill, multiplier);
      return;
    }
    if (skill.effect === 'shield' || skill.effect === 'warcry') {
      this.shieldTime =
        (skill.duration || 8) *
        (skill.effect === 'shield' && this.power('earthward')
          ? 2
          : skill.effect === 'warcry'
            ? 1 + this.power('pride')
            : 1);
      this.shield =
        this.config.stats.hp *
        (skill.effect === 'shield' ? 0.45 + this.power('earthward') : 0.2) *
        this.rankScale(skill.id);
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
          if (this.distance(e) < 200)
            this.applyVulnerability(e, 'warcry', 0.35 * this.rankScale(skill.id), this.shieldTime);
        }
      if (this.set('immortal_thorns', 4) && skill.effect === 'warcry')
        this.area(
          this.x,
          this.y,
          420,
          skill,
          (this.config.stats.armor / Math.max(1, this.config.stats.attack)) *
            10 *
            (1 + this.power('shield_of_ancients')),
        );
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
    if (['pull', 'nova', 'curse', 'raven', 'summon'].includes(skill.effect)) {
      const radius = skill.radius || 180;
      for (const e of targets.filter((e) => this.distance(e) < radius)) {
        if (skill.effect === 'pull') {
          e.x = this.x + (e.x - this.x) * 0.25;
          e.y = this.y + (e.y - this.y) * 0.25;
          e.stun = 1;
        }
        if (skill.effect === 'nova') {
          e.stun = 3;
          if (this.set('delsere', 4)) delete this.cooldowns.teleport;
        }
        if (skill.effect === 'curse') {
          e.curse = 8;
          e.slow = 8;
          this.applyVulnerability(e, 'curse', 0.2 * this.rankScale(skill.id), 8);
          if (!e.boss && e.hp / e.maxHp < 0.15) this.hit(e, skill, 10000);
        }
        if (skill.effect === 'raven') {
          this.applyVulnerability(
            e,
            'raven',
            0.3 * this.rankScale(skill.id) + this.power('ravenwing'),
            6,
          );
          e.stun = 1.5;
        }
        this.hit(
          e,
          skill,
          multiplier *
            (skill.effect === 'nova' && this.power('endless_depths')
              ? 1 + 2 * this.power('endless_depths')
              : 1),
        );
      }
      if (skill.effect === 'summon') {
        for (const summon of this.summons) this.vfx.burst(summon.x, summon.y, color, 12, true);
        this.area(tx, ty, this.set('rathma', 4) ? 240 : 120, skill, multiplier);
        this.buffs.add('summon_fury', '骸骨狂热', 8);
      }
      this.vfx.ring(this.x, this.y, color, radius);
      return;
    }
    if (['hammer', 'bash', 'frenzy', 'scythe', 'claw', 'spike', 'siphon'].includes(skill.effect)) {
      let radius = skill.radius || 90;
      if (skill.effect === 'claw' && this.power('moonfang')) radius *= 1.3;
      if (skill.effect === 'hammer') radius *= 1 + this.buffs.stacks('earthbreaker') * 0.08;
      if (skill.effect === 'bash' && this.learned('seismic_bash')) {
        radius *= 1.3;
        for (const e of targets) if (this.distance(e) < radius) e.stun = 1;
      }
      if (skill.effect === 'siphon') {
        for (const e of targets
          .filter((e) => this.distance(e) < radius)
          .slice(0, this.learned('blood_drain') ? 3 : 1))
          this.hit(e, skill, multiplier);
      } else this.area(this.x, this.y, radius, skill, multiplier);
      this.vfx.slash(this.x, this.y, angle, color, radius);
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
            pierce: 10,
            proc: false,
            multiplier: skill.multiplier,
          });
      if (skill.effect === 'claw' && this.learned('thunder_claw') && this.attackCount % 3 === 0)
        for (const e of targets.slice(0, 3)) {
          this.vfx.lightning(this.x, this.y - 20, e.x, e.y);
          this.hit(e, this.skill('thunder_claw'), 1, false);
        }
      if (skill.effect === 'hammer') {
        this.shake = 7;
        if (this.power('judgment') && targets.filter((e) => this.distance(e) < radius).length <= 3)
          this.resource = Math.min(this.config.stats.maxResource, this.resource + cost);
        if (this.power('gavel'))
          this.area(
            this.x + Math.cos(angle) * 90,
            this.y + Math.sin(angle) * 90,
            radius,
            skill,
            this.power('gavel'),
          );
      }
      if (skill.effect === 'frenzy')
        this.buffs.add('frenzy', '狂乱', 5, undefined, this.learned('frenzy_flurry') ? 10 : 5);
      if (skill.effect === 'siphon')
        this.hp = Math.min(
          this.config.stats.hp,
          this.hp +
            this.config.stats.hp *
              (this.learned('blood_drain') ? 0.04 * this.rankScale('blood_drain') : 0.02) *
              (this.power('funerary_pick') ? 2 : 1),
        );
      if (skill.effect === 'scythe' && this.power('corroded_fang'))
        for (const e of targets)
          if (e.poison > 0) this.hit(e, skill, e.poison * this.power('corroded_fang') * 0.4);
      return;
    }
    if (skill.effect === 'chain') {
      let previous = { x: this.x, y: this.y };
      for (const e of targets.slice(
        0,
        4 + (this.power('serpent_spark') ? 2 : 0) + (this.learned('chain_lightning') ? 3 : 0),
      )) {
        this.vfx.lightning(previous.x, previous.y, e.x, e.y);
        this.hit(e, skill, multiplier);
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
    if (skill.id === 'death_scythe' && this.learned('poison_scythe'))
      skill.multiplier *= 1 + 0.5 * this.rankScale('poison_scythe');
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
  private area(x: number, y: number, radius: number, skill: SkillDef, multiplier = 1) {
    for (const e of this.enemies)
      if (e.hp > 0 && Math.hypot(e.x - x, e.y - y) < radius + e.radius)
        this.hit(e, skill, multiplier * (1 + this.config.stats.areaDamage));
  }
  private hit(e: Enemy, skill: SkillDef | undefined, multiplier = 1, canProc = true, dot = false) {
    if (!skill || e.hp <= 0) return;
    skill = this.resolveSkill(skill);
    const stats = { ...this.config.stats, independent: [...this.config.stats.independent] };
    let chance = stats.critChance;
    if (this.buffs.has('berserker')) chance += 0.3;
    if (skill.effect === 'hammer')
      chance += (this.resource / Math.max(1, stats.maxResource)) * 0.25;
    if (this.learned('prodigy') && this.resource > stats.maxResource * 0.9) chance += 0.1;
    if (this.power('winterglass') && e.stun > 0) chance += this.power('winterglass');
    const crit =
      !dot &&
      (skill.effect !== 'thorns' || this.set('immortal_thorns', 4)) &&
      (this.buffs.has('guaranteed_crit') || this.random() < chance);
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
      if (set.id === 'frost_hunter') applies = e.slow > 0 || e.stun > 0;
      if (set.id === 'wild_vines') applies = e.poison > 0;
      if (set.id === 'inarius') applies = this.distance(e) < 150;
      if (set.id === 'marauder' && skill.effect === 'multishot') {
        independent.push(this.buffs.stacks('barrage') * 0.9);
        continue;
      }
      if (set.id === 'earthbreaker' && skill.effect === 'hammer') {
        independent.push(this.buffs.stacks('earthbreaker') * 1.2);
        continue;
      }
      if (set.id === 'vyr') applies = this.buffs.has('archon');
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
    if (this.power('serpent_spark') && skill.effect === 'chain')
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
      armor: (e.boss ? 35 : e.elite ? 20 : 5) + this.config.stage * 0.2,
    });
    if (e.shield > 0) {
      const absorbed = Math.min(e.shield, damage);
      e.shield -= absorbed;
      damage -= absorbed;
    }
    e.hp -= damage;
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
    if (this.buffs.has('archon')) this.laserStacks++;
    if (!dot && skill.kind === 'basic')
      this.resource = Math.min(
        stats.maxResource,
        this.resource +
          (skill.id === 'explosive_arrow' ? 15 : skill.effect === 'bash' ? 18 : 12) +
          (this.learned('prodigy') ? 8 * this.rankScale('prodigy') : 0),
      );
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
      e.slow = 3;
      if (skill.id === 'meteor' && this.learned('frost_meteor')) e.stun = 2;
      if (this.power('froststring') && e.stun > 0) e.stun = Math.max(e.stun, 3);
      if (this.set('frost_hunter', 2) && canProc) {
        this.vfx.ring(e.x, e.y, 0xa3def4, 40);
        for (const other of this.enemies)
          if (other.hp > 0 && Math.hypot(other.x - e.x, other.y - e.y) < 40)
            this.hit(other, skill, 0.2, false);
      }
    }
    if (!dot && skill.effect === 'fan') {
      e.bleed = this.learned('blood_fan') ? 5 : 3;
      e.bleedSkill = { ...skill, multiplier: 0.6 };
    }
    if (!dot && skill.effect === 'whirlwind' && this.power('lamentation')) {
      e.bleed = 3;
      e.bleedSkill = { ...skill, multiplier: this.power('lamentation') };
    }
    if (skill.element === 'poison' && !dot) {
      e.poison = 4 + (this.power('nayr') ? 2 : 0);
      e.poisonSkill = skill;
      e.poisonStacks = Math.min(5, e.poisonStacks + 1);
      if (e.poisonStacks === 5 && this.set('trang_oul', 4) && canProc) {
        e.poisonStacks = 0;
        this.area(e.x, e.y, 95, { ...skill, element: 'physical' }, 2);
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
        this.hit(
          e,
          { ...skill, id: 'thorns', effect: 'thorns', multiplier: 1 },
          (this.config.stats.armor / Math.max(1, stats.attack)) *
            10 *
            (this.set('immortal_thorns', 4) ? 9 : 1) *
            (1 + this.power('shield_of_ancients')),
          false,
        );
      }
      if (this.power('windforce') && this.random() < this.power('windforce')) {
        e.x += (e.x - this.x) * 0.08;
        e.y += (e.y - this.y) * 0.08;
        e.stun = 1;
      }
    }
    if (e.hp <= 0) this.kill(e);
  }
  private kill(e: Enemy) {
    if (e.deadTime !== undefined) return;
    e.deadTime = 0.4;
    this.kills++;
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
            rarity: i % 2 ? 'set' : 'legendary',
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
        if (n.hp > 0 && Math.hypot(n.x - e.x, n.y - e.y) < 200) {
          n.poison = 4;
          n.poisonSkill = e.poisonSkill;
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
          n.poisonStacks = Math.max(n.poisonStacks, 1);
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
        .map((i) => `${i!.setId}:${i!.slot}`);
      for (let i = 0; i < 4; i++) {
        const item = generateLoot(this.config.classId, this.config.stage, {
          rng: this.random,
          rarity: i < 2 ? 'legendary' : 'set',
          ownedSetPieces: owned,
        });
        this.earned.push(item);
        if (item.setId) owned.push(`${item.setId}:${item.slot}`);
      }
      if (this.config.stage === 5) {
        const set = SETS.find((s) => s.classId === this.config.classId)!;
        this.earned.push(
          generateLoot(this.config.classId, 5, { setId: set.id, slot: 'head' }),
          generateLoot(this.config.classId, 5, { setId: set.id, slot: 'chest' }),
        );
      }
      if (this.config.stage <= 3) {
        const core = LEGENDARIES.find(
          (l) => l.classId === this.config.classId && l.slot === 'weapon',
        );
        if (core)
          this.earned.push(
            generateLoot(this.config.classId, this.config.stage, {
              rng: this.random,
              legendaryId: core.id,
            }),
          );
      }
      for (const orb of this.orbs) if (orb.item) this.earned.push(orb.item);
      this.finish(true);
    }
  }
  private makeZone(
    x: number,
    y: number,
    radius: number,
    life: number,
    skill: SkillDef,
    multiplier = 1,
  ) {
    if (this.zones.length > 35) return;
    const view = new Graphics();
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
      multiplier,
    });
  }
  private updateZones(dt: number) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.age += dt;
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
      z.view
        .clear()
        .ellipse(z.x, z.y, z.radius, z.radius * 0.68)
        .fill({ color, alpha: 0.045 })
        .stroke({ color, alpha: 0.35, width: 1.5 });
      for (let j = 0; j < 5; j++) {
        const a = this.elapsed * 2 + j * Math.PI * 0.4;
        z.view
          .moveTo(z.x + Math.cos(a) * z.radius * 0.7, z.y + Math.sin(a) * z.radius * 0.5)
          .lineTo(
            z.x + Math.cos(a + 0.4) * z.radius * 0.9,
            z.y + Math.sin(a + 0.4) * z.radius * 0.6,
          )
          .stroke({ color, width: 2, alpha: 0.65 });
      }
      if (z.pull)
        for (const e of this.enemies)
          if (e.hp > 0 && Math.hypot(e.x - z.x, e.y - z.y) < z.radius * 1.6) {
            e.x += (z.x - e.x) * dt * 1.4;
            e.y += (z.y - e.y) * dt * 1.4;
          }
      if (z.tick <= 0) {
        z.tick = 0.4;
        this.area(
          z.x,
          z.y,
          z.radius,
          z.skill,
          (z.multiplier * 0.4) / (z.skill.effect === 'rain' ? z.life : 1),
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
          if (this.set('wasteland', 4) && Math.floor(z.age) > Math.floor(Math.max(0, z.age - 0.4)))
            for (let j = 0; j < 4; j++)
              this.projectiles.spawn(
                this.x,
                this.y,
                this.elapsed + (j * Math.PI) / 2,
                color,
                z.skill.id,
                { pierce: 10 },
              );
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
            }
          this.vfx.burst(z.x, z.y, 0xb7d67e, 20, true);
        }
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
    if (kind === 'item') {
      g.poly([-6, -5, 0, -10, 7, -4, 5, 7, -5, 7])
        .fill(color)
        .stroke({ color: 0xe7e5d1, width: 1 });
      g.moveTo(0, -4)
        .lineTo(0, -135)
        .stroke({ color, alpha: 0.12, width: 22 })
        .moveTo(0, -4)
        .lineTo(0, -135)
        .stroke({ color, alpha: 0.65, width: 2 });
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        g.moveTo(Math.cos(a) * 17, Math.sin(a) * 7)
          .lineTo(Math.cos(a + (Math.PI * 2) / 3) * 17, Math.sin(a + (Math.PI * 2) / 3) * 7)
          .stroke({ color, alpha: 0.6, width: 1 });
      }
    } else if (kind === 'gold') {
      g.ellipse(0, 0, 6, 4)
        .fill(0xc3a055)
        .stroke({ color: 0xe8d8a7, width: 1 })
        .moveTo(0, -2)
        .lineTo(0, 2)
        .stroke({ color: 0x695a36, width: 1 });
    } else {
      g.poly([0, -9, 7, -2, 5, 5, 0, 8, -5, 5, -7, -2])
        .fill(color)
        .stroke({ color: 0xf4d7cf, alpha: 0.6, width: 1 })
        .poly([-2, -5, 0, -7, 2, -3, -1, 1])
        .fill({ color: 0xffffff, alpha: 0.6 });
      g.ellipse(0, 9, 10, 4).fill({ color, alpha: 0.15 });
    }
    view.addChild(g);
    view.position.set(x, y);
    this.effectsLayer.addChild(view);
    this.orbs.push({ kind, x, y, age: 0, view, item, value });
  }
  private dropItem(x: number, y: number, item: Item) {
    this.drop('item', x, y, 0, item);
    this.callbacks.onSound(
      item.rarity === 'primal' ? 'primal' : item.rarity === 'set' ? 'set' : 'legendary',
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
      const pickup = this.config.stats.pickupRadius + 35;
      const player = this.distance(o) < pickup;
      const pet = Math.hypot(o.x - this.pet.x, o.y - this.pet.y) < 25;
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
    const g = new Graphics();
    const id = this.config.petId;
    const color = id.includes('dragon')
      ? 0x8cccd7
      : id.includes('imp')
        ? 0xe5a26e
        : id.includes('owl')
          ? 0xb9aed3
          : 0xb7c77e;
    g.poly([-9, -8, -15, -16, -12, -2, -7, 4, 6, 4, 12, -3, 14, -17, 8, -9, 0, -13])
      .fill(color)
      .stroke({ color: 0xd8e3cc, width: 1 });
    g.ellipse(-4, -5, 3, 4)
      .fill(0x233c37)
      .ellipse(4, -5, 3, 4)
      .fill(0x233c37)
      .circle(-4, -6, 1)
      .fill(0xf1e9bb)
      .circle(4, -6, 1)
      .fill(0xf1e9bb)
      .poly([-2, 0, 2, 0, 0, 3])
      .fill(0xe6bb75);
    g.moveTo(-6, 5).lineTo(-6, 9).moveTo(5, 5).lineTo(5, 9).stroke({ color, width: 2 });
    if (id === 'goblin') {
      g.roundRect(-14, -4, 10, 16, 3).fill(0x7c6944).stroke({ color: 0xc7b77e, width: 1 });
      g.moveTo(-14, 0).lineTo(-5, 0).stroke({ color: 0xdfcd8d, width: 1 });
    }
    if (id === 'dragon') {
      for (const side of [-1, 1])
        g.poly([side * 8, -8, side * 22, -20, side * 27, -4, side * 17, -8, side * 10, 2])
          .fill(0x679fb5)
          .stroke({ color: 0xb2d9df, width: 1 });
      g.moveTo(0, 6).bezierCurveTo(20, 16, 28, 2, 22, -1).stroke({ color: 0x8cc5cf, width: 3 });
    }
    if (id === 'imp') {
      g.poly([-8, -10, -12, -26, -3, -15])
        .fill(0xd0bd8d)
        .poly([8, -10, 12, -26, 3, -15])
        .fill(0xd0bd8d);
      g.moveTo(9, 4).bezierCurveTo(28, 13, 24, -4, 21, -2).stroke({ color: 0xba7254, width: 2 });
    }
    if (id === 'fox') {
      g.poly([5, 2, 22, -7, 28, -4, 26, 8, 12, 11])
        .fill(0xd4c2b9)
        .stroke({ color: 0xf0e5ce, width: 1 });
      g.poly([22, -7, 28, -4, 26, 3, 21, 2]).fill(0xf0e7da);
    }
    if (id === 'wisp') {
      g.clear()
        .poly([0, -20, 8, -9, 6, 4, 0, 12, -7, 4, -9, -8])
        .fill({ color: 0xb4e1c0, alpha: 0.6 })
        .poly([0, -12, 3, -3, 0, 5, -3, -3])
        .fill(0xe7f5d8);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        g.moveTo(Math.cos(a) * 10, Math.sin(a) * 10 - 5)
          .lineTo(Math.cos(a) * 17, Math.sin(a) * 17 - 5)
          .stroke({ color: 0x93bba4, alpha: 0.4, width: 1 });
      }
    }
    this.pet.addChild(g);
    this.pet.position.set(-38, 32);
    this.entityLayer.addChild(this.pet);
    if (this.config.classId === 'ranger' && this.learned('raven'))
      for (let i = 0; i < 2; i++) {
        const raven = new Graphics()
          .poly([
            -3, 0, -24, -14, -16, -1, -23, 3, -8, 7, 0, 2, 8, 7, 23, 3, 16, -1, 24, -14, 3, 0, 0,
            -7,
          ])
          .fill(0x34414c)
          .stroke({ color: 0xa5bbc0, width: 0.7 })
          .poly([-2, -6, 0, -11, 3, -6, 6, -4, 2, -3])
          .fill(0x829097);
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
    this.summons.forEach((s, i) => {
      const a = this.elapsed * 0.4 + (i / this.summons.length) * Math.PI * 2;
      const target = this.enemies.find((e) => e.hp > 0 && this.distance(e) < 320);
      const warrior = i < 6 || i >= 10;
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
      const rig = new CharacterRig(i >= 6 && i < 10 ? 'sorcerer' : 'necromancer');
      rig.scale.set(0.45);
      rig.alpha = 0.65;
      rig.tint = i >= 6 && i < 10 ? 0xb4cdce : 0xc1c4aa;
      this.entityLayer.addChild(rig);
      this.summons.push(rig);
    }
  }
  private createPylons() {
    const shuffled = [...PYLONS].sort(() => this.random() - 0.5).slice(0, 2);
    this.pylons = shuffled.map((p, i) => {
      const view = new Container(),
        g = new Graphics(),
        color = Number.parseInt(p.color.slice(1), 16);
      const x = i === 0 ? -170 : 190,
        y = i === 0 ? -150 : 150;
      g.ellipse(0, 7, 30, 11)
        .stroke({ color, alpha: 0.6, width: 2 })
        .poly([-14, 0, -14, -15, -8, -22, -8, -52, 0, -66, 8, -52, 8, -22, 14, -15, 14, 0])
        .fill(0x4e5860)
        .stroke({ color: 0xabb4a2, width: 1 });
      g.poly([0, -84, 8, -68, 0, -53, -8, -68]).fill(color).stroke({ color: 0xf0e6c8, width: 1 });
      g.moveTo(0, -84).lineTo(0, -180).stroke({ color, alpha: 0.2, width: 16 });
      g.moveTo(0, -84).lineTo(0, -180).stroke({ color, alpha: 0.6, width: 1 });
      view.addChild(g);
      const label = new Text({
        text: p.name,
        style: { fontFamily: 'serif', fontSize: 12, fill: color },
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
    if (this.paused || this.finished) return;
    const p = this.pylons.find((p) => p.id === id);
    if (!p || p.used) return;
    if (this.distance(p) > 190) {
      this.numbers.show(this.x, this.y, '靠近圣坛后激活', false, 0xc7bd9f);
      return;
    }
    p.used = true;
    p.view.alpha = 0.4;
    const def = PYLONS.find((d) => d.id === id)!;
    this.buffs.add(id, def.name, 25 * (1 + this.power('nemesis')), def.color);
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
          if (i < 6 || i >= 10) {
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
    if (this.set('inarius', 2)) {
      const s = this.skill('bone_spear');
      if (s) this.area(this.x, this.y, 150, s, 0.4);
      this.vfx.ring(this.x, this.y, 0xc5d7b1, 150);
    }
  }
  private finish(won: boolean) {
    if (this.finished || this.config.training) return;
    this.finished = true;
    this.callbacks.onSound(won ? 'victory' : 'defeat');
    this.emit();
    this.callbacks.onFinish({
      won,
      stage: this.config.stage,
      seconds: Math.min(300, this.elapsed),
      kills: this.kills,
      gold: this.gold,
      shards: this.shards,
      items: this.earned,
    });
  }
  private emit() {
    if (!this.callbacks) return;
    const boss = this.enemies.find((e) => e.boss && e.hp > 0);
    const snapshot: CombatSnapshot = {
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
      pylons: this.pylons.map(({ id, name, used }) => ({ id, name, used })),
      fps: Math.round(this.fps),
    };
    this.callbacks.onSnapshot(snapshot);
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver?.disconnect();
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
