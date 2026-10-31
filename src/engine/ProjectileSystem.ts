import { Graphics, Container } from 'pixi.js';
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
    const view = new Graphics()
      .poly([-18, -2, 4, -2, 4, -5, 14, 0, 4, 5, 4, 2, -18, 2])
      .fill(color)
      .moveTo(-28, 0)
      .lineTo(8, 0)
      .stroke({ color: 0xf3f4d9, width: 1, alpha: 0.7 });
    if (skillId.includes('orb')) {
      view
        .clear()
        .circle(0, 0, 10)
        .fill({ color, alpha: 0.35 })
        .circle(0, 0, 7)
        .stroke({ color, width: 2 })
        .poly([-3, -5, 4, -3, 5, 3, -2, 6, -6, 0])
        .fill(0xdbf8f2);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        view
          .moveTo(Math.cos(a) * 10, Math.sin(a) * 10)
          .lineTo(Math.cos(a) * 15, Math.sin(a) * 15)
          .stroke({ color, width: 1 });
      }
    } else if (skillId.includes('missile')) {
      view
        .clear()
        .poly([-20, 0, 0, -6, 11, 0, 0, 6])
        .fill({ color, alpha: 0.65 })
        .poly([-8, 0, 1, -3, 7, 0, 1, 3])
        .fill(0xf4e7ff);
    } else if (skillId.includes('spear') || skillId.includes('splinter')) {
      view
        .clear()
        .moveTo(-22, 0)
        .lineTo(8, 0)
        .stroke({ color: 0xe4ddc2, width: 3 })
        .poly([4, -5, 15, 0, 4, 5, 7, 0])
        .fill(0xd9e2c9);
      for (let i = -15; i < 4; i += 6)
        view
          .moveTo(i, -3)
          .lineTo(i + 1, 3)
          .stroke({ color: 0x637c70, width: 1 });
    } else if (
      skillId.includes('knives') ||
      skillId.includes('blade') ||
      skillId === 'shatter_spear'
    ) {
      view
        .clear()
        .poly([-14, -3, 10, -4, 19, 0, 9, 4, -14, 3, -8, 0])
        .fill(0xbfcfd1)
        .stroke({ color, width: 1 })
        .moveTo(-7, 0)
        .lineTo(14, 0)
        .stroke({ color: 0xf2efdc, width: 1 });
    }
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
      p.view.position.set(p.x, p.y);
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
