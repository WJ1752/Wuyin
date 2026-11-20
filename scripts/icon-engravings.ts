import type { PixelMotif } from '../src/data/pixelArt';

// Line engravings for the existing main and supporting spell motifs. The strokes
// leave open space around each silhouette so the same seal reads in the skill
// tree, at the center of the action bar, and on a narrow phone in motion.
const motifs: Partial<Record<PixelMotif, string>> = {
  arrow: 'M3 21 20 4M13 4h7v7M5 15l-2 6 6-2M6 14h4m0 4v-4',
  crosshair: 'M12 2v5m0 10v5M2 12h5m10 0h5M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
  flame:
    'M13 2c1 5-1 7-2 9-2-1-3-3-3-5-3 3-5 6-5 9a9 9 0 1 0 18 0c0-3-2-6-4-8 0 3-1 5-3 6 1-4 1-8-1-11ZM12 13c-1 2-4 3-4 5a4 4 0 0 0 8 0c0-2-2-3-4-5Z',
  ice: 'M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3m-6 16 3-3 3 3M3 10l5-.5V5m13 9-5 .5V19M3 14l5 .5V19m13-9-5-.5V5',
  bolt: 'M14 2 4 14h7l-1 8L21 9h-8l1-7Z',
  gem: 'M6 4h12l4 5-10 12L2 9l4-5Zm-4 5h20m-10 12L8 9l4-5 4 5-4 12',
  boot: 'M7 3h9l-1 9c0 2 2 2 4 3l2 2v3H3v-4l4-5V3Zm-4 14h18M7 7h7m-7 3h7',
  wave: 'M2 8c3 0 4-3 6-3s3 3 5 3 4-3 6-3h3M2 13c3 0 4-3 6-3s3 3 5 3 4-3 6-3h3M2 18c3 0 4-3 6-3s3 3 5 3 4-3 6-3h3',
  cloud: 'M6 18a4 4 0 0 1-1-8 6 6 0 0 1 11-3 5 5 0 1 1 3 11H6Zm1 3h6m4 0h3',
  raven: 'M3 4c5 1 8 4 9 7 3-1 5-2 8 0l2 1-3 1-3 5-8 3 2-4H4l4-3C5 12 3 8 3 4Z',
  eye: 'M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  mask: 'M3 5 8 3l4 3 4-3 5 2-2 11-7 5-7-5L3 5Zm4 5 3 2-3 1-1-2m11-1-3 2 3 1 1-2m-7 5h2',
  axe: 'M15 4 8 21H5L12 3m0 6L6 8 4 5l1-2 8 2 5-2 3 3-1 5-6-1',
  sword: 'M20 3 18 9 8 19l-3-3L15 6l5-3ZM7 14l4 4m-5 0-3 3m1-5-2 2',
  hammer: 'm11 11-6 9H2l6-10m0-8 13 5-3 7-13-5 3-7Zm2 2-2 6m10-3-2 6',
  star: 'M12 2 14.6 9.4 22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z',
  bone: 'M7 4a3 3 0 1 0-3 4l12 12a3 3 0 0 0 5 1c2-1 1-4-1-5L8 4c1-2-3-5-4-1',
  swirl: 'M21 10c-1-5-7-8-12-6C2 7 1 14 5 18c4 5 12 4 14-1 3-5-3-9-7-7-3 1-3 4-1 5 2 1 4-1 3-2',
  ghost: 'M4 13a8 8 0 1 1 16 0v8l-4-3-4 3-4-3-4 3v-8Zm4-1v1m8-1v1',
  hook: 'M12 2v10c0 2 3 3 4 1l1-3 2 2v3a6 6 0 1 1-12 0V6l5-4m-5 4h5',
  horn: 'M2 8c7 1 12 0 19-5 1 5 0 11-4 15-4 4-9 3-12-1L2 8Zm2 4c7 0 12-3 17-7m-15 9 1 4m3-6 2 7',
  shield: 'M12 2 21 6v6c0 6-4 8-9 10-5-2-9-4-9-10V6l9-4Zm0 4v11m-4-6h8',
  drop: 'M12 2c3 5 8 10 8 14a8 8 0 1 1-16 0c0-4 5-9 8-14ZM8 16c0 2 1 3 3 4',
  skull: 'M3 11a9 9 0 0 1 18 0v4l-4 2v4H7v-4l-4-2v-4Zm4 1h2m6 0h2m-5 4v1m-2 2v2m4-2v2',
  orb: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c-3 4-4 13 0 18m-9-9c4 3 14 3 18 0',
  meteor:
    'M21 3c-5 1-9 4-12 6C5 10 3 12 3 15a6 6 0 0 0 6 6c4 0 7-4 8-7l2 1 2-6-3 2 3-8ZM6 16l2-2m3 3 2-2M3 7l3-2m6 1 3-3',
  portal: 'M4 21V11a8 8 0 0 1 16 0v10H4Zm4-4v-6a4 4 0 0 1 8 0v6h-8ZM2 21h20M12 3v4',
  book: 'M12 21c-3-3-7-3-10-2V5c4-1 7-1 10 2 3-3 6-3 10-2v14c-3-1-7-1-10 2Zm0-14v14M5 9c2 0 3 0 4 1m6 0 4-1M5 13l4 1m6 0 4-1',
  scythe: 'M5 22 15 4m0 0c-4-3-11-1-13 5 4-2 8-3 12-1m1-4 4 2-2 4-3-2',
  claw: 'M18 3c-2 4-5 4-7 8l-1 3m12-9c-1 5-5 6-7 10l-1 3M12 2C8 5 5 8 4 13l-1 5m16-4-6 8m-7-4-2 3',
  leaf: 'M21 3C8 2 3 6 3 12c0 4 3 7 7 7 6 0 11-5 11-16ZM2 22 17 7M8 16v-5m4 1 5 1',
  vine: 'M5 22c2-7 8-8 7-13s3-7 5-5c1 2-1 4-3 4M6 17C2 15 2 12 3 9c4 0 6 2 5 5m3-3c2 0 5 1 8-2 0 5-3 8-8 7',
  mushroom: 'M2 11C3 6 8 3 12 3s9 3 10 8c-4 3-16 3-20 0Zm7 2v5l-2 2h10l-2-2v-5M8 7v1m8-1v1m-4 1v1',
  wolf: 'M2 3 8 7l4-1 4 1 6-4-2 12-8 7-8-7L2 3Zm5 8 3 1m7-1-3 1m-3 4h2l-1 2-1-2Z',
};

export function engravingGlyph(motif: PixelMotif, x: number, y: number, scale: number, angle = 0) {
  const path = motifs[motif];
  if (!path) throw new Error(`Missing engraving for ${motif}`);
  return `<path d="${path}" transform="translate(${x} ${y}) scale(${scale}) rotate(${angle} 12 12)"/>`;
}
