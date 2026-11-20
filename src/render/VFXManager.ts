import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { CombatEffectCue } from '../core/coop';
import type { SkillDef } from '../core/types';
import { getEffectTexture, getSkillTexture } from './SkillTextures';

export const ELEMENT_COLORS: Record<string, number> = {
  physical: 0xe3cfaa,
  fire: 0xeaa068,
  ice: 0xa5d7dd,
  lightning: 0xbbcbe7,
  arcane: 0xc3a4d4,
  poison: 0xa9be7e,
};
const entityEffects = new Set([
  'homing',
  'explosive',
  'elemental',
  'spear',
  'orb',
  'boomerang',
  'rain',
  'meteor',
  'blackhole',
  'vines',
  'whirlwind',
]);
const directionalEffects = new Set([
  'frenzy',
  'bash',
  'hammer',
  'scythe',
  'spike',
  'claw',
  'fan',
  'pull',
  'multishot',
]);
const targetedEffects = new Set(['siphon', 'chain', 'curse', 'raven']);

type View = Sprite | Graphics;
interface Effect {
  view: View;
  age: number;
  life: number;
  important: boolean;
  update: (t: number) => void;
}
interface Spark {
  view: Sprite;
  life: number;
  age: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
}

export class VFXManager {
  private effects: Effect[] = [];
  private sparks: Spark[] = [];
  private sprites: Sprite[] = [];
  private graphics: Graphics[] = [];
  private recent = new Map<string, number>();
  private clock = 0;

