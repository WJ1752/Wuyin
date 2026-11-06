import sharp from 'sharp';
import { resolve } from 'node:path';

const directory = resolve('public/assets/ui');
const originals = resolve('docs/art/ui-v3');
const sheet = sharp(resolve(originals, 'pixel-kit-source.png'));
const metadata = await sheet.metadata();
if (
  !metadata.hasAlpha ||
  !metadata.width ||
  metadata.width !== metadata.height ||
  metadata.width % 2
)
  throw new Error('UI material sheet must be square RGBA with four equal cells.');
const cell = metadata.width / 2;
for (const [index, name] of ['primary', 'secondary', 'slot', 'panel'].entries()) {
  const tile = await sheet
    .clone()
    .extract({
      left: (index % 2) * cell,
      top: Math.floor(index / 2) * cell,
      width: cell,
      height: cell,
    })
    .toBuffer();
  await sharp(tile)
    .trim({ threshold: 12 })
    .webp({ lossless: true })
    .toFile(resolve(directory, `pixel-${name}.webp`));
}
await sharp(resolve(originals, 'pixel-nav-source.png'))
  .resize(1280, 1280, { kernel: 'nearest' })
  .webp({ lossless: true })
  .toFile(resolve(directory, 'pixel-nav.webp'));
for (const classId of ['ranger', 'barbarian', 'sorcerer', 'necromancer', 'druid'])
  await sharp(resolve(originals, `${classId}-source.png`))
    .resize(1280, 1280, { kernel: 'nearest' })
    .webp({ quality: 92 })
    .toFile(resolve(directory, `skills-${classId}.webp`));
for (const name of ['primary', 'secondary', 'slot', 'panel', 'nav']) {
  const info = await sharp(resolve(directory, `pixel-${name}.webp`)).metadata();
  console.log(`${name}: ${info.width}x${info.height}, alpha=${info.hasAlpha}`);
}
