/** Original 24px sprites. Coordinates are logical pixels, shared by SVG and Pixi. */
export class PixelArt {
  readonly pixels = new Map<string, number>();
  dot(x: number, y: number, ink = 2) {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && x < 24 && y >= 0 && y < 24) this.pixels.set(`${x},${y}`, ink);
    return this;
  }
  rect(x: number, y: number, w: number, h: number, ink = 2) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.dot(xx, yy, ink);
    return this;
  }
  line(x: number, y: number, xx: number, yy: number, ink = 2, width = 1) {
    const steps = Math.max(Math.abs(xx - x), Math.abs(yy - y));
    for (let i = 0; i <= steps; i++)
      this.rect(
        Math.round(x + ((xx - x) * i) / (steps || 1)),
        Math.round(y + ((yy - y) * i) / (steps || 1)),
        width,
        width,
        ink,
      );
    return this;
  }
  poly(points: number[], ink = 2) {
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 24; x++) {
        let inside = false;
        for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
          const xi = points[i],
            yi = points[i + 1],
            xj = points[j],
            yj = points[j + 1];
          if (
            yi > y + 0.5 !== yj > y + 0.5 &&
            x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi
          )
            inside = !inside;
        }
        if (inside) this.dot(x, y, ink);
      }
    return this;
  }
  stamp(art: PixelArt, x: number, y: number, size: number, mirror = false) {
    for (let yy = 0; yy < size; yy++)
      for (let xx = 0; xx < size; xx++) {
        const sx = Math.floor((xx * 24) / size),
          sy = Math.floor((yy * 24) / size);
        const ink = art.pixels.get(`${mirror ? 23 - sx : sx},${sy}`);
        if (ink !== undefined) this.dot(x + xx, y + yy, ink);
      }
    return this;
  }
  layers(color: string) {
    const pixels = new Map(this.pixels);
    for (const key of this.pixels.keys()) {
      const [x, y] = key.split(',').map(Number);
      for (const [dx, dy] of [
        [0, -1],
        [-1, 0],
        [1, 0],
        [0, 1],
      ]) {
        const edge = `${x + dx},${y + dy}`;
        if (!pixels.has(edge) && x + dx >= 0 && x + dx < 24 && y + dy >= 0 && y + dy < 24)
          pixels.set(edge, 0);
      }
    }
    const colors = ['#111a28', '#48546c', color, '#fff0c6', '#aa7850'];
    return colors
      .map((fill, ink) => ({
        fill,
        path: [...pixels]
          .filter(([, value]) => value === ink)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key]) => {
            const [x, y] = key.split(',').map(Number);
            return `M${x * 2} ${y * 2}h2v2h-2z`;
          })
          .join(''),
      }))
      .filter((layer) => layer.path);
  }
}

export type PixelMotif =
  | 'arrow'
  | 'sword'
  | 'axe'
  | 'hammer'
  | 'scythe'
  | 'claw'
  | 'bolt'
  | 'flame'
  | 'ice'
  | 'star'
  | 'orb'
  | 'portal'
  | 'swirl'
  | 'wave'
  | 'skull'
  | 'ghost'
  | 'raven'
  | 'wolf'
  | 'horn'
  | 'shield'
  | 'drop'
  | 'eye'
  | 'book'
  | 'leaf'
  | 'vine'
  | 'mushroom'
  | 'boot'
  | 'bone'
  | 'gem'
  | 'hook'
  | 'meteor'
  | 'cloud'
  | 'crosshair'
  | 'mask';

