import { Assets, Container, Graphics, Rectangle, Texture, TilingSprite } from 'pixi.js';
import { pixelEllipse, pixelLine, pixelPolygon, pixelStamp, snapPixel } from './PixelArt';

const groundTextures: Texture[] = [];
let loading: Promise<void> | undefined;

/** Load once for all runs; retain the authored ground below when an asset is unavailable. */
export function preloadMapTextures(): Promise<void> {
  return (loading ??= Assets.load<Texture>('assets/maps/rift-ground-atlas-v2.png')
    .then((atlas) => {
      atlas.source.scaleMode = 'nearest';
      const width = atlas.width / 2;
      const height = atlas.height / 2;
      for (let index = 0; index < 4; index++) {
        groundTextures[index] = new Texture({
          source: atlas.source,
          frame: new Rectangle((index % 2) * width, Math.floor(index / 2) * height, width, height),
        });
      }
    })
    .catch(() => {
      // Preserve the existing procedural map as the offline/error fallback.
    }));
}

const PALETTES = [
  [0x1b302d, 0x233c34, 0x304b3b, 0x536149, 0x8a9d61],
  [0x242c36, 0x303a42, 0x414b52, 0x647076, 0x9ba6a1],
  [0x32232c, 0x432b32, 0x57363a, 0xc96b43, 0xffc26d],
  [0x28243d, 0x352f4b, 0x49415f, 0x8b79b9, 0xd2b8ed],
];

export function createMap(theme: number, size = 1800): Container {
  const root = new Container();
  const palette = PALETTES[theme % PALETTES.length];
  const ground = new Graphics().rect(-size / 2, -size / 2, size, size).fill(palette[0]);
  root.addChild(ground);
  let seed = 77 + theme * 973;
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const texture = groundTextures[theme % PALETTES.length];
  if (texture) {
    const terrain = new TilingSprite({
      texture,
      width: size,
      height: size,
      tileScale: { x: 0.78, y: 0.78 },
      tint: 0xb8b8b8,
    });
    terrain.position.set(-size / 2, -size / 2);
    root.addChild(terrain);
  } else {
    // Quiet paving gives combat a readable centre; irregular islands break the tile grid.
    for (let y = -size / 2; y < size / 2; y += 48) {
      for (let x = -size / 2; x < size / 2; x += 64) {
        const stagger = (Math.floor(y / 48) % 2) * 32;
        const xx = x + stagger;
        ground.rect(xx + 3, y + 3, 58, 42).fill(rand() > 0.5 ? palette[1] : palette[0]);
        ground.rect(xx + 6, y + 3, 49, 3).fill({ color: palette[2], alpha: 0.55 });
        if (rand() > 0.62) {
          ground.rect(xx + 12, y + 18, 12, 3).fill(palette[2]);
          ground.rect(xx + 21, y + 21, 3, 6).fill(palette[2]);
        }
        if (rand() > 0.8)
          pixelStamp(
            ground,
            ['..aa.', '.aaba', 'abb..', '.a...'],
            { a: palette[2], b: palette[3] },
            xx + 38,
            y + 29,
            3,
          );
      }
    }
    for (let i = 0; i < 48; i++) {
      if (i % 11 < 2) continue;
      const a = (i / 48) * Math.PI * 2;
      const x = snapPixel(Math.cos(a) * 164, 4),
        y = snapPixel(Math.sin(a) * 112, 4);
      ground.rect(x, y, 8, 4).fill(palette[3]);
      if (i % 4 === 0) ground.rect(x, y - 8, 4, 16).fill(palette[2]);
    }
  }
  for (let i = 0; i < 105; i++) {
    const x = snapPixel((rand() - 0.5) * (size - 80));
    const y = snapPixel((rand() - 0.5) * (size - 80));
    if (Math.hypot(x, y) < 210) continue;
    const g = new Graphics();
    g.position.set(x, y);
    pixelEllipse(g, 0, 5, 30, 10, 0x101921, 3, 0.55);
    if (theme === 0) {
      if (i % 4 === 0) {
        pixelStamp(
          g,
          ['...aaaa...', '..abbbaa..', '.abcccbba.', 'abbcccbbba', '..dd.dd...', '..ed.de...'],
          { a: 0x142b25, b: 0x43694a, c: 0x789457, d: 0x554832, e: 0xa18a54 },
          -18,
          -24,
          4,
        );
      } else {
        g.rect(-6, -54, 15, 57)
          .fill(0x192c27)
          .rect(-3, -45, 6, 48)
          .fill(0x705a3b)
          .rect(3, -39, 3, 39)
          .fill(0x493b2e);
        for (let layer = 0; layer < 3; layer++) {
          const yy = -81 + layer * 18,
            width = 20 + layer * 10;
          pixelPolygon(g, [0, yy - 18, -width, yy + 24, width, yy + 24], 0x102b26);
          pixelPolygon(
            g,
            [0, yy - 15, -width + 6, yy + 18, width - 3, yy + 18, 3, yy + 3],
            layer === 1 ? 0x3c6548 : 0x325840,
          );
          pixelLine(g, -width + 9, yy + 15, -3, yy - 6, 0x658154);
        }
      }
    } else if (theme === 1) {
      g.rect(-15, -42, 33, 42).fill(0x19232d).rect(-12, -48, 27, 48).fill(0x19232d);
      g.rect(-9, -45, 21, 42)
        .fill(0x67717b)
        .rect(-9, -45, 18, 6)
        .fill(0x98a39e)
        .rect(9, -39, 3, 36)
        .fill(0x424e5e);
      g.rect(-3, -33, 6, 21).fill(0x2c3544).rect(-9, -27, 18, 6).fill(0x2c3544);
      g.rect(-18, -3, 39, 6).fill(0x48594e);
      if (i % 3 === 0)
        pixelStamp(
          g,
          ['.aa..', 'abba.', '.ac..', '..c..'],
          { a: 0x202e29, b: 0x6d8b66, c: 0x435c47 },
          -21,
          -12,
          3,
        );
    } else if (theme === 2) {
      pixelPolygon(g, [-27, 3, -27, -21, -12, -51, 3, -60, 21, -30, 30, 3], 0x201f2a);
      pixelPolygon(g, [-21, 0, -21, -21, -9, -48, 0, -54, 0, 0], 0x6a4141);
      pixelPolygon(g, [0, -54, 18, -27, 24, 0, 0, 0], 0x4d343b);
      pixelLine(g, 0, -45, -6, -21, 0xd5784b);
      pixelLine(g, -6, -21, 6, -6, 0xffc678);
      if (i % 3 === 0) {
        pixelEllipse(g, 12, 9, 27, 9, 0x7d3a31);
        pixelEllipse(g, 12, 6, 18, 3, 0xe98e51);
        g.rect(6, 3, 12, 3).fill(0xffdb80);
      }
    } else {
      g.rect(-24, 0, 48, 6).fill(0x171c31).rect(-18, -6, 36, 6).fill(0x5b526f);
      pixelPolygon(g, [-15, -6, -21, -36, 0, -72, 18, -36, 12, -6], 0x171d32);
      pixelPolygon(g, [-12, -9, -15, -36, 0, -63, 0, -9], 0x9b83c1);
      pixelPolygon(g, [0, -63, 12, -36, 9, -9, 0, -9], 0x625789);
      pixelLine(g, -12, -33, 0, -60, 0xddc5ef);
      g.rect(-6, -27, 3, 12).fill(0xc1a7dd);
    }
    root.addChild(g);
  }
  return root;
}
