import { PixelArt, pixelMotif, type PixelMotif } from './pixelArt';
import type { Element, Item, Slot } from '../core/types';
import { RARITY_COLORS, SLOTS } from '../core/types';
import { SKILLS } from './skillTrees';
import { LEGENDARIES } from './legendaries';
import { SETS } from './sets';

export interface VisualLayer {
  path: string;
  transform?: string;
  fill?: string;
}
export interface AssetVisual {
  key: string;
  color: string;
  layers: readonly VisualLayer[];
}
export type SkillShape =
  'arrow' | 'blade' | 'burst' | 'orbit' | 'bolt' | 'wave' | 'ward' | 'spirit';
export interface SkillVisual extends AssetVisual {
  effectKey: string;
  shape: SkillShape;
}

/** Geometry is already authored on a 24px grid; no blur or raster filter is used. */
export function visualToSvg(visual: AssetVisual): string {
  const paths = visual.layers
    .map((layer) => `<path d="${layer.path}" fill="${layer.fill ?? visual.color}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" shape-rendering="crispEdges">${paths}</svg>`;
}

export function getSkillSvg(id: string): string | undefined {
  const visual = SKILL_VISUALS[id];
  return visual ? visualToSvg(visual) : undefined;
}

const ELEMENT_PALETTE: Record<Element, string> = {
  physical: '#e5d2a5',
  fire: '#f3a15e',
  ice: '#a4e9f4',
  lightning: '#c4c4ff',
  arcane: '#d6a5f4',
  poison: '#b1da8c',
};

type Composition =
  | 'single'
  | 'split'
  | 'fan'
  | 'volley'
  | 'rain'
  | 'dash'
  | 'arc'
  | 'impact'
  | 'wings'
  | 'crossed'
  | 'ring';
// Ability identities are composed from original filled pixel motifs. Variants
// change silhouettes and motion, rather than recoloring their parent's icon.
const SKILL_ART: Record<string, [SkillShape, PixelMotif, PixelMotif, Composition]> = {
  hunting_arrow: ['arrow', 'arrow', 'crosshair', 'single'],
  explosive_arrow: ['burst', 'arrow', 'flame', 'impact'],
  split_arrow: ['arrow', 'arrow', 'arrow', 'split'],
  frost_pierce: ['arrow', 'arrow', 'ice', 'single'],
  rapid_fire: ['arrow', 'arrow', 'bolt', 'volley'],
  elemental_arrow: ['arrow', 'arrow', 'gem', 'single'],
  fan_barrage: ['arrow', 'arrow', 'arrow', 'fan'],
  laser_arrow: ['bolt', 'bolt', 'arrow', 'dash'],
  tumble: ['wave', 'boot', 'wave', 'dash'],
  arrow_rain: ['arrow', 'arrow', 'cloud', 'rain'],
  raven: ['spirit', 'raven', 'eye', 'single'],
  vengeance: ['spirit', 'mask', 'raven', 'wings'],
  steady_aim: ['arrow', 'crosshair', 'arrow', 'single'],
  ballistics: ['arrow', 'arrow', 'crosshair', 'arc'],
  night_hunt: ['spirit', 'raven', 'arrow', 'arc'],
  frenzy: ['blade', 'axe', 'sword', 'crossed'],
  bash: ['burst', 'hammer', 'star', 'impact'],
  frenzy_flurry: ['blade', 'sword', 'axe', 'ring'],
  seismic_bash: ['burst', 'hammer', 'bone', 'impact'],
  whirlwind: ['orbit', 'sword', 'swirl', 'ring'],
  ancestor_hammer: ['burst', 'hammer', 'ghost', 'single'],
  hurricane: ['orbit', 'swirl', 'cloud', 'single'],
  lava_whirl: ['orbit', 'flame', 'swirl', 'ring'],
  iron_hook: ['blade', 'hook', 'bone', 'single'],
  war_cry: ['wave', 'horn', 'wave', 'single'],
  charge: ['wave', 'shield', 'boot', 'dash'],
  berserker: ['spirit', 'mask', 'axe', 'wings'],
  bloodthirst: ['spirit', 'drop', 'sword', 'single'],
  ruthless: ['blade', 'sword', 'skull', 'impact'],
  thick_skin: ['ward', 'shield', 'gem', 'single'],
  electrocute: ['bolt', 'bolt', 'star', 'single'],
  magic_missile: ['arrow', 'orb', 'star', 'dash'],
  chain_lightning: ['bolt', 'bolt', 'bolt', 'split'],
  seeking_missile: ['arrow', 'orb', 'crosshair', 'arc'],
  meteor: ['burst', 'meteor', 'flame', 'single'],
  frozen_orb: ['orbit', 'orb', 'ice', 'ring'],
  meteor_shower: ['burst', 'meteor', 'cloud', 'rain'],
  frost_meteor: ['burst', 'meteor', 'ice', 'impact'],
  teleport: ['wave', 'portal', 'shield', 'dash'],
  black_hole: ['orbit', 'orb', 'swirl', 'ring'],
  frost_nova: ['burst', 'ice', 'star', 'impact'],
  archon: ['spirit', 'ghost', 'bolt', 'wings'],
  elemental_exposure: ['ward', 'gem', 'flame', 'ring'],
  glass_cannon: ['bolt', 'gem', 'bolt', 'impact'],
  prodigy: ['ward', 'book', 'bolt', 'single'],
  bone_spike: ['blade', 'bone', 'bone', 'fan'],
  siphon: ['wave', 'drop', 'ghost', 'dash'],
  bone_splinters: ['burst', 'bone', 'skull', 'split'],
  blood_drain: ['wave', 'drop', 'wave', 'ring'],
  death_scythe: ['blade', 'scythe', 'skull', 'single'],
  bone_spear: ['arrow', 'bone', 'arrow', 'dash'],
  poison_scythe: ['blade', 'scythe', 'drop', 'single'],
  shatter_spear: ['arrow', 'bone', 'ice', 'impact'],
  command_skeletons: ['spirit', 'skull', 'sword', 'single'],
  decrepify: ['ward', 'skull', 'hook', 'ring'],
  blood_step: ['wave', 'boot', 'drop', 'dash'],
  army_of_dead: ['spirit', 'skull', 'ghost', 'volley'],
  final_service: ['ward', 'shield', 'skull', 'single'],
  spreading_malediction: ['wave', 'skull', 'wave', 'split'],
  overwhelming_essence: ['spirit', 'ghost', 'orb', 'single'],
  storm_claw: ['blade', 'claw', 'bolt', 'single'],
  flying_blade: ['blade', 'sword', 'leaf', 'dash'],
  thunder_claw: ['bolt', 'claw', 'bolt', 'impact'],
  return_blade: ['orbit', 'sword', 'swirl', 'arc'],
  fan_of_knives: ['blade', 'sword', 'sword', 'fan'],
  poison_vine: ['wave', 'vine', 'drop', 'single'],
  blood_fan: ['blade', 'sword', 'drop', 'fan'],
  spore_vine: ['wave', 'mushroom', 'vine', 'single'],
  shadow_step: ['wave', 'boot', 'ghost', 'arc'],
  hurricane_break: ['orbit', 'swirl', 'gem', 'impact'],
  earthen_bulwark: ['ward', 'shield', 'leaf', 'ring'],
  thunder_wolf: ['spirit', 'wolf', 'bolt', 'single'],
  predator: ['spirit', 'eye', 'claw', 'single'],
  toxic_blood: ['spirit', 'drop', 'skull', 'single'],
  stormborn: ['bolt', 'cloud', 'bolt', 'single'],
};

function skillPixels(id: string): PixelArt {
  const [, main, secondary, layout] = SKILL_ART[id];
  const art = new PixelArt(),
    glyph = pixelMotif(main),
    detail = pixelMotif(secondary);
  switch (layout) {
    case 'single':
      art.stamp(glyph, 0, 1, 22).stamp(detail, 14, 13, 10);
      break;
    case 'split':
      art.stamp(glyph, 0, 0, 13).stamp(glyph, 11, 0, 13).stamp(detail, 5, 9, 16);
      break;
    case 'fan':
      art.stamp(glyph, 0, 2, 14, true).stamp(glyph, 10, 2, 14).stamp(detail, 5, 9, 16);
      break;
    case 'volley':
      art.stamp(glyph, 0, 0, 13).stamp(glyph, 11, 5, 13).stamp(detail, 0, 11, 13);
      break;
    case 'rain':
      art
        .stamp(detail, 2, 0, 14)
        .stamp(glyph, 10, 0, 14)
        .stamp(glyph, 0, 10, 14)
        .stamp(glyph, 11, 11, 13);
      break;
    case 'dash':
      art
        .line(2, 8, 8, 8, 1)
        .line(0, 12, 6, 12, 2)
        .line(3, 17, 9, 17, 3)
        .stamp(glyph, 5, 0, 21)
        .stamp(detail, 0, 14, 10);
      break;
    case 'arc':
      art
        .line(3, 12, 3, 5, 2)
        .line(3, 5, 8, 1, 2)
        .line(8, 1, 17, 1, 3)
        .stamp(glyph, 5, 4, 20)
        .stamp(detail, 0, 14, 10);
      break;
    case 'impact':
      art
        .stamp(glyph, 1, 0, 20)
        .stamp(detail, 12, 12, 12)
        .rect(1, 18, 3, 2, 3)
        .rect(5, 21, 2, 2, 2)
        .rect(21, 5, 2, 3, 3);
      break;
    case 'wings':
      art.stamp(detail, 0, 4, 13, true).stamp(detail, 11, 4, 13).stamp(glyph, 4, 1, 19);
      break;
    case 'crossed':
      art.stamp(detail, 0, 0, 23, true).stamp(glyph, 1, 1, 23);
      break;
    case 'ring':
      art.stamp(detail, 0, 0, 24).stamp(glyph, 4, 4, 16);
      break;
  }
  return art;
}

export const SKILL_VISUALS: Record<string, SkillVisual> = Object.fromEntries(
  SKILLS.map((skill) => [
    skill.id,
    {
      key: `skill:${skill.id}`,
      effectKey: skill.id,
      shape: SKILL_ART[skill.id][0],
      color: ELEMENT_PALETTE[skill.element],
      layers: skillPixels(skill.id).layers(ELEMENT_PALETTE[skill.element]),
    },
  ]),
);

type GearShape =
  | Slot
  | 'winged_boots'
  | 'bow'
  | 'crossbow'
  | 'quiver'
  | 'blade'
  | 'dual'
  | 'hammer'
  | 'staff'
  | 'scythe'
  | 'orb'
  | 'mirror'
  | 'pendant'
  | 'feather'
  | 'lantern'
  | 'totem'
  | 'branch'
  | 'claw';

export const EQUIPMENT_SHAPES: readonly GearShape[] = [
  'weapon',
  'offhand',
  'head',
  'chest',
  'hands',
  'legs',
  'feet',
  'jewelry',
  'winged_boots',
  'bow',
  'crossbow',
  'quiver',
  'blade',
  'dual',
  'hammer',
  'staff',
  'scythe',
  'orb',
  'mirror',
  'pendant',
  'feather',
  'lantern',
  'totem',
  'branch',
  'claw',
];
interface EquipmentVisual extends AssetVisual {
  shape: GearShape;
  motif: string;
}

export function equipmentCrestSvg({ motif, color }: EquipmentVisual) {
  return visualToSvg({ key: motif, color, layers: skillPixels(motif).layers(color) });
}

function gearPixels(shape: GearShape): PixelArt {
  const p = new PixelArt();
  switch (shape) {
    case 'weapon':
    case 'blade':
      return pixelMotif('sword');
    case 'offhand':
      return pixelMotif('shield');
    case 'hammer':
      return pixelMotif('hammer');
    case 'scythe':
      return pixelMotif('scythe');
    case 'claw':
      return pixelMotif('claw');
    case 'feet':
      return pixelMotif('boot');
    case 'orb':
      return pixelMotif('orb').rect(6, 21, 12, 2, 4);
    case 'branch':
      return pixelMotif('vine');
    case 'head':
      p.poly([5, 7, 9, 3, 15, 3, 19, 7, 20, 20, 15, 18, 15, 12, 9, 12, 9, 18, 4, 20], 2)
        .rect(5, 9, 14, 3, 1)
        .rect(8, 5, 7, 2, 3)
        .rect(11, 3, 2, 9, 4);
      break;
    case 'chest':
      p.poly(
        [8, 3, 10, 6, 14, 6, 16, 3, 21, 6, 23, 13, 18, 15, 18, 22, 6, 22, 6, 15, 1, 13, 3, 6],
        2,
      )
        .rect(6, 18, 12, 3, 4)
        .rect(5, 6, 3, 4, 3)
        .rect(16, 6, 3, 4, 3)
        .rect(11, 7, 2, 10, 1);
      break;
    case 'hands':
      p.rect(7, 8, 12, 11, 2)
        .rect(7, 3, 3, 8, 2)
        .rect(11, 2, 3, 8, 2)
        .rect(15, 4, 3, 7, 2)
        .rect(19, 7, 3, 9, 2)
        .poly([7, 13, 3, 10, 1, 12, 4, 19, 8, 22], 2)
        .rect(7, 19, 13, 3, 4)
        .rect(8, 10, 10, 2, 3);
      break;
    case 'legs':
      p.rect(5, 3, 14, 6, 2)
        .poly([5, 8, 19, 8, 19, 15, 17, 22, 13, 22, 12, 12, 11, 22, 7, 22, 5, 15], 2)
        .rect(5, 4, 14, 2, 4)
        .rect(6, 10, 3, 6, 3)
        .rect(15, 10, 3, 6, 3);
      break;
    case 'winged_boots':
      p.stamp(pixelMotif('boot'), 4, 0, 22).poly([9, 14, 2, 10, 1, 4, 6, 7, 5, 2, 11, 8], 3);
      break;
    case 'jewelry':
      p.poly([7, 9, 17, 9, 21, 13, 21, 19, 17, 23, 7, 23, 3, 19, 3, 13], 4)
        .rect(7, 13, 10, 6, 0)
        .stamp(pixelMotif('gem'), 6, 0, 13);
      break;
    case 'bow':
      p.poly([5, 2, 11, 4, 18, 10, 18, 14, 11, 20, 5, 22, 8, 17, 12, 12, 8, 7], 4)
        .line(6, 3, 6, 21, 3)
        .line(2, 12, 21, 12, 2)
        .poly([18, 8, 23, 12, 18, 16], 3);
      break;
    case 'crossbow':
      p.line(5, 19, 18, 6, 4, 4)
        .poly([2, 5, 7, 2, 20, 15, 22, 21, 17, 18, 5, 6], 2)
        .line(5, 5, 19, 18, 3)
        .line(4, 7, 18, 21, 4);
      break;
    case 'quiver':
      p.poly([5, 8, 19, 10, 16, 23, 3, 20], 4)
        .rect(5, 8, 14, 3, 2)
        .line(9, 9, 12, 1, 3, 2)
        .line(15, 9, 18, 2, 3, 2)
        .rect(6, 13, 9, 3, 2);
      break;
    case 'dual':
      p.stamp(pixelMotif('sword'), 0, 0, 22).stamp(pixelMotif('sword'), 1, 1, 22, true);
      break;
    case 'staff':
      p.line(7, 22, 15, 5, 4, 3).stamp(pixelMotif('gem'), 7, 0, 15);
      break;
    case 'mirror':
      p.poly([9, 2, 15, 2, 19, 7, 19, 16, 15, 20, 9, 20, 5, 16, 5, 7], 4)
        .rect(9, 6, 6, 10, 2)
        .line(9, 13, 14, 8, 3)
        .rect(10, 20, 4, 3, 4);
      break;
    case 'pendant':
      p.line(3, 2, 7, 11, 4)
        .line(21, 2, 17, 11, 4)
        .line(7, 11, 12, 14, 4)
        .line(17, 11, 12, 14, 4)
        .stamp(pixelMotif('gem'), 5, 11, 14);
      break;
    case 'feather':
      p.poly([5, 18, 6, 10, 13, 4, 21, 2, 20, 11, 14, 18], 2)
        .line(3, 22, 18, 6, 3)
        .line(10, 15, 18, 14, 3);
      break;
    case 'lantern':
      p.rect(9, 2, 6, 2, 4)
        .rect(7, 4, 2, 3, 4)
        .rect(15, 4, 2, 3, 4)
        .rect(5, 7, 14, 3, 4)
        .rect(5, 10, 2, 9, 4)
        .rect(17, 10, 2, 9, 4)
        .rect(5, 19, 14, 3, 4)
        .stamp(pixelMotif('flame'), 7, 8, 10);
      break;
    case 'totem':
      p.rect(7, 3, 10, 19, 4)
        .poly([7, 8, 2, 4, 2, 14, 7, 17], 2)
        .poly([17, 8, 22, 4, 22, 14, 17, 17], 2)
        .rect(9, 7, 6, 3, 3)
        .rect(9, 13, 6, 3, 2)
        .rect(7, 20, 10, 2, 3);
      break;
  }
  return p;
}

// A legendary's outline and engraving are explicit, so similarly colored items
// remain distinguishable in inventory and the extracted-power archive.
const LEGENDARY_ART: Record<string, [GearShape, string]> = {
  oraviel: ['hands', 'steady_aim'],
  immortal_armor: ['chest', 'final_service'],
  olda: ['legs', 'bloodthirst'],
  sacred_walkers: ['winged_boots', 'archon'],
  aquila: ['chest', 'raven'],
  elements: ['jewelry', 'elemental_exposure'],
  zodiac: ['jewelry', 'black_hole'],
  berserker_charm: ['pendant', 'berserker'],
  nemesis: ['hands', 'vengeance'],
  squirt: ['pendant', 'frozen_orb'],
  dawn: ['crossbow', 'stormborn'],
  yang: ['bow', 'arrow_rain'],
  dead_mans: ['quiver', 'command_skeletons'],
  ninth_satchel: ['quiver', 'rapid_fire'],
  froststring: ['bow', 'frost_nova'],
  ravenwing: ['feather', 'raven'],
  windforce: ['bow', 'hurricane'],
  bulkathos: ['dual', 'whirlwind'],
  judgment: ['hammer', 'thick_skin'],
  lamentation: ['blade', 'bloodthirst'],
  gavel: ['hammer', 'seismic_bash'],
  pride: ['offhand', 'war_cry'],
  oathkeeper: ['blade', 'archon'],
  shield_of_ancients: ['offhand', 'bone_spike'],
  grand_vizier: ['staff', 'meteor'],
  endless_depths: ['orb', 'frozen_orb'],
  deathwish: ['staff', 'archon'],
  etched_sigil: ['orb', 'black_hole'],
  serpent_spark: ['staff', 'chain_lightning'],
  winterglass: ['mirror', 'frost_nova'],
  cosmic_strand: ['orb', 'teleport'],
  jesseth: ['scythe', 'command_skeletons'],
  corroded_fang: ['scythe', 'toxic_blood'],
  reilena: ['scythe', 'overwhelming_essence'],
  nayr: ['scythe', 'poison_vine'],
  bone_relic: ['lantern', 'bone_splinters'],
  bloodtide: ['lantern', 'blood_drain'],
  funerary_pick: ['scythe', 'siphon'],
  greenstone: ['blade', 'fan_of_knives'],
  venom_source: ['totem', 'poison_vine'],
  moonfang: ['claw', 'night_hunt'],
  stormheart: ['orb', 'stormborn'],
  plaguebranch: ['branch', 'spore_vine'],
  shadowfang: ['blade', 'shadow_step'],
  earthward: ['totem', 'earthen_bulwark'],
};

function gearVisual(key: string, shape: GearShape, motif: string, color: string): EquipmentVisual {
  const art = gearPixels(shape);
  if (key.startsWith('legendary:')) {
    art.rect(11, 11, 12, 2, 4).rect(11, 13, 2, 9, 4).rect(13, 21, 10, 2, 4);
  }
  // A readable 9px crest and offset silhouette preserve each named item's
  // identity. This also remains visible on small inventory cards.
  art.stamp(skillPixels(motif), 12, 12, 11);
  return { key, color, shape, motif, layers: art.layers(color) };
}

export const LEGENDARY_VISUALS: Record<string, EquipmentVisual> = Object.fromEntries(
  LEGENDARIES.map((legend) => {
    const [shape, motif] = LEGENDARY_ART[legend.id];
    return [legend.id, gearVisual(`legendary:${legend.id}`, shape, motif, '#e8bf79')];
  }),
);

const SET_CRESTS: Record<string, string> = {
  stormcaller: 'stormborn',
  marauder: 'rapid_fire',
  frost_hunter: 'frost_pierce',
  wasteland: 'whirlwind',
  earthbreaker: 'seismic_bash',
  immortal_thorns: 'bone_spike',
  tal_rasha: 'elemental_exposure',
  delsere: 'frost_nova',
  vyr: 'archon',
  rathma: 'command_skeletons',
  trang_oul: 'poison_scythe',
  inarius: 'final_service',
  shadow_blades: 'fan_of_knives',
  wild_vines: 'poison_vine',
  storm_wolf: 'thunder_wolf',
};

export const SET_VISUALS: Record<string, EquipmentVisual> = Object.fromEntries(
  SETS.flatMap((set) =>
    SLOTS.map((slot) => {
      const art = gearPixels(slot);
      art.poly([17, 10, 23, 16, 23, 20, 19, 23, 14, 23, 10, 18, 10, 15], 4);
      art.stamp(skillPixels(SET_CRESTS[set.id]), 12, 12, 11);
      return [
        `${set.id}:${slot}`,
        {
          key: `set:${set.id}:${slot}`,
          color: set.color,
          shape: slot,
          motif: SET_CRESTS[set.id],
          layers: art.layers(set.color),
        },
      ];
    }),
  ),
);

const ORDINARY_SERIES = {
  common: ['旅人', 'tumble'],
  uncommon: ['守望', 'thick_skin'],
  rare: ['暮色', 'night_hunt'],
  epic: ['幽影', 'shadow_step'],
  legendary: ['圣遗', 'archon'],
  set: ['契约', 'prodigy'],
  primal: ['永恒', 'overwhelming_essence'],
} as const;

export const ORDINARY_VISUALS: Record<string, EquipmentVisual> = Object.fromEntries(
  Object.entries(ORDINARY_SERIES).flatMap(([rarity, [name, motif]]) =>
    SLOTS.map((slot) => [
      `${name}:${slot}`,
      gearVisual(`ordinary:${name}:${slot}`, slot, motif, RARITY_COLORS[rarity as Item['rarity']]),
    ]),
  ),
);

/** Stable, shared index for generated world-drop art and runtime rendering. */
export const EQUIPMENT_DROP_CATALOG = [
  ...Object.values(ORDINARY_VISUALS),
  ...Object.values(SET_VISUALS),
  ...Object.values(LEGENDARY_VISUALS),
].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
export const EQUIPMENT_DROP_INDEX = new Map(
  EQUIPMENT_DROP_CATALOG.map((visual, index) => [visual.key, index]),
);
export const EQUIPMENT_ATLAS = {
  src: './assets/maps/equipment-drops.webp',
  columns: 16,
  rows: Math.ceil(EQUIPMENT_DROP_CATALOG.length / 16),
  cell: 48,
};

export type ItemVisualIdentity = Pick<Item, 'slot'> &
  Partial<Pick<Item, 'name' | 'rarity' | 'legendaryId' | 'setId'>>;

export function getItemVisual(item: ItemVisualIdentity): EquipmentVisual {
  if (item.legendaryId && LEGENDARY_VISUALS[item.legendaryId])
    return LEGENDARY_VISUALS[item.legendaryId];
  if (item.setId && SET_VISUALS[`${item.setId}:${item.slot}`])
    return SET_VISUALS[`${item.setId}:${item.slot}`];
  const name = item.name?.replace(/^【太古】/, '') ?? '';
  const series =
    Object.values(ORDINARY_SERIES).find(([prefix]) => name.startsWith(prefix)) ??
    ORDINARY_SERIES[item.rarity ?? 'common'];
  return ORDINARY_VISUALS[`${series[0]}:${item.slot}`];
}

export function getItemAppearanceKey(item: ItemVisualIdentity): string {
  return getItemVisual(item).key;
}

export function getItemSvg(item: ItemVisualIdentity): string {
  return visualToSvg(getItemVisual(item));
}
