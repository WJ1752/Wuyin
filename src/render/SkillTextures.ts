import { Assets, Rectangle, Texture } from 'pixi.js';
import { CAST_ART, EFFECT_CELLS, GROUND_CELLS, type EffectArt } from '../data/skillArt';

const textures = new Map<string, Texture>();
const pending = new Map<string, Promise<void>>();

function loadSheet(src: string, columns: number, rows: number, frames: [string, number, number][]) {
  const previous = pending.get(src);
  if (previous) return previous;
  const request = Assets.load<Texture>(src)
    .then((atlas) => {
      const width = atlas.width / columns,
        height = atlas.height / rows;
      for (const [id, column, row] of frames) {
        textures.set(
          id,
          new Texture({
            source: atlas.source,
            frame: new Rectangle(column * width, row * height, width, height),
          }),
        );
      }
    })
    .catch(() => {
      // Geometry renderers remain available if a sheet is interrupted. Retry next rift.
      pending.delete(src);
    });
  pending.set(src, request);
  return request;
}

/** UI illustrations and transparent in-world casts are separate assets. */
export async function preloadSkillTextures(ids: string[]): Promise<void> {
  const sources = new Set(ids.map((id) => CAST_ART[id]?.src).filter(Boolean));
  const sheets = [...sources].map((src) =>
    loadSheet(
      src,
      4,
      2,
      Object.entries(CAST_ART)
        .filter(([, frame]) => frame.src === src)
        .map(([id, f]) => [id, f.column, f.row]),
    ),
  );
  sheets.push(
    loadSheet(
      './assets/skills/ground.webp',
      4,
      2,
      GROUND_CELLS.map((id, i) => [`fx:${id}`, i % 4, Math.floor(i / 4)]),
    ),
    loadSheet(
      './assets/skills/effects.webp',
      4,
      3,
      EFFECT_CELLS.map((id, i) => [`fx:${id}`, i % 4, Math.floor(i / 4)]),
    ),
  );
  await Promise.all(sheets);
}
export const getSkillTexture = (id: string) => textures.get(id);
export const getEffectTexture = (id: EffectArt) => textures.get(`fx:${id}`);
export function getZoneTexture(skillId: string | undefined, icy: boolean) {
  if (skillId === 'meteor') return getEffectTexture(icy ? 'frostfield' : 'scorch');
  if (skillId === 'tumble') return getEffectTexture('caltrops');
  return (skillId && getSkillTexture(skillId)) || getEffectTexture('vortex');
}

export function getProjectileArt(skillId: string, color: number) {
  const texture = getSkillTexture(skillId);
  if (texture) return { texture, tint: 0xffffff };
  let shape: EffectArt = 'arrow';
  if (skillId.includes('orb')) shape = 'orb';
  else if (skillId.includes('missile')) shape = 'missile';
  else if (/spear|splinter|spike/.test(skillId)) shape = 'bone';
  else if (/blade|knives/.test(skillId)) shape = 'blade';
  return { texture: getEffectTexture(shape), tint: color };
}
