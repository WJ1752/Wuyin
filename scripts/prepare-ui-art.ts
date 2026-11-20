import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { SKILL_ART } from '../src/data/skillArt';
import { SKILL_ICON_COMPOSITIONS, SKILL_VISUALS } from '../src/data/visuals';
import { engravingGlyph as glyph } from './icon-engravings';

const cellSize = 48;
const columns = 4;
const sheetSize = cellSize * columns;
const sources = new URL('../docs/art/ui-pixel-release/', import.meta.url);
const assets = new URL('../public/assets/ui/', import.meta.url);

const kit = await readFile(new URL('interface-source.webp', sources));
const { width, height, hasAlpha } = await sharp(kit).metadata();
if (!width || !height || width !== height || width % 2 !== 0 || !hasAlpha)
  throw new Error('The interface source must be a square transparent 2×2 sheet.');
const quadrant = width / 2;
const surfaces = [
  ['pixel-panel.webp', 144, 144],
  ['pixel-primary.webp', 128, 60],
  ['pixel-secondary.webp', 128, 60],
  ['pixel-slot.webp', 64, 64],
] as const;
for (const [index, [name, targetWidth, targetHeight]] of surfaces.entries()) {
  const left = (index % 2) * quadrant;
  const top = Math.floor(index / 2) * quadrant;
  const { data } = await sharp(kit)
    .extract({ left, top, width: quadrant, height: quadrant })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const columns = new Uint16Array(quadrant);
  const rows = new Uint16Array(quadrant);
  for (let y = 0; y < quadrant; y++)
    for (let x = 0; x < quadrant; x++)
      if (data[(y * quadrant + x) * 4 + 3] >= 150) {
        columns[x]++;
        rows[y]++;
      }
  const startX = columns.findIndex((count) => count >= quadrant / 12);
  const endX = columns.findLastIndex((count) => count >= quadrant / 12);
  const startY = rows.findIndex((count) => count >= quadrant / 12);
  const endY = rows.findLastIndex((count) => count >= quadrant / 12);
  if (startX < 0 || startY < 0) throw new Error(`Empty material quadrant: ${name}`);
  const tile = await sharp(kit)
    .extract({
      left: left + startX,
      top: top + startY,
      width: endX - startX + 1,
      height: endY - startY + 1,
    })
    .resize(targetWidth, targetHeight, { fit: 'fill', kernel: 'nearest' })
    .webp({ lossless: true })
    .toBuffer();
  await writeFile(new URL(name, assets), tile);
  if (index === 0) {
    const paper = await sharp(kit)
      .extract({ left: left + startX + 100, top: top + startY + 100, width: 340, height: 340 })
      .resize(96, 96, { kernel: 'nearest' })
      .webp({ lossless: true })
      .toBuffer();
    await writeFile(new URL('pixel-slate.webp', assets), paper);
  }
}

const navigation = await sharp(await readFile(new URL('navigation-source.webp', sources)))
  .resize(160, 160, { kernel: 'nearest' })
  .webp({ lossless: true })
  .toBuffer();
await writeFile(new URL('pixel-nav.webp', assets), navigation);

function renderTile(id: string) {
  const [, main, secondary, layout] = SKILL_ICON_COMPOSITIONS[id];
  const ink = SKILL_VISUALS[id].color;
  const large = (angle = 0) => glyph(main, 3.1, 2.6, 0.74, angle);
  const accent = glyph(secondary, 14.2, 14.8, 0.33);
  let carving = large();
  switch (layout) {
    case 'split':
      carving = glyph(main, 2, 3.3, 0.61, -22) + glyph(secondary, 9.2, 6.5, 0.53, 22);
      break;
    case 'fan':
      carving = glyph(main, 2.2, 5, 0.62, -32) + glyph(secondary, 8, 2.6, 0.57, 23);
      break;
    case 'volley':
      carving = glyph(main, 1.8, 6.2, 0.52) + glyph(main, 6.4, 2.5, 0.49) + accent;
      break;
    case 'rain':
      carving =
        glyph(secondary, 3, 1, 0.51) +
        glyph(main, 6, 8, 0.52, 102) +
        glyph(main, 13, 5.9, 0.36, 102);
      break;
    case 'dash':
      carving =
        '<path d="M3 17h3m-2 2h5M9 20h4" opacity=".55"/>' +
        large(-14) +
        glyph(secondary, 15, 3, 0.27);
      break;
    case 'arc':
      carving = '<path d="M3 9c2-4 5-6 9-6h3" opacity=".6"/>' + large(18) + accent;
      break;
    case 'impact':
      carving = '<path d="M5 4 4 6m15-2 1 2M4 19l2-2m12 2 2-1" opacity=".65"/>' + large() + accent;
      break;
    case 'wings':
      carving =
        glyph(secondary, 1, 8.4, 0.44, -38) +
        glyph(secondary, 12.3, 8.4, 0.44, 38) +
        glyph(main, 6, 3.5, 0.52);
      break;
    case 'crossed':
      carving = glyph(secondary, 4.3, 4.7, 0.65, -57) + glyph(main, 4, 3.5, 0.7);
      break;
    case 'ring':
      carving =
        '<circle cx="12" cy="12" r="8.7" stroke-dasharray="3 2" opacity=".45"/>' +
        glyph(main, 5, 5, 0.58) +
        accent;
      break;
    case 'single':
      carving += accent;
      break;
  }
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cellSize}" height="${cellSize}" viewBox="0 0 24 24" shape-rendering="crispEdges">
      <path fill="#111b28" d="M2 0h20v1h1v1h1v20h-1v1h-1v1H2v-1H1v-1H0V2h1V1h1Z"/>
      <path fill="#233143" d="M3 2h16v1h2v3h1v8h-1v3h-2v2h-2v1H5v-1H3v-2H2V5h1Z"/>
      <path fill="#334459" d="M3 2h17v1H3Zm-1 1h1v6H2Zm18 17h1v1h-4v1h-5v-1h5v-1Zm-17-3h1v2h2v1H4v-1H3Z"/>
      <path fill="${ink}" opacity=".24" d="M4 21h5v1H4Zm15-18h2v1h-2Zm2 1h1v2h-1Zm-1 17h1v1h-1ZM4 5h1v1H4Zm12-1h1v1h-1Zm-8 16h1v1H8Z"/>
      <g fill="none" stroke="#0a1420" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${carving}</g>
      <g fill="none" stroke="${ink}" stroke-opacity=".5" stroke-width="2.55" stroke-linecap="round" stroke-linejoin="round" transform="translate(.45 .55)">${carving}</g>
      <g fill="none" stroke="${ink}" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round">${carving}</g>
      <path fill="#f8e9c5" opacity=".64" d="M18 4h1v1h-1ZM6 19h1v1H6Z"/>
    </svg>`,
  );
}

const sheets = new Map<string, sharp.OverlayOptions[]>();
for (const [id, { src, column, row }] of Object.entries(SKILL_ART)) {
  const tiles = sheets.get(src) ?? [];
  tiles.push({ input: renderTile(id), left: column * cellSize, top: row * cellSize });
  sheets.set(src, tiles);
}
for (const [src, tiles] of sheets) {
  const output = await sharp({
    create: { width: sheetSize, height: sheetSize, channels: 4, background: '#00000000' },
  })
    .composite(tiles)
    .webp({ lossless: true })
    .toBuffer();
  await writeFile(new URL(`../public/${src}`, import.meta.url), output);
  console.log(`${src}: ${tiles.length} engravings at ${cellSize}px`);
}
