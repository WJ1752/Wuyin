export const PYLONS = [
  { id: 'conduit', name: '电击圣坛', color: '#c2a7ff', description: '每 0.15 秒释放五道毁灭雷链' },
  { id: 'power', name: '威能圣坛', color: '#ffcf72', description: '最终伤害 ×3，身形增大' },
  {
    id: 'speed',
    name: '疾风圣坛',
    color: '#76eed5',
    description: '移速 +60%，攻速 +50%，冲撞眩晕',
  },
  { id: 'channeling', name: '引导圣坛', color: '#b18dff', description: '冷却缩减 80%，技能零消耗' },
] as const;
export class BuffManager {
  private values = new Map<
    string,
    { name: string; seconds: number; color: string; stacks: number }
  >();
  add(id: string, name: string, seconds: number, color = '#c8aa6e', maxStacks = 1) {
    const current = this.values.get(id);
    this.values.set(id, {
      name,
      seconds,
      color,
      stacks: Math.min(maxStacks, (current?.stacks ?? 0) + 1),
    });
  }
  remove(id: string) {
    this.values.delete(id);
  }
  has(id: string) {
    return this.values.has(id);
  }
  stacks(id: string) {
    return this.values.get(id)?.stacks ?? 0;
  }
  tick(dt: number) {
    for (const [id, buff] of this.values) {
      buff.seconds -= dt;
      if (buff.seconds <= 0) this.values.delete(id);
    }
  }
  snapshot() {
    return [...this.values.entries()]
      .filter(([id]) => id !== 'ultimate')
      .map(([, value]) => value)
      .map((b) => ({
        name: b.stacks > 1 ? `${b.name} ×${b.stacks}` : b.name,
        seconds: b.seconds,
        color: b.color,
      }));
  }
}
