import { Container, Graphics, Sprite } from 'pixi.js';
import { getEffectTexture, getSkillTexture } from './SkillTextures';
import type { SkillDef } from '../core/types';
import type { CombatEffectCue } from '../core/coop';
import type { EffectArt } from '../data/skillArt';
import { pixelEllipse, pixelLine, pixelPolygon, snapPixel } from './PixelArt';
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
interface Effect {
  view: Container;
  age: number;
  life: number;
  update: (t: number) => void;
}
export class VFXManager {
  private effects: Effect[] = [];
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
  private add<T extends Container>(view: T, life: number, update: (view: T, t: number) => void) {
    if (this.effects.length >= (this.density === 'full' ? 180 : 40))
      this.effects.shift()?.view.destroy();
    this.layer.addChild(view);
    this.effects.push({ view, age: 0, life, update: (t) => update(view, t) });
  }
  signature(skill: SkillDef, x: number, y: number, angle: number, tx: number, ty: number) {
    if (this.density === 'off' || (this.density === 'reduced' && skill.kind === 'basic')) return;
    // Flying missiles and persistent ground spells carry their own artwork on the actual entity.
    if (entityEffects.has(skill.effect)) return;
    const texture = getSkillTexture(skill.id);
    if (!texture) return;
    const glyph = new Sprite(texture);
    glyph.anchor.set(0.5);
    const travel = skill.kind === 'movement' && skill.effect !== 'teleport';
    const directed = travel || directionalEffects.has(skill.effect);
    const targeted = targetedEffects.has(skill.effect);
    const ritual = skill.kind === 'ultimate' || skill.kind === 'defense';
    const size = ritual ? 134 : skill.kind === 'basic' ? 67 : 98;
    const dx = directed ? Math.cos(angle) : 0;
    const dy = directed ? Math.sin(angle) : 0;
    const offset = directed ? 31 : 0;
    const startX = targeted ? tx : x + dx * offset;
    const startY = (targeted ? ty : y + dy * offset) - (ritual ? 29 : 16);
    glyph.position.set(startX, startY);
    glyph.rotation = directed ? angle : 0;
    glyph.width = glyph.height = size * 0.68;
    const life = ritual ? 0.66 : travel ? 0.37 : skill.kind === 'basic' ? 0.23 : 0.41;
    this.add(glyph, life, (view, t) => {
      const sweep = 1 - (1 - t) ** 2;
      const retreat = travel ? -37 : 16;
      view.position.set(startX + dx * retreat * sweep, startY + dy * retreat * sweep);
      view.alpha = Math.min(1, t * 12) * (1 - t) ** (ritual ? 0.8 : 1.3);
      view.width = size * (0.68 + sweep * (travel ? 0.76 : 0.46));
      view.height = size * (0.68 + sweep * (travel ? 0.12 : 0.46));
      if (directed && !travel) view.rotation = angle - 0.19 + 0.46 * sweep;
    });
  }
  private stamp(
    art: EffectArt,
    x: number,
    y: number,
    color: number,
    width: number,
    height: number,
    angle: number,
    life: number,
    animate: (view: Sprite, t: number) => void,
  ) {
    const authoredMeteor =
      art === 'meteor' && color === ELEMENT_COLORS.fire ? getSkillTexture('meteor') : undefined;
    const texture = authoredMeteor ?? getEffectTexture(art);
    if (!texture) return false;
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.position.set(x, y);
    sprite.tint = authoredMeteor ? 0xffffff : color;
    sprite.width = width;
    sprite.height = height;
    sprite.rotation = angle;
    this.add(sprite, life, animate);
    return true;
  }
  burst(x: number, y: number, color: number, count = 10, large = false, heal = false) {
    this.record?.({ kind: 'burst', x, y, color, count, large, heal });
    if (this.density === 'off') return;
    if (this.density === 'reduced') count = Math.min(4, count);
    const diameter = large ? 110 : 22 + count * 2;
    const art = heal
      ? 'heal'
      : color === ELEMENT_COLORS.ice
        ? 'frostfield'
        : color === ELEMENT_COLORS.poison
          ? 'vortex'
          : color === ELEMENT_COLORS.lightning
            ? 'lightning'
            : 'burst';
    if (
      this.stamp(
        art,
        x,
        y,
        color,
        diameter,
        diameter,
        heal || art === 'frostfield' ? 0 : Math.random() * Math.PI,
        heal ? 0.44 : 0.3,
        (v, t) => {
          const release = 1 - (1 - t) ** 2;
          v.width = diameter * (0.42 + release * 0.78);
          v.height = v.width * (heal ? 1.1 : art === 'lightning' ? 0.55 : 1);
          v.y = y - (heal ? release * 20 : 0);
          v.alpha = (1 - t) ** 1.5;
        },
      )
    )
      return;
    const g = new Graphics();
    g.position.set(Math.round(x), Math.round(y));
    const pieces = Array.from({ length: count }, (_, i) => ({
      a: (i / count) * Math.PI * 2 + Math.random() * 0.3,
      d: 20 + Math.random() * (large ? 100 : 35),
    }));
    this.add(g, 0.5, (v, t) => {
      v.clear();
      for (const p of pieces) {
        const px = snapPixel(Math.cos(p.a) * p.d * t),
          py = snapPixel(Math.sin(p.a) * p.d * t);
        const size = large ? 6 : 3;
        v.rect(px, py, size, size).fill({ color, alpha: 1 - t });
        if (t < 0.4) v.rect(px, py, 3, 3).fill(0xfff2d2);
      }
    });
  }
  ring(x: number, y: number, color: number, radius = 80) {
    this.record?.({ kind: 'ring', x, y, color, radius });
    if (this.density === 'off') return;
    if (
      this.stamp('ring', x, y, color, 1, 1, 0, 0.55, (v, t) => {
        v.width = 2 * radius * t;
        v.height = radius * 1.3 * t;
        v.alpha = 0.85 * (1 - t);
      })
    )
      return;
    const g = new Graphics();
    g.position.set(Math.round(x), Math.round(y));
    this.add(g, 0.55, (v, t) => {
      v.clear();
      pixelEllipse(v, 0, 0, radius * t, radius * t * 0.65, color, 4, 1 - t, true);
      pixelEllipse(v, 0, 0, radius * t * 0.7, radius * t * 0.45, color, 3, (1 - t) * 0.6, true);
    });
  }
  slash(x: number, y: number, angle: number, color: number, radius = 65) {
    this.record?.({ kind: 'slash', x, y, color, angle, radius });
    if (this.density === 'off') return;
    if (
      this.stamp('slash', x, y, color, radius * 2, radius * 2, angle - 0.35, 0.25, (v, t) => {
        v.rotation = angle - 0.35 + t * 0.7;
        v.alpha = 1 - t;
      })
    )
      return;
    const g = new Graphics();
    g.position.set(Math.round(x), Math.round(y));
    this.add(g, 0.25, (v, t) => {
      v.clear();
      const r = radius * (0.5 + t * 0.5);
      // Arc cells are positioned directly, keeping the pixel grid upright at any strike angle.
      for (let a = -0.8; a < 1; a += 4 / r) {
        const xx = Math.cos(a + angle) * r,
          yy = Math.sin(a + angle) * r;
        v.rect(snapPixel(xx), snapPixel(yy), t < 0.5 ? 6 : 3, t < 0.5 ? 6 : 3).fill({
          color,
          alpha: 1 - t,
        });
        if (a > -0.4 && a < 0.6)
          v.rect(snapPixel(xx * 0.9), snapPixel(yy * 0.9), 3, 3).fill({
            color: 0xfff3d8,
            alpha: 1 - t,
          });
      }
    });
  }
  lightning(x: number, y: number, tx: number, ty: number, color = 0xc3b3ff) {
    this.record?.({ kind: 'lightning', x, y, tx, ty, color });
    if (this.density === 'off') return;
    const length = Math.hypot(tx - x, ty - y);
    if (
      this.stamp(
        'lightning',
        (x + tx) / 2,
        (y + ty) / 2,
        color,
        length,
        Math.min(72, 16 + length * 0.2),
        Math.atan2(ty - y, tx - x),
        0.18,
        (v, t) => {
          v.alpha = 1 - t;
        },
      )
    )
      return;
    const g = new Graphics();
    let px = x,
      py = y;
    for (let i = 1; i <= 7; i++) {
      const t = i / 7;
      const xx = x + (tx - x) * t + (i === 7 ? 0 : (Math.random() - 0.5) * 20);
      const yy = y + (ty - y) * t + (i === 7 ? 0 : (Math.random() - 0.5) * 20);
      pixelLine(g, px, py, xx, yy, color, 6, 0.8);
      pixelLine(g, px, py, xx, yy, 0xf6eaff, 3);
      px = xx;
      py = yy;
    }
    this.add(g, 0.18, (v, t) => {
      v.alpha = 1 - t;
    });
  }
  meteor(x: number, y: number, color: number, radius: number) {
    this.record?.({ kind: 'meteor', x, y, color, radius });
    if (this.density === 'off') return;
    if (
      this.stamp('meteor', x - 72, y - 250, color, 85, 85, 0, 0.43, (v, t) => {
        v.position.set(x - 72 * (1 - t), y - 250 * (1 - t));
        v.alpha = 1 - Math.max(0, t - 0.86) * 5;
      })
    )
      return;
    const g = new Graphics();
    this.add(g, 0.65, (v, t) => {
      v.clear();
      if (t < 0.65) {
        const py = y - (1 - t / 0.65) * 250;
        pixelLine(v, x - 45, py - 72, x, py, color, 6, 0.55);
        pixelPolygon(
          v,
          [
            x - 15,
            py,
            x - 9,
            py - 24,
            x + 3,
            py - 27,
            x + 18,
            py - 6,
            x + 9,
            py + 12,
            x - 9,
            py + 9,
          ],
          color,
        );
        pixelPolygon(
          v,
          [x - 6, py - 9, x, py - 18, x + 9, py, x + 3, py + 6, x - 6, py + 3],
          0xffefb8,
        );
      } else
        pixelEllipse(
          v,
          x,
          y,
          radius * (t - 0.65) * 3,
          radius * (t - 0.65) * 2,
          color,
          6,
          1 - t,
          true,
        );
    });
  }
  tick(dt: number) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.age += dt;
      if (e.age >= e.life) {
        e.view.destroy();
        this.effects.splice(i, 1);
      } else e.update(e.age / e.life);
    }
  }
}
