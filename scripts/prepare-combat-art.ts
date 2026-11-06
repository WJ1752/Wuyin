import sharp from 'sharp';
import { resolve } from 'node:path';
import { mkdir } from 'node:fs/promises';

const sources = resolve('docs/art/combat-sources');
const output = resolve('public/assets/skills/hd');
const cellSize = 256;
const alphaBackground = { r: 0, g: 0, b: 0, alpha: 0 };
await mkdir(output, { recursive: true });

async function prepareSheet(
  sourceName: string,
  outputName: string,
  columns: number,
  rows: number,
  expectedSize: [number, number],
) {
  const sourcePath = resolve(sources, sourceName);
  const source = sharp(sourcePath);
  const metadata = await source.metadata();
  if (
    metadata.width !== expectedSize[0] ||
    metadata.height !== expectedSize[1] ||
    !metadata.hasAlpha
  ) {
    throw new Error(
      `${sourceName}: expected ${expectedSize[0]}x${expectedSize[1]} RGBA, got ${metadata.width}x${metadata.height} alpha=${metadata.hasAlpha}`,
    );
  }

  const cells: { input: Buffer; left: number; top: number }[] = [];
  for (let row = 0; row < rows; row++) {
    const top = Math.round((row * metadata.height) / rows);
    const bottom = Math.round(((row + 1) * metadata.height) / rows);
    for (let column = 0; column < columns; column++) {
      const left = Math.round((column * metadata.width) / columns);
      const right = Math.round(((column + 1) * metadata.width) / columns);
      const cell = await source
        .clone()
        .extract({ left, top, width: right - left, height: bottom - top })
        .resize(cellSize, cellSize, {
          fit: 'contain',
          background: alphaBackground,
        })
        .png()
        .toBuffer();
      cells.push({ input: cell, left: column * cellSize, top: row * cellSize });
    }
  }

  const width = columns * cellSize;
  const height = rows * cellSize;
  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: alphaBackground,
    },
  })
    .composite(cells)
    .webp({ quality: 95, alphaQuality: 100 })
    .toFile(resolve(output, outputName));

  const result = await sharp(resolve(output, outputName)).metadata();
  if (result.width !== width || result.height !== height || !result.hasAlpha) {
    throw new Error(
      `${outputName}: output validation failed (${result.width}x${result.height}, alpha=${result.hasAlpha})`,
    );
  }
  console.log(`${outputName}: ${result.width}x${result.height}, alpha=${result.hasAlpha}`);
}

await prepareSheet('cast-ranger.png', 'cast-ranger.webp', 4, 2, [1774, 887]);
await prepareSheet('cast-barbarian-clean.png', 'cast-barbarian.webp', 4, 2, [1774, 887]);
await prepareSheet('cast-sorcerer.png', 'cast-sorcerer.webp', 4, 2, [1774, 887]);
await prepareSheet('cast-necromancer.png', 'cast-necromancer.webp', 4, 2, [1774, 887]);
await prepareSheet('cast-druid.png', 'cast-druid.webp', 4, 2, [1774, 887]);
await prepareSheet('effects.png', 'effects.webp', 4, 3, [1448, 1086]);
