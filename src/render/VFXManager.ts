import { Container, Graphics, Sprite } from 'pixi.js';
import { getSkillTexture } from './SkillTextures';
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
  constructor(private layer: Container) {}
  private add<T extends Container>(view: T, life: number, update: (view: T, t: number) => void) {
    if (this.effects.length > 180) this.effects.shift()?.view.destroy();
    this.layer.addChild(view);
    this.effects.push({ view, age: 0, life, update: (t) => update(view, t) });
  }
  signature(id: string, x: number, y: number) {
    const texture = getSkillTexture(id);
    if (!texture) return;
    const glyph = new Sprite(texture);
    glyph.anchor.set(0.5);
    glyph.position.set(Math.round(x), Math.round(y - 65));
    glyph.width = glyph.height = 32;
    this.add(glyph, 0.42, (view, t) => {
      view.alpha = Math.sin(Math.PI * t) * 0.8;
      view.y = Math.round(y - 65 - t * 12);
    });
  }
  burst(x: number, y: number, color: number, count = 10, large = false) {
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
    const g = new Graphics();
    g.position.set(Math.round(x), Math.round(y));
    this.add(g, 0.55, (v, t) => {
      v.clear();
      pixelEllipse(v, 0, 0, radius * t, radius * t * 0.65, color, 4, 1 - t, true);
      pixelEllipse(v, 0, 0, radius * t * 0.7, radius * t * 0.45, color, 3, (1 - t) * 0.6, true);
    });
  }
  slash(x: number, y: number, angle: number, color: number, radius = 65) {
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
