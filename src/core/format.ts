export function formatBigNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const n = Math.abs(value);
  for (const [limit, suffix, digits] of [
    [1e16, '京', 2],
    [1e12, '兆', 2],
    [1e8, '亿', 2],
    [1e4, '万', 1],
  ] as const)
    if (n >= limit) return `${(value / limit).toFixed(digits)}${suffix}`;
  return Math.floor(value).toString();
}
export function formatTime(seconds: number) {
  const n = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(n / 60)
    .toString()
    .padStart(2, '0')}:${(n % 60).toString().padStart(2, '0')}`;
}
