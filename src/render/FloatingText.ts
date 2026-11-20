import { BitmapFont, BitmapText, Container, Text } from 'pixi.js';
import { formatBigNumber } from '../core/format';

const damageFont = 'MistCombatDigits';
const fontFamily = 'Consolas, monospace';
const stroke = { color: 0x101b20, width: 3 };
const numberLabel = /^[−+\-]?\d[0-9.e+\-万亿兆京]*$/;
let installed = false;

interface Label {
  view: BitmapText | Text;
  age: number;
  life: number;
  y: number;
  vy: number;
  priority: number;
  targetId?: number;
  value?: number;
  color: number;
}

export class FloatingText {
  private active: Label[] = [];
  private numbers: BitmapText[] = [];
  private labels: Text[] = [];

  constructor(
    private layer: Container,
    private mode: 'all' | 'critical' | 'off' = 'all',
    private render = true,
  ) {}

  show(
    x: number,
    y: number,
    value: number | string,
    critical = false,
    color?: number,
    targetId?: number,
  ) {
    if (!this.render) return;
    const numeric = typeof value === 'number' || numberLabel.test(value);
    if (numeric && (this.mode === 'off' || (this.mode === 'critical' && !critical))) return;
    const ink = color ?? (critical ? 0xf2cf83 : 0xdce5dc);
    const injury = typeof value === 'string' && value.startsWith('−');
    const priority = !numeric ? 3 : injury ? 2 : critical ? 1 : 0;

    // Only coalesce the same enemy and display class. Player feedback and nearby enemies stay distinct.
    if (targetId !== undefined && typeof value === 'number') {
      const prior = this.active.find(
        (entry) =>
          entry.targetId === targetId &&
          entry.age < 0.11 &&
          entry.priority === priority &&
          entry.color === ink,
      );
      if (prior?.value !== undefined) {
        prior.value += value;
        prior.view.text = formatBigNumber(prior.value);
        return;
      }
    }

    if (this.active.length >= 34) {
      let replace = -1;
      let lowerPriority = priority;
      for (const [index, entry] of this.active.entries()) {
        if (entry.priority >= lowerPriority) continue;
        lowerPriority = entry.priority;
        replace = index;
      }
      if (replace === -1) return;
      this.release(replace);
    }
    const view = numeric ? this.damageLabel() : this.noticeLabel();
    view.text = typeof value === 'number' ? formatBigNumber(value) : value;
    view.tint = ink;
    view.anchor.set(0.5);
    const startY = y - (critical ? 32 : 23);
    view.position.set(
      Math.round(x + (targetId === undefined ? 0 : critical ? 8 : -6)),
      Math.round(startY),
    );
    view.alpha = 1;
    view.scale.set(critical ? 1.18 : numeric ? 0.87 : 1);
    this.layer.addChild(view);
    this.active.push({
      view,
      priority,
      targetId,
      value: typeof value === 'number' ? value : undefined,
      color: ink,
      age: 0,
      life: numeric ? (critical ? 0.66 : 0.47) : 0.86,
      vy: critical ? -41 : -29,
      y: startY,
    });
  }

  private damageLabel() {
    if (!installed) {
      BitmapFont.install({
        name: damageFont,
        chars: ' 0123456789−+-.e万亿兆京',
        skipKerning: true,
        style: { fontFamily, fontSize: 18, fontWeight: 'bold', fill: 0xffffff, stroke },
      });
      installed = true;
    }
    return (
      this.numbers.pop() ??
      new BitmapText({ text: '', style: { fontFamily: damageFont, fontSize: 18 } })
    );
  }

  private noticeLabel() {
    return (
      this.labels.pop() ??
      new Text({
        text: '',
        style: { fontFamily, fontSize: 14, fontWeight: 'bold', fill: 0xffffff, stroke },
      })
    );
  }

  private release(index: number) {
    const [{ view }] = this.active.splice(index, 1);
    view.removeFromParent();
    if (view instanceof BitmapText) this.numbers.push(view);
    else this.labels.push(view);
  }

  tick(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const entry = this.active[i];
      entry.age += dt;
      if (entry.age >= entry.life) {
        this.release(i);
        continue;
      }
      entry.y += entry.vy * dt;
      entry.view.y = Math.round(entry.y);
      entry.view.alpha = Math.min(1, (entry.life - entry.age) * 4.4);
    }
  }

  destroy() {
    for (const { view } of this.active) view.destroy();
    for (const view of this.labels) view.destroy();
    for (const view of this.numbers) view.destroy();
    this.active.length = this.labels.length = this.numbers.length = 0;
  }
}