  constructor(
    private layer: Container,
    private record?: (cue: CombatEffectCue) => void,
    private density: 'full' | 'reduced' | 'off' = 'full',
  ) {
    if (density === 'full' && globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
      this.density = 'reduced';
  }

  replay(cue: CombatEffectCue) {
    const { x, y, color } = cue;
    switch (cue.kind) {
      case 'burst':
        return this.burst(x, y, color, cue.count, cue.large, cue.heal);
      case 'ring':
        return this.ring(x, y, color, cue.radius);
      case 'slash':
        return this.slash(x, y, cue.angle, color, cue.radius);
      case 'lightning':
        return this.lightning(x, y, cue.tx, cue.ty, color);
      case 'meteor':
        return this.meteor(x, y, color, cue.radius);
    }
  }

  private sprite(
    texture: Texture,
    x: number,
    y: number,
    width: number,
    height: number,
    tint = 0xffffff,
  ) {
    const view = this.sprites.pop() ?? new Sprite();
    view.texture = texture;
    view.anchor.set(0.5);
    view.position.set(x, y);
    view.width = width;
    view.height = height;
    view.tint = tint;
    view.rotation = 0;
    view.alpha = 1;
    return view;
  }

  private graphic(x: number, y: number) {
    const view = this.graphics.pop() ?? new Graphics();
    view.position.set(x, y);
    view.scale.set(1);
    view.rotation = 0;
    view.alpha = 1;
    return view;
  }

  private recycle(view: View) {
    view.removeFromParent();
    if (view instanceof Graphics) {
      view.clear();
      this.graphics.push(view);
    } else this.sprites.push(view);
  }

  private add<T extends View>(
    view: T,
    life: number,
    important: boolean,
    update: (view: T, t: number) => void,
  ) {
    if (this.effects.length >= (this.density === 'full' ? 64 : 24)) {
      const index = this.effects.findIndex((effect) => important || !effect.important);
      if (index < 0) {
        this.recycle(view);
        return;
      }
      this.recycle(this.effects[index].view);
      this.effects.splice(index, 1);
    }
    update(view, 0);
    this.layer.addChild(view);
    this.effects.push({ view, age: 0, life, important, update: (t) => update(view, t) });
  }

  /** Coalesce nearby decoration from simultaneous strikes without losing threat telegraphs. */
  private accept(key: string, x: number, y: number, gap: number) {
    const cell = `${key}:${Math.floor(x / 24)}:${Math.floor(y / 24)}`;
    if ((this.recent.get(cell) ?? -1) > this.clock) return false;
    if (this.recent.size >= 160) this.recent.delete(this.recent.keys().next().value!);
    this.recent.set(cell, this.clock + gap);
    return true;
  }

  private publish(cue: CombatEffectCue, gap: number, key: string = cue.kind, x = cue.x, y = cue.y) {
    if ((!this.record && this.density === 'off') || !this.accept(key, x, y, gap)) return false;
    this.record?.(cue);
    return this.density !== 'off';
  }

  signature(skill: SkillDef, x: number, y: number, angle: number, tx: number, ty: number) {
    if (this.density === 'off' || (this.density === 'reduced' && skill.kind === 'basic')) return;
    // Flying missiles and persistent ground spells carry their artwork on the entity.
    if (entityEffects.has(skill.effect)) return;
    const texture = getSkillTexture(skill.id);
    if (!texture || !this.accept(skill.id, x, y, 0.075)) return;
    const travel = skill.kind === 'movement' && skill.effect !== 'teleport';
    const directed = travel || directionalEffects.has(skill.effect);
    const targeted = targetedEffects.has(skill.effect);
    const ritual = skill.kind === 'ultimate' || skill.kind === 'defense';
    const size = ritual ? 92 : skill.kind === 'basic' ? 49 : 68;
    const dx = directed ? Math.cos(angle) : 0;
    const dy = directed ? Math.sin(angle) : 0;
    const startX = targeted ? tx : x + dx * 23;
    const startY = (targeted ? ty : y + dy * 23) - (ritual ? 22 : 13);
    const glyph = this.sprite(texture, startX, startY, size, directed ? size * 0.7 : size);
    glyph.rotation = directed ? angle : 0;
    const life = ritual ? 0.38 : travel ? 0.28 : 0.21;
    this.add(glyph, life, ritual || travel, (view, t) => {
      const advance = 1 - (1 - t) ** 2;
      const slide = travel ? -29 : 13;
      view.position.set(startX + dx * slide * advance, startY + dy * slide * advance);
      view.alpha = (this.density === 'full' ? 0.6 : 0.48) * (1 - t) ** 1.55;
      if (directed && !travel) view.rotation = angle - 0.22 + advance * 0.46;
    });
  }

  private emitSparks(
    x: number,
    y: number,
    color: number,
    count: number,
    reach: number,
    lift = false,
  ) {
    const budget = this.density === 'full' ? 100 : 26;
    const total = Math.min(count, budget - this.sparks.length);
    const phase = this.clock * 17 + x * 0.11 + y * 0.07;
    for (let i = 0; i < total; i++) {
      const heading = phase + i * 2.39996;
      const speed = reach * (0.56 + (i % 3) * 0.23);
      const size = 1.5 + (i % 3);
      const vx = Math.cos(heading) * speed * (lift ? 0.45 : 1);
      const vy = lift ? -26 - speed * 0.45 : Math.sin(heading) * speed * 0.62 - 8;
      const view = this.sprite(Texture.WHITE, x, y, size * 1.35, size, color);
      view.rotation = Math.atan2(vy, vx);
      view.alpha = 0.83;
      this.layer.addChild(view);
      this.sparks.push({
        view,
        x,
        y,
        vx,
        vy,
        age: 0,
        life: 0.16 + (i % 4) * 0.035,
        gravity: lift ? 4 : 45,
      });
    }
  }

  burst(x: number, y: number, color: number, count = 10, large = false, heal = false) {
    const key = heal ? 'heal' : `hit:${color}:${large}`;
    if (!this.publish({ kind: 'burst', x, y, color, count, large, heal }, 0.075, key)) return;
    const n = Math.min(count, this.density === 'full' ? (large ? 12 : 7) : 3);
    this.emitSparks(x, y, color, n, large ? 144 : 87, heal);
    if (!heal && !large && count < 5) return;
    const texture = getEffectTexture(heal ? 'heal' : 'burst');
    if (!texture) return;
    const size = heal ? 32 : large ? 39 : 21;
    const core = this.sprite(texture, x, y, size, size, color);
    this.add(core, heal ? 0.32 : 0.13, heal, (view, t) => {
      view.alpha = (heal ? 0.57 : 0.51) * (1 - t) ** 2;
      if (heal) view.y = y - t * 14;
    });
  }

  ring(x: number, y: number, color: number, radius = 80) {
    if (!this.publish({ kind: 'ring', x, y, color, radius }, 0.095, `pulse:${color}`)) return;
    const r = Math.max(8, Math.min(172, radius));
    const view = this.graphic(x, y);
    view.ellipse(0, 0, r, r * 0.65).stroke({ width: 2.2, color, alpha: 0.76 });
    this.add(view, 0.26, false, (edge, t) => {
      edge.scale.set(0.38 + 0.62 * (1 - (1 - t) ** 2));
      edge.alpha = (1 - t) ** 1.7 * 0.62;
    });
  }

  slash(x: number, y: number, angle: number, color: number, radius = 65) {
    const key = `slash:${color}:${Math.round(angle * 3)}`;
    if (!this.publish({ kind: 'slash', x, y, color, angle, radius }, 0.065, key)) return;
    const r = Math.max(12, Math.min(160, radius));
    const view = this.graphic(x, y);
    const points: number[] = [];
    for (let side = 0; side < 2; side++)
      for (let i = 0; i <= 9; i++) {
        const arc = (side ? 9 - i : i) / 9;
        const theta = -0.7 + arc * 1.4;
        const reach = r - (side ? Math.sin(arc * Math.PI) * Math.min(7, r * 0.13) : 0);
        points.push(Math.cos(theta) * reach, Math.sin(theta) * reach);
      }
    view.poly(points).fill({ color, alpha: 0.8 });
    this.add(view, 0.19, true, (edge, t) => {
      const follow = 1 - (1 - t) ** 3;
      edge.rotation = angle + (this.density === 'full' ? (follow - 0.5) * 0.55 : 0);
      edge.alpha = (1 - t) ** 1.45;
    });
  }

  lightning(x: number, y: number, tx: number, ty: number, color = 0xc3b3ff) {
    const length = Math.hypot(tx - x, ty - y);
    if (
      length < 1 ||
      !this.publish({ kind: 'lightning', x, y, tx, ty, color }, 0.065, `bolt:${color}`, tx, ty)
    )
      return;
    const view = this.graphic(x, y);
    view.rotation = Math.atan2(ty - y, tx - x);
    const points = [0, 0];
    const segments = Math.ceil(Math.min(7, 2 + length / 46));
    for (let i = 1; i < segments; i++)
      points.push(
        (length * i) / segments,
        Math.sin(i * 2.1 + this.clock * 16) * Math.min(6, length * 0.1),
      );
    points.push(length, 0);
    for (const [width, ink, alpha] of [
      [5, color, 0.43],
      [1.65, 0xf5ead7, 0.75],
    ]) {
      view.moveTo(0, 0);
      for (let i = 2; i < points.length; i += 2) view.lineTo(points[i], points[i + 1]);
      view.stroke({ width, color: ink, alpha });
    }
    this.add(view, 0.15, true, (edge, t) => {
      edge.alpha = (1 - t) ** 1.6;
    });
  }

  meteor(x: number, y: number, color: number, radius: number) {
    if (!this.publish({ kind: 'meteor', x, y, color, radius }, 0.085)) return;
    const authored = color === ELEMENT_COLORS.fire ? getSkillTexture('meteor') : undefined;
    const texture = authored ?? getEffectTexture('meteor');
    if (texture) {
      const size = Math.max(39, Math.min(70, radius * 0.52));
      const ember = this.sprite(texture, x, y, size, size, authored ? 0xffffff : color);
      this.add(ember, 0.17, true, (view, t) => {
        // Damage has already landed. The taper collapses into the strike point.
        view.position.set(x - 22 * (1 - t), y - 28 * (1 - t));
        view.alpha = 0.72 * (1 - t) ** 1.65;
      });
    }
    this.emitSparks(x, y, color, this.density === 'full' ? 9 : 3, 161);
  }

  tick(dt: number) {
    this.clock += dt;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];
      effect.age += dt;
      if (effect.age >= effect.life) {
        this.recycle(effect.view);
        this.effects.splice(i, 1);
      } else effect.update(effect.age / effect.life);
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const spark = this.sparks[i];
      spark.age += dt;
      if (spark.age >= spark.life) {
        this.recycle(spark.view);
        this.sparks.splice(i, 1);
        continue;
      }
      spark.view.position.set(
        Math.round(spark.x + spark.vx * spark.age),
        Math.round(spark.y + spark.vy * spark.age + spark.gravity * spark.age ** 2),
      );
      spark.view.alpha = 0.83 * (1 - spark.age / spark.life) ** 1.4;
    }
  }

  destroy() {
    for (const { view } of this.effects) view.destroy();
    for (const { view } of this.sparks) view.destroy();
    for (const view of this.sprites) view.destroy();
    for (const view of this.graphics) view.destroy();
    this.effects.length = this.sparks.length = this.sprites.length = this.graphics.length = 0;
    this.recent.clear();
  }
}
