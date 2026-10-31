import { Container, Text } from 'pixi.js';
import { formatBigNumber } from '../engine/CombatSystem';
export class FloatingText {
  private active: { view: Text; age: number; life: number; vy: number }[] = [];
  private pool: Text[] = [];
  constructor(private layer: Container) {}
  show(x: number, y: number, value: number | string, critical = false, color?: number) {
    if (this.active.length > 65) return;
    const view =
      this.pool.pop() ??
      new Text({
        text: '',
        style: {
          fontFamily: 'Georgia, serif',
          fontSize: 15,
          fontWeight: 'bold',
          fill: 0xf3eadb,
          stroke: { color: 0x101b20, width: 3 },
        },
      });
    view.text = typeof value === 'number' ? formatBigNumber(value) : value;
    view.style.fill = color ?? (critical ? 0xf2cf83 : 0xdce5dc);
    view.style.fontSize = critical ? 22 : 15;
    view.anchor.set(0.5);
    view.position.set(x + (Math.random() - 0.5) * 18, y - 25);
    view.alpha = 1;
    view.scale.set(critical ? 1.2 : 1);
    this.layer.addChild(view);
    this.active.push({ view, age: 0, life: 0.85, vy: critical ? -44 : -32 });
  }
  tick(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      e.age += dt;
      e.view.y += e.vy * dt;
      e.view.alpha = Math.min(1, (e.life - e.age) * 3);
      e.view.scale.set(Math.max(1, e.view.scale.x - dt));
      if (e.age >= e.life) {
        e.view.removeFromParent();
        this.pool.push(e.view);
        this.active.splice(i, 1);
      }
    }
  }
  destroy() {
    for (const v of this.pool) v.destroy();
    this.pool = [];
  }
}
