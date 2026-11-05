import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import {
  EQUIPMENT_ATLAS,
  EQUIPMENT_DROP_CATALOG,
  EQUIPMENT_SHAPES,
  equipmentCrestSvg,
} from '../src/data/visuals';

const { cell, columns, rows } = EQUIPMENT_ATLAS;
const source = new URL('../public/assets/maps/equipment-shapes.png', import.meta.url);
const sourceImage = await readFile(source);
const tiles: sharp.OverlayOptions[] = [];
for (const [index, visual] of EQUIPMENT_DROP_CATALOG.entries()) {
  const shape = EQUIPMENT_SHAPES.indexOf(visual.shape);
  if (shape < 0) throw new Error('Missing equipment silhouette for ' + visual.key);
  const base = await sharp(sourceImage)
    .extract({
      left: (shape % 5) * cell,
      top: Math.floor(shape / 5) * cell,
      width: cell,
      height: cell,
    })
    .png()
    .toBuffer();
  const badgeSize = 14;
  const crest = await sharp(Buffer.from(equipmentCrestSvg(visual)))
    .resize(badgeSize, badgeSize, { kernel: 'nearest' })
    .png()
    .toBuffer();
  const badge = Buffer.from(
    `<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><path d="M3 0h10v2h3v11h-3v3H3v-2H0V3h3z" fill="#1d222e"/><path d="M3 1h10v1H3zm10 2h2v9h-2zM3 13h10v2H3z" fill="${visual.color}"/></svg>`,
  );
  const tile = await sharp(base)
    .composite([
      { input: badge, left: 32, top: 32 },
      { input: crest, left: 33, top: 33 },
    ])
    .png()
    .toBuffer();
  tiles.push({
    input: tile,
    left: (index % columns) * cell,
    top: Math.floor(index / columns) * cell,
  });
}
await sharp({
  create: { width: columns * cell, height: rows * cell, channels: 4, background: '#00000000' },
})
  .composite(tiles)
  .webp({ lossless: true })
  .toFile('public/assets/maps/equipment-drops.webp');
