import { Container, Graphics, Sprite } from 'pixi.js';
import { getEffectTexture, getSkillTexture } from './SkillTextures';
import type { SkillDef } from '../core/types';
import type { CombatEffectCue } from '../core/coop';
import type { EffectArt } from '../data/skillArt';
import { pixelEllipse, pixelLine, pixelPolygon, snapPixel } from './PixelArt';
export const ELEMENT_COLORS: Record<string, number> = {
  physical: 0xe4d6ac,
  fire: 0xffa45c,
  ice: 0x9ce4f2,
  lightning: 0xcbbeff,
  arcane: 0xbb98ec,
  poison: 0xaedb79,
};
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
  ) {}
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
    if (this.effects.length > 180) this.effects.shift()?.view.destroy();
    this.layer.addChild(view);
    this.effects.push({ view, age: 0, life, update: (t) => update(view, t) });
  }
  signature(skill: SkillDef, x: number, y: number, angle: number, tx: number, ty: number) {
    // Flying missiles and persistent ground spells carry their own artwork on the actual entity.
    if (
      [
        'homing',
        'explosive',
        'multishot',
        'elemental',
        'spear',
        'orb',
        'boomerang',
        'rain',
        'meteor',
        'blackhole',
        'vines',
        'whirlwind',
      ].includes(skill.effect)
    )
      return;
    const texture = getSkillTexture(skill.id);
    if (!texture) return;
    const glyph = new Sprite(texture);
    glyph.anchor.set(0.5);
    const directed = [
      'frenzy',
      'bash',
      'hammer',
      'scythe',
      'spike',
      'claw',
      'fan',
      'pull',
    ].includes(skill.effect);
    const targeted = ['siphon', 'chain', 'curse'].includes(skill.effect);
    const size = skill.kind === 'ultimate' ? 138 : skill.kind === 'basic' ? 65 : 96;
    glyph.position.set(
      targeted ? tx : x + (directed ? Math.cos(angle) * 34 : 0),
      (targeted ? ty : y + (directed ? Math.sin(angle) * 34 : 0)) - 20,
    );
    if (directed) glyph.rotation = angle;
    glyph.width = glyph.height = size;
    this.add(glyph, skill.kind === 'basic' ? 0.24 : 0.48, (view, t) => {
      view.alpha = Math.min(1, (1 - t) * 2);
      view.width = view.height = size * (0.75 + t * 0.4);
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
    const diameter = large ? 110 : 22 + count * 2;
    if (
      this.stamp(
        heal ? 'heal' : 'burst',
        x,
        y,
        color,
        diameter,
        diameter,
        heal ? 0 : Math.random() * Math.PI,
        0.38,
        (v, t) => {
          v.width = v.height = diameter * (0.55 + t * 0.75);
          v.alpha = 1 - t;
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
