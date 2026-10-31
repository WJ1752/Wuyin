import { Assets, Texture } from 'pixi.js';
import { PET_ART } from '../data/petVisuals';

const textures = new Map<string, Texture>();

/** Combat and the companion panel share the same full-body pixel artwork. */
export async function preloadPetTexture(id: string) {
  const art = PET_ART[id] ?? PET_ART.owl;
  const texture = await Assets.load<Texture>(art.src);
  texture.source.scaleMode = 'nearest';
  textures.set(id, texture);
}

export function getPetTexture(id: string) {
  return textures.get(id);
}
