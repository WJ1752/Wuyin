import { Assets, Rectangle, Texture, type SCALE_MODE } from 'pixi.js';

const textures = new Map<string, Texture>();
const pending = new Map<string, Promise<void>>();

export function preloadAtlas(
  src: string,
  columns: number,
  rows: number,
  frames: [string, number, number][],
  scaleMode?: SCALE_MODE,
) {
  const previous = pending.get(src);
  if (previous) return previous;
  const request = Assets.load<Texture>(src)
    .then((atlas) => {
      if (scaleMode) atlas.source.scaleMode = scaleMode;
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
      // Allow a later preload to retry if the image was unavailable.
      pending.delete(src);
    });
  pending.set(src, request);
  return request;
}

export const getAtlasTexture = (id: string) => textures.get(id);
