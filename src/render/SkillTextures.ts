import { Assets, Texture } from 'pixi.js';
import { getSkillSvg } from '../data/visuals';

const textures = new Map<string, Texture>();

/** Native 24px artwork stays crisp through the same texture cache as the UI. */
export async function preloadSkillTextures(ids: string[]): Promise<void> {
  await Promise.all(
    [...new Set(ids)].map(async (id) => {
      if (textures.has(id)) return;
      const svg = getSkillSvg(id);
      if (!svg) throw new Error(`技能视觉配置缺失：${id}`);
      const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      const texture = await Assets.load<Texture>({ src, data: { resolution: 1 } });
      texture.source.scaleMode = 'nearest';
      textures.set(id, texture);
    }),
  );
}

export function getSkillTexture(id: string): Texture | undefined {
  return textures.get(id);
}
