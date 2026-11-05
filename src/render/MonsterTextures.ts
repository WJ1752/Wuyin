import { preloadAtlas } from './TextureAtlas';

// Row-major order in the packed bestiary atlas.
const ids = [
  'skeleton', 'bone_archer', 'rot_zombie', 'poison_tick', 'abyss_minotaur', 'shadow_stalker',
  'ice_shaman', 'magma_golem', 'night_bat', 'grave_spider', 'wraith', 'cult_acolyte',
  'thorn_ent', 'dire_wolf', 'plague_rat', 'fallen_knight', 'sand_scorpion', 'ember_imp',
  'blood_leech', 'void_eye', 'bone_drake', 'chain_jailer', 'frost_revenant', 'abyss_serpent',
  'grave_king', 'thorn_matriarch', 'cinder_lord', 'void_abbess', 'winter_wyrm', 'blood_butcher',
  'storm_archon', 'mist_devourer', 'treasure_goblin', 'training_dummy',
];

export function preloadMonsterTextures() {
  return preloadAtlas(
    'assets/monsters/bestiary.webp',
    6,
    6,
    ids.map((id, i) => [`monster:${id}`, i % 6, Math.floor(i / 6)]),
    'nearest',
  );
}
