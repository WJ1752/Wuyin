const painted = (id: string, flies = false) => ({
  src: `./assets/pets/painted/${id}.webp`,
  action: `./assets/pets/painted/${id}-action.webp`,
  anchorX: 0.5,
  ground: 88 / 96,
  flies,
});

/** The companion panel and combat share the same art and foot origin. */
export const PET_ART: Record<string, ReturnType<typeof painted>> = {
  goblin: painted('goblin'),
  dragon: painted('dragon', true),
  owl: painted('owl', true),
  imp: painted('imp', true),
  fox: painted('fox'),
  wisp: painted('wisp', true),
};
