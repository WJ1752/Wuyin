import { Assets, Texture } from 'pixi.js';
import { getSkillSvg } from '../data/visuals';

const textures = new Map<string, Texture>();

/** UI and combat share the same per-skill artwork; Pixi caches the rasterized SVG. */
export async function preloadSkillTextures(ids: string[]): Promise<void> {
  await Promise.all(
    [...new Set(ids)].map(async (id) => {
      if (textures.has(id)) return;
      const svg = getSkillSvg(id);
      if (!svg) throw new Error(`技能视觉配置缺失：${id}`);
      const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      const texture = await Assets.load<Texture>({ src, data: { resolution: 2 } });
      textures.set(id, texture);
    }),
  );
}

export function getSkillTexture(id: string): Texture | undefined {
  return textures.get(id);
}