/** Each silhouette is drawn for its subject, using solid stepped pixel clusters. */
export function pixelMotif(kind: PixelMotif): PixelArt {
  const p = new PixelArt();
  switch (kind) {
    case 'arrow':
      p.line(5, 18, 17, 6, 4, 2)
        .poly([11, 4, 20, 4, 20, 13], 2)
        .line(13, 5, 18, 5, 3)
        .poly([3, 13, 10, 18, 7, 21, 3, 17], 2);
      break;
    case 'sword':
      p.poly([7, 15, 16, 4, 21, 3, 20, 8, 11, 18], 2)
        .line(9, 14, 18, 5, 3)
        .line(5, 13, 13, 21, 4, 2)
        .line(4, 20, 8, 16, 4, 2);
      break;
    case 'axe':
      p.line(5, 20, 18, 6, 4, 2)
        .poly([8, 4, 13, 3, 21, 11, 20, 16, 15, 17, 6, 8], 2)
        .line(7, 6, 16, 15, 3)
        .rect(13, 7, 3, 3, 4);
      break;
    case 'hammer':
      p.line(6, 20, 14, 11, 4, 3)
        .poly([10, 3, 15, 3, 22, 10, 22, 14, 17, 17, 6, 7], 2)
        .line(10, 4, 19, 13, 3)
        .line(16, 6, 20, 10, 1);
      break;
    case 'scythe':
      p.line(6, 21, 13, 5, 4, 2)
        .poly([5, 7, 9, 3, 16, 3, 21, 7, 22, 12, 16, 8, 11, 8], 2)
        .line(10, 4, 16, 4, 3);
      break;
    case 'claw':
      for (let i = 0; i < 3; i++)
        p.poly([4 + i * 6, 3, 5 + i * 6, 11, 9 + i * 5, 20, 5 + i * 5, 16, 2 + i * 6, 8], 2).dot(
          4 + i * 6,
          6,
          3,
        );
      break;
    case 'bolt':
      p.poly([13, 2, 20, 2, 13, 10, 20, 10, 7, 22, 10, 13, 4, 13], 2).poly(
        [13, 4, 17, 4, 11, 11, 15, 11, 10, 16, 12, 11, 8, 11],
        3,
      );
      break;
    case 'flame':
      p.poly(
        [12, 2, 17, 8, 16, 12, 20, 8, 21, 16, 17, 21, 7, 21, 3, 16, 5, 9, 8, 12, 9, 6],
        2,
      ).poly([12, 10, 17, 17, 15, 20, 9, 20, 7, 17], 3);
      break;
    case 'ice':
      p.line(11, 3, 11, 20, 2, 2)
        .line(3, 7, 19, 16, 2, 2)
        .line(3, 16, 19, 7, 2, 2)
        .line(7, 3, 11, 7, 3)
        .line(15, 3, 11, 7, 3)
        .line(7, 20, 11, 16, 3)
        .line(15, 20, 11, 16, 3)
        .rect(10, 10, 3, 3, 3);
      break;
    case 'star':
      p.poly([11, 2, 14, 8, 21, 9, 16, 14, 17, 21, 11, 17, 5, 21, 6, 14, 1, 9, 8, 8], 2).rect(
        9,
        9,
        5,
        5,
        3,
      );
      break;
    case 'orb':
      p.poly([8, 4, 16, 4, 20, 8, 20, 16, 16, 20, 8, 20, 4, 16, 4, 8], 2)
        .rect(7, 8, 3, 5, 3)
        .rect(10, 6, 4, 2, 3)
        .rect(12, 17, 5, 2, 1);
      break;
    case 'portal':
      p.poly([7, 3, 14, 3, 18, 7, 18, 18, 14, 22, 7, 22, 3, 18, 3, 7], 2)
        .rect(7, 7, 7, 11, 0)
        .rect(7, 5, 7, 2, 3)
        .line(11, 12, 21, 12, 3, 2)
        .poly([18, 8, 23, 13, 18, 18], 3);
      break;
    case 'swirl':
      p.line(6, 4, 17, 4, 2, 2)
        .line(17, 4, 21, 8, 2, 2)
        .line(20, 8, 20, 14, 2, 2)
        .line(20, 14, 15, 19, 2, 2)
        .line(6, 19, 15, 19, 2, 2)
        .line(3, 15, 6, 19, 2, 2)
        .line(3, 9, 3, 15, 2, 2)
        .line(4, 8, 10, 8, 3, 2)
        .line(10, 8, 14, 12, 3, 2)
        .line(14, 12, 10, 15, 3, 2);
      break;
    case 'wave':
      p.poly([3, 15, 6, 8, 11, 5, 18, 5, 14, 8, 12, 12, 14, 16, 21, 17, 19, 21, 7, 21], 2)
        .line(7, 8, 12, 6, 3, 2)
        .line(4, 17, 7, 20, 3);
      break;
    case 'skull':
      p.poly([7, 4, 16, 4, 20, 8, 20, 15, 16, 17, 16, 21, 7, 21, 7, 17, 3, 15, 3, 8], 2)
        .rect(7, 5, 8, 2, 3)
        .rect(6, 10, 4, 4, 0)
        .rect(14, 10, 4, 4, 0)
        .rect(11, 15, 2, 2, 0)
        .rect(10, 19, 1, 2, 0)
        .rect(13, 19, 1, 2, 0);
      break;
    case 'ghost':
      p.poly(
        [9, 3, 15, 3, 18, 6, 18, 14, 21, 20, 17, 19, 15, 22, 11, 19, 6, 21, 3, 18, 6, 14, 6, 6],
        2,
      )
        .rect(8, 8, 3, 3, 0)
        .rect(14, 8, 3, 3, 0)
        .rect(10, 4, 4, 2, 3);
      break;
    case 'raven':
      p.poly(
        [2, 5, 8, 8, 11, 11, 13, 5, 17, 3, 20, 6, 23, 8, 18, 10, 15, 16, 9, 21, 9, 17, 4, 14],
        2,
      )
        .line(3, 7, 8, 11, 3)
        .dot(17, 6, 3);
      break;
    case 'wolf':
      p.poly([3, 3, 9, 7, 15, 7, 21, 3, 20, 15, 15, 21, 9, 21, 4, 15], 2)
        .poly([7, 13, 12, 10, 17, 13, 15, 18, 9, 18], 3)
        .rect(6, 9, 3, 2, 0)
        .rect(15, 9, 3, 2, 0)
        .rect(10, 14, 4, 3, 0);
      break;
    case 'horn':
      p.poly([3, 9, 9, 8, 18, 3, 18, 21, 9, 16, 3, 15], 2)
        .rect(3, 9, 3, 6, 4)
        .rect(16, 5, 2, 14, 3);
      break;
    case 'shield':
      p.poly([12, 2, 21, 6, 20, 15, 17, 19, 12, 22, 7, 19, 4, 15, 3, 6], 2)
        .line(5, 7, 11, 4, 3)
        .poly([12, 6, 17, 8, 16, 15, 12, 18], 1)
        .rect(10, 8, 3, 8, 3);
      break;
    case 'drop':
      p.poly([12, 2, 18, 10, 21, 16, 19, 20, 15, 22, 8, 22, 4, 20, 3, 16, 6, 10], 2)
        .line(8, 11, 5, 16, 3)
        .rect(6, 17, 2, 2, 3);
      break;
    case 'eye':
      p.poly([2, 12, 7, 7, 16, 7, 22, 12, 16, 18, 7, 18], 2)
        .rect(10, 8, 4, 9, 0)
        .rect(10, 8, 2, 3, 3);
      break;
    case 'book':
      p.poly([2, 5, 8, 5, 12, 7, 16, 5, 22, 5, 22, 20, 16, 20, 12, 22, 8, 20, 2, 20], 2)
        .rect(11, 8, 2, 13, 4)
        .rect(4, 8, 5, 2, 3)
        .rect(4, 12, 5, 2, 3)
        .rect(15, 8, 5, 2, 3)
        .rect(15, 12, 5, 2, 3);
      break;
    case 'leaf':
      p.poly([4, 12, 8, 6, 21, 3, 18, 16, 12, 20, 5, 18], 2)
        .line(5, 19, 16, 8, 3)
        .line(8, 14, 8, 10, 3)
        .line(10, 15, 14, 15, 3);
      break;
    case 'vine':
      p.line(9, 21, 14, 13, 4, 2)
        .line(14, 13, 9, 5, 4, 2)
        .poly([12, 11, 14, 6, 21, 5, 19, 11], 2)
        .poly([10, 16, 4, 15, 2, 9, 8, 10], 2)
        .poly([9, 6, 4, 5, 4, 1, 9, 2], 2)
        .dot(15, 8, 3)
        .dot(5, 11, 3);
      break;
    case 'mushroom':
      p.rect(9, 13, 6, 9, 3)
        .poly([3, 10, 7, 4, 16, 4, 21, 10, 21, 15, 3, 15], 2)
        .rect(7, 7, 3, 3, 3)
        .rect(15, 9, 3, 3, 3)
        .rect(3, 14, 18, 2, 1);
      break;
    case 'boot':
      p.poly([6, 3, 15, 3, 14, 14, 20, 16, 21, 21, 3, 21, 3, 16, 6, 13], 2)
        .rect(6, 4, 8, 3, 3)
        .rect(3, 19, 18, 2, 4)
        .rect(7, 8, 5, 2, 4);
      break;
    case 'bone':
      p.line(6, 18, 17, 7, 2, 4)
        .rect(2, 16, 5, 4, 2)
        .rect(5, 19, 4, 4, 2)
        .rect(14, 2, 4, 5, 2)
        .rect(18, 5, 5, 4, 2)
        .line(7, 17, 16, 8, 3);
      break;
    case 'gem':
      p.poly([7, 3, 17, 3, 22, 10, 12, 22, 2, 10], 2)
        .poly([7, 4, 11, 4, 7, 10, 3, 10], 3)
        .poly([12, 4, 16, 4, 19, 10, 12, 20], 1)
        .line(4, 10, 20, 10, 3);
      break;
    case 'hook':
      p.line(15, 2, 10, 11, 4, 2)
        .line(10, 11, 10, 18, 2, 3)
        .line(10, 18, 16, 21, 2, 3)
        .line(16, 21, 20, 16, 2, 3)
        .poly([16, 13, 22, 13, 22, 19], 2)
        .rect(11, 16, 2, 3, 3);
      break;
    case 'meteor':
      p.poly([3, 15, 8, 10, 12, 9, 21, 2, 19, 10, 23, 8, 17, 18, 12, 22, 6, 22, 2, 18], 2)
        .poly([5, 14, 10, 12, 15, 15, 13, 20, 7, 20, 4, 18], 4)
        .rect(6, 14, 4, 2, 3);
      break;
    case 'cloud':
      p.poly([2, 11, 5, 8, 9, 8, 11, 4, 17, 4, 19, 8, 22, 10, 22, 16, 2, 16], 2)
        .line(11, 5, 16, 5, 3)
        .line(4, 11, 7, 9, 3)
        .line(6, 19, 4, 22, 2)
        .line(15, 19, 13, 22, 2);
      break;
    case 'crosshair':
      p.rect(7, 5, 10, 2)
        .rect(7, 17, 10, 2)
        .rect(5, 7, 2, 10)
        .rect(17, 7, 2, 10)
        .rect(11, 2, 2, 7, 3)
        .rect(11, 15, 2, 7, 3)
        .rect(2, 11, 7, 2, 3)
        .rect(15, 11, 7, 2, 3)
        .rect(11, 11, 2, 2);
      break;
    case 'mask':
      p.poly([3, 3, 8, 8, 16, 8, 21, 3, 20, 17, 16, 21, 8, 21, 4, 17], 2)
        .rect(7, 11, 4, 2, 0)
        .rect(14, 11, 4, 2, 0)
        .rect(8, 17, 8, 2, 3);
      break;
  }
  return p;
}
