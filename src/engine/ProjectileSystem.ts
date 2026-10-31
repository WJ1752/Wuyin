import { Graphics, Container } from 'pixi.js';
import { pixelStamp } from '../render/PixelArt';
export interface CastContext {
  resourceGranted: boolean;
}
export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  radius: number;
  pierce: number;
  homing: boolean;
  returning: boolean;
  originX: number;
  originY: number;
  hits: Set<number>;
  view: Graphics;
  skillId: string;
  color: number;
  scale: number;
  multiplier: number;
  proc: boolean;
  cast?: CastContext;
}
export class ProjectileSystem {
  items: Projectile[] = [];
  constructor(private layer: Container) {}
  spawn(
    x: number,
    y: number,
    angle: number,
    color: number,
    skillId: string,
    options: Partial<Projectile> = {},
  ) {
    if (this.items.length >= 150) return;
    const view = new Graphics();
    const palette = { o: 0x20303c, c: color, h: 0xf5e9ca, b: 0x8b9c9c };
    const rows = skillId.includes('orb')
      ? [
          '...ooo...',
          '..occco..',
          '.ochhhco.',
          'ochhhhcco',
          'ochhhhcco',
          '.occhcco.',
          '..occo...',
          '...oo....',
        ]
      : skillId.includes('missile')
        ? ['.....cc...', '..ccchcc..', 'ccchhhhcc.', '..ccchcc..', '.....cc...']
        : skillId.includes('spear') || skillId.includes('splinter')
          ? ['.......h...', 'bbbhhhhhh..', 'hhhhhhhhhhh', 'bbbhhhhhh..', '.......h...']
          : skillId.includes('blade') || skillId.includes('knives')
            ? ['.....bb....', '..bbhhhb...', 'bbhhhhhhhh.', '..bbhhhbb..', '.....bb....']
            : ['......cc...', 'ccc...chc..', 'hhhhhhhhhhc', 'ccc...chc..', '......cc...'];
    pixelStamp(view, rows, palette, -18, -rows.length * 1.5, 3);
    this.layer.addChild(view);
    const p: Projectile = {
      x,
      y,
      vx: Math.cos(angle) * 520,
      vy: Math.sin(angle) * 520,
      age: 0,
      life: 1.25,
      radius: 12,
      pierce: 0,
      homing: false,
      returning: false,
      originX: x,
      originY: y,
      hits: new Set(),
      view,
      skillId,
      color,
      scale: 1,
      multiplier: 1,
      proc: true,
      ...options,
    };
    view.scale.set(p.scale);
    this.items.push(p);
  }
  tick(
    dt: number,
    targets: { id: number; x: number; y: number; hp: number; radius: number }[],
    onHit: (p: Projectile, targetId: number) => void,
    onReturn?: (p: Projectile) => void,
    onExpire?: (p: Projectile) => void,
  ) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i];
      p.age += dt;
      if (p.homing) {
        const target = targets
          .filter((t) => t.hp > 0 && !p.hits.has(t.id))
          .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
        if (target) {
          const a = Math.atan2(target.y - p.y, target.x - p.x);
          p.vx += (Math.cos(a) * 520 - p.vx) * Math.min(1, dt * 8);
          p.vy += (Math.sin(a) * 520 - p.vy) * Math.min(1, dt * 8);
        }
      }
      if (p.returning && p.age > p.life * 0.5) {
        if (p.age - dt <= p.life * 0.5) {
          p.hits.clear();
          onReturn?.(p);
        }
        const a = Math.atan2(p.originY - p.y, p.originX - p.x);
        p.vx = Math.cos(a) * 520;
        p.vy = Math.sin(a) * 520;
      }
      const oldX = p.x,
        oldY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.view.position.set(Math.round(p.x), Math.round(p.y));
      p.view.rotation = Math.atan2(p.vy, p.vx);
      for (const t of targets) {
        if (t.hp <= 0 || p.hits.has(t.id)) continue;
        const dx = p.x - oldX,
          dy = p.y - oldY;
        const u = Math.max(
          0,
          Math.min(1, ((t.x - oldX) * dx + (t.y - oldY) * dy) / (dx * dx + dy * dy || 1)),
        );
        if (Math.hypot(t.x - oldX - dx * u, t.y - oldY - dy * u) < t.radius + p.radius) {
          p.hits.add(t.id);
          onHit(p, t.id);
          if (p.hits.size > p.pierce) {
            p.age = p.life;
            break;
          }
        }
      }
      if (p.age >= p.life) {
        onExpire?.(p);
        p.view.destroy();
        this.items.splice(i, 1);
      }
    }
  }
}
