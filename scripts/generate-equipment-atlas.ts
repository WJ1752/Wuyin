import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import {
  EQUIPMENT_ATLAS,
  EQUIPMENT_DROP_CATALOG,
  EQUIPMENT_SHAPES,
  SKILL_ICON_COMPOSITIONS,
} from '../src/data/visuals';
import { engravingGlyph } from './icon-engravings';

const { cell, columns, rows } = EQUIPMENT_ATLAS;
const source = new URL(
  '../docs/art/ui-pixel-release/equipment-shapes-source.webp',
  import.meta.url,
);
const sourceImage = await readFile(source);
const { width, height, hasAlpha } = await sharp(sourceImage).metadata();
if (!width || width !== height || !hasAlpha)
  throw new Error('The equipment source must be a square transparent 5×5 sheet.');

const bases = await Promise.all(
  EQUIPMENT_SHAPES.map(async (_, index) => {
    const x = index % 5;
    const y = Math.floor(index / 5);
    const left = Math.round((x * width) / 5);
    const top = Math.round((y * height) / 5);
    return sharp(sourceImage)
      .extract({
        left,
        top,
        width: Math.round(((x + 1) * width) / 5) - left,
        height: Math.round(((y + 1) * height) / 5) - top,
      })
      .resize(cell - 6, cell - 6, { kernel: 'nearest' })
      .png()
      .toBuffer();
  }),
);
const tiles: sharp.OverlayOptions[] = [];
for (const [index, visual] of EQUIPMENT_DROP_CATALOG.entries()) {
  const shape = EQUIPMENT_SHAPES.indexOf(visual.shape);
  if (shape < 0) throw new Error('Missing equipment silhouette for ' + visual.key);
  const [, glyph, accent] = SKILL_ICON_COMPOSITIONS[visual.motif];
  const crest = Buffer.from(
    `<svg width="12" height="12" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" fill="none" stroke="${visual.color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${engravingGlyph(glyph, 1, 1, 0.85)}${engravingGlyph(accent, 15, 15, 0.34)}</svg>`,
  );
  const badge = Buffer.from(
    `<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><path d="M3.5 1h9v1h2v2H15v8h-.5v2h-2v1h-9v-1h-2v-2H1V4h.5V2h2Z" fill="#172332" stroke="${visual.color}" stroke-width=".7"/></svg>`,
  );
  const tile = await sharp({
    create: { width: cell, height: cell, channels: 4, background: '#00000000' },
  })
    .composite([
      { input: bases[shape], left: 3, top: 3 },
      { input: badge, left: cell - 16, top: cell - 16 },
      { input: crest, left: cell - 14, top: cell - 14 },
    ])
    .png()
    .toBuffer();
  tiles.push({
    input: tile,
    left: (index % columns) * cell,
    top: Math.floor(index / columns) * cell,
  });
}
const output = await sharp({
  create: { width: columns * cell, height: rows * cell, channels: 4, background: '#00000000' },
})
  .composite(tiles)
  .webp({ lossless: true })
  .toBuffer();
await writeFile(new URL('../public/assets/maps/equipment-drops.webp', import.meta.url), output);
