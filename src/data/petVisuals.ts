/** Generated companion art: one transparent 512px frame shared by UI and combat.
 * Origins follow the paws/hover base, rather than the atlas cell's transparent margin.
 * Source atlas, crop order and generation brief: docs/COMPANION_ART.md.
 */
export const PET_ART: Record<string, { src: string; anchorX: number; ground: number }> = {
  goblin: { src: './assets/pets/goblin.png', anchorX: 0.53, ground: 480 / 512 },
  dragon: { src: './assets/pets/dragon.png', anchorX: 0.52, ground: 480 / 512 },
  owl: { src: './assets/pets/owl.png', anchorX: 0.5, ground: 494 / 512 },
  imp: { src: './assets/pets/imp.png', anchorX: 0.5, ground: 459 / 512 },
  fox: { src: './assets/pets/fox.png', anchorX: 0.51, ground: 494 / 512 },
  wisp: { src: './assets/pets/wisp.png', anchorX: 0.5, ground: 494 / 512 },
};
