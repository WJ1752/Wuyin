import { Graphics } from 'pixi.js';

/** Shared logical-pixel primitives. Geometry is authored on the grid, never blurred. */
export const snapPixel = (n: number, cell = 3) => Math.round(n / cell) * cell;

export function pixelLine(
  g: Graphics,
  x: number,
  y: number,
  tx: number,
  ty: number,
  color: number,
  cell = 3,
  alpha = 1,
) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(tx - x), Math.abs(ty - y)) / cell));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    g.rect(snapPixel(x + (tx - x) * t, cell), snapPixel(y + (ty - y) * t, cell), cell, cell);
  }
  return g.fill({ color, alpha });
}

export function pixelEllipse(
  g: Graphics,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: number,
  cell = 3,
  alpha = 1,
  outline = false,
) {
  if (rx <= 0 || ry <= 0) return g;
  for (let row = -Math.ceil(ry / cell); row <= Math.ceil(ry / cell); row++) {
    const py = row * cell;
    if (Math.abs(py) > ry) continue;
    const half = Math.floor((rx * Math.sqrt(1 - (py / ry) ** 2)) / cell) * cell;
    if (outline && rx > cell && Math.abs(py) < ry - cell) {
      const inner =
        Math.floor(((rx - cell) * Math.sqrt(1 - (py / (ry - cell)) ** 2)) / cell) * cell;
      const width = Math.max(cell, half - inner);
      g.rect(snapPixel(x, cell) - half, snapPixel(y, cell) + py, width, cell);
      g.rect(snapPixel(x, cell) + half - width + cell, snapPixel(y, cell) + py, width, cell);
    } else g.rect(snapPixel(x, cell) - half, snapPixel(y, cell) + py, half * 2 + cell, cell);
  }
  return g.fill({ color, alpha });
}

/** Scan conversion preserves stepped silhouettes and a fixed palette in monster/terrain art. */
export function pixelPolygon(g: Graphics, points: number[], color: number, cell = 3, alpha = 1) {
  const ys = points.filter((_, i) => i % 2 === 1);
  const top = Math.floor(Math.min(...ys) / cell) * cell;
  const bottom = Math.ceil(Math.max(...ys) / cell) * cell;
  for (let y = top; y < bottom; y += cell) {
    const crosses: number[] = [];
    for (let i = 0; i < points.length; i += 2) {
      const j = (i + 2) % points.length;
      const [ax, ay, bx, by] = [points[i], points[i + 1], points[j], points[j + 1]];
      if ((ay <= y + cell / 2 && by > y + cell / 2) || (by <= y + cell / 2 && ay > y + cell / 2))
        crosses.push(ax + ((y + cell / 2 - ay) * (bx - ax)) / (by - ay));
    }
    crosses.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crosses.length; i += 2) {
      const left = Math.round(crosses[i] / cell) * cell;
      const width = Math.round(crosses[i + 1] / cell) * cell - left;
      if (width > 0) g.rect(left, y, width, cell);
    }
  }
  return g.fill({ color, alpha });
}

export function pixelStamp(
  g: Graphics,
  rows: string[],
  colors: Record<string, number>,
  x: number,
  y: number,
  cell = 3,
) {
  rows.forEach((row, iy) =>
    [...row].forEach((ink, ix) => {
      if (colors[ink] !== undefined)
        g.rect(x + ix * cell, y + iy * cell, cell, cell).fill(colors[ink]);
    }),
  );
  return g;
}
