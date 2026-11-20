import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const sourceDir = 'docs/art/painted-actors';
const characters = ['ranger', 'barbarian', 'sorcerer', 'necromancer', 'druid'];
const residents = ['mentor', 'cube', 'chronicler', 'smith', 'mia', 'keeper', 'tamer'];
const companions = ['goblin', 'dragon', 'owl', 'imp', 'fox', 'wisp'];
const alphaThreshold = 56;

interface Island {
  id: number;
  area: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  x: number;
  y: number;
}

interface Sheet {
  filename: string;
  columns: number;
  ids: string[];
  size: number;
  height: number;
  ground: number;
}

// The drawn silhouettes may extend past a nominal cell edge. Use their alpha
// islands to keep long weapon tips and wings attached to the correct actor.
function findIslands(rgba: Buffer, width: number, height: number) {
  const labels = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  const islands: Island[] = [];
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] >= 0 || rgba[start * 4 + 3] < alphaThreshold) continue;
    let count = 1;
    const region: Island = {
      id: islands.length,
      area: 0,
      left: width,
      top: height,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
    };
    queue[0] = start;
    labels[start] = region.id;
    for (let index = 0; index < count; index++) {
      const pixel = queue[index];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      region.left = Math.min(region.left, x);
      region.top = Math.min(region.top, y);
      region.right = Math.max(region.right, x + 1);
      region.bottom = Math.max(region.bottom, y + 1);
      region.x += x;
      region.y += y;
      for (let ny = Math.max(0, y - 1); ny < Math.min(height, y + 2); ny++) {
        for (let nx = Math.max(0, x - 1); nx < Math.min(width, x + 2); nx++) {
          const next = ny * width + nx;
          if (labels[next] >= 0 || rgba[next * 4 + 3] < alphaThreshold) continue;
          labels[next] = region.id;
          queue[count++] = next;
        }
      }
    }
    region.area = count;
    region.x /= count;
    region.y /= count;
    islands.push(region);
  }
  return { labels, islands };
}

async function makeFrames({ filename, columns, ids, size, height, ground }: Sheet) {
  const { data, info } = await sharp(path.join(sourceDir, filename))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { labels, islands } = findIslands(data, info.width, info.height);
  const groups: Island[][] = ids.map(() => []);
  for (const island of islands) {
    if (island.area < 32) continue;
    const column = Math.floor((island.x * columns) / info.width);
    const row = Math.floor((island.y * Math.ceil(ids.length / columns)) / info.height);
    groups[row * columns + column]?.push(island);
  }
  return Promise.all(
    groups.map(async (group, index) => {
      const body = group.reduce<Island | undefined>(
        (largest, region) => (!largest || region.area > largest.area ? region : largest),
        undefined,
      );
      if (!body || body.area < 2000) throw new Error(`${filename}: missing ${ids[index]}`);
      const valid = group.filter((region) => region.area >= Math.max(32, body.area * 0.001));
      const labelsToKeep = new Set(valid.map((region) => region.id));
      const left = Math.max(0, Math.min(...valid.map((region) => region.left)) - 1);
      const right = Math.min(info.width, Math.max(...valid.map((region) => region.right)) + 1);
      const top = Math.max(0, Math.min(...valid.map((region) => region.top)) - 1);
      const bottom = Math.min(info.height, Math.max(...valid.map((region) => region.bottom)) + 1);
      const width = right - left;
      const originalHeight = bottom - top;
      const cropped = Buffer.alloc(width * originalHeight * 4);
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          const index = y * info.width + x;
          if (
            !labelsToKeep.has(labels[index]) &&
            (labels[index] >= 0 ||
              ![index - 1, index + 1, index - info.width, index + info.width].some((near) =>
                labelsToKeep.has(labels[near]),
              ))
          )
            continue;
          data.copy(cropped, ((y - top) * width + x - left) * 4, index * 4, index * 4 + 4);
        }
      }
      const axis = Math.max(width * 0.4, Math.min(width * 0.6, body.x - left));
      const scale = Math.min(height / originalHeight, (size * 0.47) / Math.max(axis, width - axis));
      const resizedWidth = Math.round(width * scale);
      const resizedHeight = Math.round(originalHeight * scale);
      const resized = await sharp(cropped, {
        raw: { width, height: originalHeight, channels: 4 },
      })
        .resize(resizedWidth, resizedHeight, { fit: 'fill', kernel: 'nearest' })
        .png()
        .toBuffer();
      console.log(
        `${filename} ${ids[index]}: ${width}x${originalHeight} -> ${resizedWidth}x${resizedHeight}`,
      );
      return {
        input: resized,
        left: Math.round(size / 2 - axis * scale),
        top: ground - resizedHeight,
      };
    }),
  );
}

function canvas(size: number, columns = 1, rows = 1) {
  return sharp({
    create: {
      width: size * columns,
      height: size * rows,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });
}

async function writeIndividual(sheet: Sheet, directory: string, suffix = '') {
  await mkdir(directory, { recursive: true });
  const frames = await makeFrames(sheet);
  await Promise.all(
    frames.map((frame, index) =>
      canvas(sheet.size)
        .composite([frame])
        .webp({ lossless: true, effort: 5 })
        .toFile(path.join(directory, `${sheet.ids[index]}${suffix}.webp`)),
    ),
  );
}

const heroSheet = { columns: 3, ids: characters, size: 128, height: 115, ground: 124 };
const petSheet = { columns: 3, ids: companions, size: 96, height: 81, ground: 88 };
const heroOutput = 'public/assets/characters/painted';
const petOutput = 'public/assets/pets/painted';

async function writeEquippedPoses() {
  const ids = ['', '-walk', '-action'].flatMap((pose) =>
    characters.map((id) => `${id}-equipped${pose}`),
  );
  await writeIndividual(
    { ...heroSheet, columns: characters.length, ids, filename: 'equipped-atlas.webp' },
    heroOutput,
  );
}

if (process.argv.includes('--equipped')) {
  await writeEquippedPoses();
} else {
  await writeIndividual({ ...heroSheet, filename: 'heroes.png' }, heroOutput);
  await writeIndividual({ ...heroSheet, filename: 'heroes-walk.png' }, heroOutput, '-walk');
  await writeIndividual({ ...heroSheet, filename: 'heroes-action.png' }, heroOutput, '-action');
  await writeIndividual({ ...petSheet, filename: 'companions.png' }, petOutput);
  await writeIndividual({ ...petSheet, filename: 'companions-action.png' }, petOutput, '-action');

  const npcSize = 128;
  const npcFrames = await makeFrames({
    filename: 'residents.png',
    columns: 4,
    ids: residents,
    size: npcSize,
    height: 108,
    ground: 118,
  });
  await canvas(npcSize, 4, 2)
    .composite(
      npcFrames.map((frame, index) => ({
        ...frame,
        left: frame.left + (index % 4) * npcSize,
        top: frame.top + Math.floor(index / 4) * npcSize,
      })),
    )
    .webp({ lossless: true, effort: 5 })
    .toFile('public/assets/npcs/watchers-painted.webp');
}
