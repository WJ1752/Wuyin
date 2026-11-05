import { getAtlasTexture, preloadAtlas } from './TextureAtlas';
import { CAST_ART, EFFECT_CELLS, GROUND_CELLS, type EffectArt } from '../data/skillArt';

/** UI illustrations and transparent in-world casts are separate assets. */
export async function preloadSkillTextures(ids: string[]): Promise<void> {
  const sources = new Set(ids.map((id) => CAST_ART[id]?.src).filter(Boolean));
  const sheets = [...sources].map((src) =>
    preloadAtlas(
      src,
      4,
      2,
      Object.entries(CAST_ART)
        .filter(([, frame]) => frame.src === src)
        .map(([id, f]) => [id, f.column, f.row]),
    ),
  );
  sheets.push(
    preloadAtlas(
      './assets/skills/ground.webp',
      4,
      2,
      GROUND_CELLS.map((id, i) => [`fx:${id}`, i % 4, Math.floor(i / 4)]),
    ),
    preloadAtlas(
      './assets/skills/effects.webp',
      4,
      3,
      EFFECT_CELLS.map((id, i) => [`fx:${id}`, i % 4, Math.floor(i / 4)]),
    ),
  );
  await Promise.all(sheets);
}
export const getSkillTexture = (id: string) => getAtlasTexture(id);
export const getEffectTexture = (id: EffectArt) => getAtlasTexture(`fx:${id}`);
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
