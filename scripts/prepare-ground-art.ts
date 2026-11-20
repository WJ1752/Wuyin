import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const paintedSource = process.argv[2];
const sourcePath = resolve(paintedSource ?? 'docs/art/legacy-maps/rift-ground-atlas-v2.png');
const outputDirectory = resolve(
  paintedSource ? 'public/assets/maps/painted' : 'public/assets/maps/hd',
);
const atlasSize = 1254;
const quadrantSize = atlasSize / 2;
const baseSize = paintedSource ? 384 : 512;
const variantSize = baseSize * 2;
const names = ['forest', 'crypt', 'ember', 'void'] as const;

await mkdir(outputDirectory, { recursive: true });

const source = sharp(sourcePath);
const metadata = await source.metadata();
if (metadata.width !== atlasSize || metadata.height !== atlasSize) {
  throw new Error(
    `Expected ${atlasSize}x${atlasSize} ground atlas, got ${metadata.width}x${metadata.height}`,
  );
}

for (const [index, name] of names.entries()) {
  const column = index % 2;
  const row = Math.floor(index / 2);
  const left = Math.round(column * quadrantSize + (quadrantSize - baseSize) / 2);
  const top = Math.round(row * quadrantSize + (quadrantSize - baseSize) / 2);
  const base = await source
    .clone()
    .extract({ left, top, width: baseSize, height: baseSize })
    .png()
    .toBuffer();

  const variantBuffers: Buffer[] = [];
  for (const angle of [0, 90, 180]) {
    const rotated = await sharp(base).rotate(angle).png().toBuffer();
    const horizontalMirror = await sharp(rotated).flop().png().toBuffer();
    const verticalMirror = await sharp(rotated).flip().png().toBuffer();
    const bothMirrors = await sharp(rotated).flip().flop().png().toBuffer();
    const variant = await sharp({
      create: {
        width: variantSize,
        height: variantSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: rotated, left: 0, top: 0 },
        { input: horizontalMirror, left: baseSize, top: 0 },
        { input: verticalMirror, left: 0, top: baseSize },
        { input: bothMirrors, left: baseSize, top: baseSize },
      ])
      .png()
      .toBuffer();
    variantBuffers.push(variant);
  }

  const outputPath = resolve(outputDirectory, `${name}-floors.webp`);
  await sharp({
    create: {
      width: variantSize * 3,
      height: variantSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(
      variantBuffers.map((input, column) => ({ input, left: column * variantSize, top: 0 })),
    )
    .webp({ quality: paintedSource ? 87 : 94, alphaQuality: 100 })
    .toFile(outputPath);

  const result = await sharp(outputPath).metadata();
  if (result.width !== variantSize * 3 || result.height !== variantSize) {
    throw new Error(`${name}-floors.webp: unexpected size ${result.width}x${result.height}`);
  }
  console.log(`${name}-floors.webp: ${result.width}x${result.height}, alpha=${result.hasAlpha}`);
}
