import type { Stats } from '../core/types';
export interface DamageInput {
  stats: Stats;
  multiplier: number;
  elite?: boolean;
  crit?: boolean;
  independent?: number[];
  vulnerability?: number;
  armor?: number;
}
function damageFactors({
  stats,
  multiplier,
  elite = false,
  crit = false,
  independent = [],
  vulnerability = 0,
  armor = 0,
}: DamageInput): number[] {
  const defense = 100 / (100 + Math.max(0, armor * (1 - stats.penetration)));
  return [
    stats.attack,
    multiplier,
    1 + stats.mainStat * 0.01,
    1 + stats.bonusDamage,
    1 + stats.elementDamage,
    elite ? 1 + stats.eliteDamage : 1,
    crit ? 1 + stats.critDamage : 1,
    1 + vulnerability,
    ...[...stats.independent, ...independent].map((value) => 1 + value),
    defense,
  ];
}
const MAX_EXACT_DAMAGE = 10n ** 100n;

/** Decimal factors become integer ratios; round only once after all multipliers. */
function multiplyExact(factors: number[]): bigint {
  let numerator = 1n,
    denominator = 1n;
  for (const factor of factors) {
    if (!Number.isFinite(factor) || factor < 0) throw new RangeError('Invalid damage factor');
    const [mantissa, exponent = '0'] = factor.toString().split('e');
    const decimals = mantissa.split('.')[1]?.length ?? 0;
    const power = Number(exponent) - decimals;
    numerator *= BigInt(mantissa.replace('.', ''));
    if (power >= 0) numerator *= 10n ** BigInt(power);
    else denominator *= 10n ** BigInt(-power);
  }
  const value = (numerator + denominator / 2n) / denominator;
  return value < 1n ? 1n : value > MAX_EXACT_DAMAGE ? MAX_EXACT_DAMAGE : value;
}

export function calculateExactDamage(input: DamageInput): bigint {
  return multiplyExact(damageFactors(input));
}

export function calculateDamage(input: DamageInput): number {
  const factors = damageFactors(input);
  const result = factors.reduce((value, factor) => value * factor, 1);
  // Most hits stay on the fast Number path. Beyond 2^53, resolve the product with
  // BigInt before converting to the approximate Number used by rendering/health.
  return result > Number.MAX_SAFE_INTEGER
    ? Number(multiplyExact(factors))
    : Math.max(1, Math.round(result));
}
export { formatBigNumber } from '../core/format';
export function mitigateDamage(raw: number, stats: Stats): number {
  return Math.max(
    1,
    raw * (1 - Math.min(0.85, stats.damageReduction)) * (100 / (100 + stats.armor * 0.6)),
  );
}
