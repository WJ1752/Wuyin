/** Camera framing changes presentation only; movement and combat use world coordinates. */
export function combatFraming(width: number, height: number, compact: boolean) {
  const landscape = compact && width > height;
  const dock = landscape ? 120 : 0;
  const scale = compact
    ? Math.max(1, Math.min(1.2, (landscape ? height : width) / 360))
    : Math.max(1.25, Math.min(1.6, height / 560));
  return {
    scale,
    x: (width - dock) / 2,
    y: landscape ? height * 0.62 : compact ? 144 + Math.max(0, height - 230) * 0.5 : height * 0.5,
  };
}
