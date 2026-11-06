import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'docs/art/characters-source.png');
const outputDir = path.join(root, 'public/assets/characters/hd');
const debugDir = path.join(root, '.qa');
const names = ['barbarian', 'ranger', 'sorcerer', 'necromancer', 'druid'];
const { data, info } = await sharp(sourcePath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
if (info.width !== 2172 || info.height !== 724 || info.channels !== 4)
  throw new Error(`Unexpected source image: ${info.width}x${info.height}x${info.channels}`);

const { width, height } = info;
const visited = new Uint8Array(width * height);
const labels = new Int32Array(width * height).fill(-1);
const components: {
  id: number;
  area: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  sumX: number;
  sumY: number;
}[] = [];
const queue = new Int32Array(width * height);
const neighbors = [-width - 1, -width, -width + 1, -1, 1, width - 1, width, width + 1];

for (let start = 0; start < width * height; start++) {
  if (visited[start] || data[start * 4 + 3] <= 16) continue;
  const id = components.length;
  let head = 0,
    tail = 0,
    area = 0;
  let left = width,
    top = height,
    right = 0,
    bottom = 0,
    sumX = 0,
    sumY = 0;
  queue[tail++] = start;
  visited[start] = 1;
  while (head < tail) {
    const index = queue[head++];
    const x = index % width,
      y = Math.floor(index / width);
    labels[index] = id;
    area++;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + 1);
    bottom = Math.max(bottom, y + 1);
    sumX += x;
    sumY += y;
    for (const offset of neighbors) {
      const next = index + offset;
      if (next < 0 || next >= width * height || visited[next]) continue;
      const nx = next % width,
        ny = Math.floor(next / width);
      if (Math.abs(nx - x) > 1 || Math.abs(ny - y) > 1) continue;
      if (data[next * 4 + 3] <= 16) continue;
      visited[next] = 1;
      queue[tail++] = next;
    }
  }
  components.push({ id, area, left, top, right, bottom, sumX, sumY });
}

const substantial = components.filter((c) => c.area >= 100).sort((a, b) => b.area - a.area);
if (substantial.length < 5)
  throw new Error(`Only ${substantial.length} substantial components found`);
const subjects = substantial.slice(0, 5).sort((a, b) => a.sumX / a.area - b.sumX / b.area);
if (
  subjects.some(
    (subject, i) =>
      i > 0 && subject.sumX / subject.area <= subjects[i - 1].sumX / subjects[i - 1].area,
  )
)
  throw new Error('Could not separate five subjects by horizontal position');
const ownerForX = (x: number) => {
  let owner = 0,
    best = Infinity;
  subjects.forEach((subject, index) => {
    const distance = Math.abs(x - subject.sumX / subject.area);
    if (distance < best) {
      owner = index;
      best = distance;
    }
  });
  return owner;
};
const componentOwners = new Int8Array(components.length);
for (const component of components)
  componentOwners[component.id] = ownerForX(component.sumX / component.area);

await mkdir(outputDir, { recursive: true });
const reports = [];
for (let owner = 0; owner < names.length; owner++) {
  const ownedIds = new Set(
    components
      .filter((component) => componentOwners[component.id] === owner)
      .map((component) => component.id),
  );
  let left = width,
    top = height,
    right = 0,
    bottom = 0,
    included = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (ownedIds.has(labels[index])) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x + 1);
        bottom = Math.max(bottom, y + 1);
        included++;
      }
    }
  if (!included || right <= left || bottom <= top)
    throw new Error(`No pixels assigned to ${names[owner]}`);
  const outWidth = right - left,
    outHeight = bottom - top;
  const out = Buffer.alloc(outWidth * outHeight * 4);
  for (let y = top; y < bottom; y++)
    for (let x = left; x < right; x++) {
      const sourceIndex = (y * width + x) * 4;
      const label = labels[y * width + x];
      if (label >= 0 && ownedIds.has(label))
        data.copy(out, ((y - top) * outWidth + (x - left)) * 4, sourceIndex, sourceIndex + 4);
    }
  const scale = Math.min(460 / outHeight, 488 / outWidth);
  const scaledWidth = Math.round(outWidth * scale),
    scaledHeight = Math.round(outHeight * scale);
  const rawImage = sharp(out, { raw: { width: outWidth, height: outHeight, channels: 4 } });
  const resized = await rawImage
    .resize(scaledWidth, scaledHeight, { fit: 'fill', kernel: 'lanczos3' })
    .png()
    .toBuffer();
  const canvasPng = await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: resized, left: Math.round((512 - scaledWidth) / 2), top: 496 - scaledHeight },
    ])
    .png()
    .toBuffer();
  const filename = `${names[owner]}.webp`;
  await sharp(canvasPng).webp({ lossless: true, effort: 0 }).toFile(path.join(outputDir, filename));
  const expectedPixels = await sharp(canvasPng).ensureAlpha().raw().toBuffer();
  const publishedPixels = await sharp(path.join(outputDir, filename))
    .ensureAlpha()
    .raw()
    .toBuffer();
  if (!publishedPixels.equals(expectedPixels))
    throw new Error(`${filename}: lossless export changed RGBA pixels`);
  if (owner === 0) {
    await mkdir(debugDir, { recursive: true });
    await sharp(out, { raw: { width: outWidth, height: outHeight, channels: 4 } })
      .png()
      .toFile(path.join(debugDir, 'character-mask-before-resize.png'));
    await sharp(resized).png().toFile(path.join(debugDir, 'character-after-resize.png'));
    await sharp(canvasPng).png().toFile(path.join(debugDir, 'character-final.png'));
  }
  reports.push({
    name: names[owner],
    bbox: { left, top, right, bottom, width: outWidth, height: outHeight },
    area: included,
    scaled: { width: scaledWidth, height: scaledHeight },
    anchorX: 0.5,
    ground: 496 / 512,
    filename,
  });
}
console.log(
  JSON.stringify(
    {
      source: path.relative(root, sourcePath),
      dimensions: `${width}x${height}`,
      components: [...components]
        .sort((a, b) => b.area - a.area)
        .slice(0, 12)
        .map((c) => ({
          area: c.area,
          bbox: [c.left, c.top, c.right, c.bottom],
          center: [Math.round(c.sumX / c.area), Math.round(c.sumY / c.area)],
        })),
      subjects: reports,
    },
    null,
    2,
  ),
);
