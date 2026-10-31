import { Container, Graphics, Sprite } from 'pixi.js';
import { getSkillTexture } from './SkillTextures';
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
    if (this.effects.length > 180) {
      const first = this.effects.shift();
      first?.view.destroy();
    }
    this.layer.addChild(view);
    this.effects.push({ view, age: 0, life, update: (t) => update(view, t) });
  }
  signature(id: string, x: number, y: number) {
    const texture = getSkillTexture(id);
    if (!texture) return;
    const glyph = new Sprite(texture);
    glyph.anchor.set(0.5);
    glyph.position.set(x, y - 65);
    glyph.width = glyph.height = 30;
    this.add(glyph, 0.42, (view, t) => {
      view.alpha = Math.sin(Math.PI * t) * 0.8;
      view.y = y - 65 - t * 12;
    });
  }
  burst(x: number, y: number, color: number, count = 10, large = false) {
    const g = new Graphics();
    g.position.set(x, y);
    const pieces = Array.from({ length: count }, (_, i) => ({
      a: (i / count) * Math.PI * 2 + Math.random() * 0.3,
      d: 20 + Math.random() * (large ? 100 : 35),
    }));
    this.add(g, 0.5, (v, t) => {
      v.clear();
      for (const p of pieces) {
        const d = p.d * t;
        v.moveTo(Math.cos(p.a) * d, Math.sin(p.a) * d)
          .lineTo(Math.cos(p.a) * (d + 7 * (1 - t)), Math.sin(p.a) * (d + 7 * (1 - t)))
          .stroke({ color, width: large ? 3 : 2, alpha: 1 - t });
      }
    });
  }
  ring(x: number, y: number, color: number, radius = 80) {
    const g = new Graphics();
    g.position.set(x, y);
    this.add(g, 0.55, (v, t) => {
      v.clear()
        .ellipse(0, 0, radius * t, radius * t * 0.65)
        .stroke({ color, width: 3 * (1 - t) + 1, alpha: 1 - t })
        .ellipse(0, 0, radius * t * 0.7, radius * t * 0.45)
        .stroke({ color, width: 1, alpha: (1 - t) * 0.6 });
    });
  }
  slash(x: number, y: number, angle: number, color: number, radius = 65) {
    const g = new Graphics();
    g.position.set(x, y);
    g.rotation = angle;
    this.add(g, 0.25, (v, t) => {
      v.clear()
        .arc(0, 0, radius * (0.5 + t * 0.5), -0.8, 1)
        .stroke({ color, width: 10 * (1 - t) + 1, alpha: 1 - t })
        .arc(0, 0, radius * (0.4 + t * 0.5), -0.5, 0.8)
        .stroke({ color: 0xf8f7e5, width: 2, alpha: 1 - t });
    });
  }
  lightning(x: number, y: number, tx: number, ty: number, color = 0xc3b3ff) {
    const g = new Graphics();
    g.moveTo(x, y);
    for (let i = 1; i <= 7; i++) {
      const t = i / 7;
      g.lineTo(
        x + (tx - x) * t + (i === 7 ? 0 : (Math.random() - 0.5) * 20),
        y + (ty - y) * t + (i === 7 ? 0 : (Math.random() - 0.5) * 20),
      );
    }
    g.stroke({ color, width: 5, alpha: 0.25 })
      .moveTo(x, y)
      .lineTo(tx, ty)
      .stroke({ color: 0xe3dcff, width: 1.4 });
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
        v.moveTo(x - 80 * (1 - t / 0.65), py - 90)
          .lineTo(x, py)
          .stroke({ color, width: 15, alpha: 0.18 })
          .poly([x - 14, py, x, py - 25, x + 15, py - 5, x + 9, py + 11, x - 8, py + 11])
          .fill(color)
          .stroke({ color: 0xffedbd, width: 2 });
      } else {
        v.ellipse(x, y, radius * (t - 0.65) * 3, radius * (t - 0.65) * 2).stroke({
          color,
          width: 6,
          alpha: 1 - t,
        });
      }
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
