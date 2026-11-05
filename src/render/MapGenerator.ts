import { SeededRandom } from '../core/random';
import type { StageDef } from '../core/types';
import { RIFT_PYLON_SITES, THEMES } from '../data/stages';
import { Container, Graphics, Sprite, type Texture, TilingSprite } from 'pixi.js';
import { pixelEllipse, pixelLine, pixelPolygon, pixelStamp, snapPixel } from './PixelArt';
import { getAtlasTexture, preloadAtlas } from './TextureAtlas';

const scenerySizes = { pine: 104, mushrooms: 40, grave: 52, basalt: 66, crystal: 78 };
const themeProps = ['pine', 'grave', 'basalt', 'crystal'] as const;
const sceneryLight = [0x839c9b, 0xa9a6bc, 0xbb9695, 0xa69abd];
const propIds = [
  'conduit',
  'power',
  'speed',
  'channeling',
  'pine',
  'mushrooms',
  'grave',
  'basalt',
  'crystal',
];

export function preloadPropTextures() {
  return preloadAtlas(
    'assets/maps/rift-props.webp',
    3,
    3,
    propIds.map((id, i) => [`prop:${id}`, i % 3, Math.floor(i / 3)]),
    'nearest',
  );
}

export function createPropSprite(id: string, size: number) {
  const texture = getAtlasTexture(`prop:${id}`);
  if (!texture) return;
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 188 / 192);
  sprite.width = sprite.height = size;
  return sprite;
}

const groundSheets = ['forest', 'crypt', 'ember', 'void'];
const groundId = (theme: number, material: number) => `ground:${theme}:${material}`;

export function preloadMapTextures(theme: number) {
  return preloadAtlas(
    `assets/maps/${groundSheets[theme]}-floors.webp`,
    3,
    1,
    [0, 1, 2].map((material) => [groundId(theme, material), material, 0]),
    'nearest',
  );
}

/** The material repeats at the same world scale across atlases of different resolutions. */
function tileGround(texture: Texture, size: number) {
  const scale = 280 / texture.width;
  const tiles = new TilingSprite({
    texture,
    width: size,
    height: size,
    tileScale: { x: scale, y: scale },
  });
  tiles.position.set(-size / 2, -size / 2);
  return tiles;
}

const PALETTES = [
  [0x1b302d, 0x233c34, 0x304b3b, 0x536149, 0x8a9d61],
  [0x242c36, 0x303a42, 0x414b52, 0x647076, 0x9ba6a1],
  [0x32232c, 0x432b32, 0x57363a, 0xc96b43, 0xffc26d],
  [0x28243d, 0x352f4b, 0x49415f, 0x8b79b9, 0xd2b8ed],
];

export function createMap({ theme, level }: StageDef, size = 1800): Container {
  const root = new Container();
  const palette = PALETTES[theme % PALETTES.length];
  const ground = new Graphics().rect(-size / 2, -size / 2, size, size).fill(palette[0]);
  root.addChild(ground);
  // A stage owns its scenery seed. Drawing the map never consumes combat RNG.
  const rng = new SeededRandom(`rift-map-${level}`);
  const rand = rng.next;
  const chapter = Math.floor((level - 1) / (5 * THEMES.length));
  const floor = (level - 1) % 5;
  const material = (floor + chapter) % 3;
  const layout = (floor + chapter + theme) % 5;
  const width = rng.int(68, 106);
  const bend = rng.int(80, 170);
  const phase = rand() * Math.PI * 2;
  const across = rand() < 0.5;
  const offset = rng.int(-58, 58);
  const onPath = (x: number, y: number) => {
    const u = (across ? y : x) - offset;
    const v = across ? x : y;
    switch (layout) {
      case 0: // Winding trail
        return Math.abs(u - bend * Math.sin(v / 240 + phase)) < width;
      case 1: // Fork around an island, rejoining at either end
        return Math.abs(Math.abs(u) - Math.max(0, 200 - Math.abs(v) * 0.42)) < width;
      case 2: // Crossroads and a paved central square
        return (
          Math.min(Math.abs(u), Math.abs(v)) < width ||
          Math.max(Math.abs(u), Math.abs(v)) < width * 1.7
        );
      case 3: // A ring with east and west approaches
        return (
          Math.abs(Math.hypot(u, v) - (180 + bend)) < width ||
          (Math.abs(v) < width && Math.abs(u) > 180)
        );
      default: // An avenue with staggered side courts
        return (
          Math.abs(u) < width ||
          (Math.abs(Math.sin(v / 155 + phase)) < 0.48 &&
            Math.abs(u - Math.cos(v / 155 + phase) * 140) < 225)
        );
    }
  };
  const texture = getAtlasTexture(groundId(theme, material));
  const pathTexture = getAtlasTexture(groundId(theme, (material + 1 + (chapter % 2)) % 3));
  if (texture && pathTexture) {
    root.addChild(tileGround(texture, size));
    const road = tileGround(pathTexture, size);
    const mask = new Graphics();
    // Merge contiguous cells per row to keep the stair-stepped boundary inexpensive.
    const cell = 12,
      half = size / 2;
    for (let y = -half; y < half; y += cell) {
      let start: number | undefined;
      for (let x = -half; x < half; x += cell) {
        if (onPath(x + cell / 2, y + cell / 2)) {
          start ??= x;
        } else if (start !== undefined) {
          mask.rect(start, y, x - start, Math.min(cell, half - y));
          start = undefined;
        }
      }
      if (start !== undefined) mask.rect(start, y, half - start, Math.min(cell, half - y));
    }
    mask.fill(0xffffff);
    root.addChild(road, mask);
    road.mask = mask;
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
    if (
      Math.hypot(x, y) < 180 ||
      onPath(x, y) ||
      RIFT_PYLON_SITES.some((site) => Math.hypot(x - site.x, y - site.y) < 96)
    )
      continue;
    const propId = theme === 0 && i % 4 === 0 ? 'mushrooms' : themeProps[theme % themeProps.length];
    const prop = createPropSprite(propId, scenerySizes[propId]);
    if (prop) {
      prop.tint = sceneryLight[theme];
      prop.position.set(x, y + 4);
      root.addChild(prop);
      continue;
    }
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
