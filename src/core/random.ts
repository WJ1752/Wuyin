/** Reproducible 32-bit PRNG. Persist `state` to continue the same random sequence. */
export class SeededRandom {
  private value: number;

  constructor(seed: number | string) {
    if (typeof seed === 'number') this.value = seed >>> 0;
    else {
      let hash = 2166136261;
      for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
      this.value = hash >>> 0;
    }
  }

  get state(): number {
    return this.value;
  }
  set state(value: number) {
    this.value = value >>> 0;
  }

  next = (): number => {
    this.value = (this.value + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(this.value ^ (this.value >>> 15), this.value | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };

  /** Integer in the inclusive interval [min, max]. */
  int(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min)
      throw new RangeError('Invalid random interval');
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(values: readonly T[]): T {
    if (!values.length) throw new RangeError('Cannot choose from an empty list');
    return values[this.int(0, values.length - 1)];
  }

  shuffle<T>(values: readonly T[]): T[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index--) {
      const other = this.int(0, index);
      [result[index], result[other]] = [result[other], result[index]];
    }
    return result;
  }
}

export function createRng(seed: number | string): () => number {
  return new SeededRandom(seed).next;
}
