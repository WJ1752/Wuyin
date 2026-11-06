import type { ClassId } from '../core/types';

// Stable row-major coordinates of the five hand-directed image-model sheets.
const sheets = {
  ranger: [
    'hunting_arrow',
    'explosive_arrow',
    'split_arrow',
    'frost_pierce',
    'rapid_fire',
    'elemental_arrow',
    'fan_barrage',
    'laser_arrow',
    'tumble',
    'arrow_rain',
    'raven',
    'vengeance',
    'steady_aim',
    'ballistics',
    'night_hunt',
  ],
  barbarian: [
    'frenzy',
    'bash',
    'frenzy_flurry',
    'seismic_bash',
    'whirlwind',
    'ancestor_hammer',
    'hurricane',
    'lava_whirl',
    'iron_hook',
    'war_cry',
    'charge',
    'berserker',
    'bloodthirst',
    'ruthless',
    'thick_skin',
  ],
  sorcerer: [
    'electrocute',
    'magic_missile',
    'chain_lightning',
    'seeking_missile',
    'meteor',
    'frozen_orb',
    'meteor_shower',
    'frost_meteor',
    'teleport',
    'black_hole',
    'frost_nova',
    'archon',
    'elemental_exposure',
    'glass_cannon',
    'prodigy',
  ],
  necromancer: [
    'bone_spike',
    'siphon',
    'bone_splinters',
    'blood_drain',
    'death_scythe',
    'bone_spear',
    'poison_scythe',
    'shatter_spear',
    'command_skeletons',
    'decrepify',
    'blood_step',
    'army_of_dead',
    'final_service',
    'spreading_malediction',
    'overwhelming_essence',
  ],
  druid: [
    'storm_claw',
    'flying_blade',
    'thunder_claw',
    'return_blade',
    'fan_of_knives',
    'poison_vine',
    'blood_fan',
    'spore_vine',
    'shadow_step',
    'hurricane_break',
    'earthen_bulwark',
    'thunder_wolf',
    'predator',
    'toxic_blood',
    'stormborn',
  ],
} satisfies Record<ClassId, string[]>;

export const SKILL_ART = Object.fromEntries(
  Object.entries(sheets).flatMap(([classId, ids]) =>
    ids.map(
      (id, index) =>
        [
          id,
          {
            src: `./assets/ui/skills-${classId}.webp`,
            column: index % 4,
            row: Math.floor(index / 4),
          },
        ] as const,
    ),
  ),
);

const casts = {
  ranger: [
    'hunting_arrow',
    'explosive_arrow',
    'rapid_fire',
    'elemental_arrow',
    'tumble',
    'arrow_rain',
    'raven',
    'vengeance',
  ],
  barbarian: [
    'frenzy',
    'bash',
    'whirlwind',
    'ancestor_hammer',
    'iron_hook',
    'war_cry',
    'charge',
    'berserker',
  ],
  sorcerer: [
    'electrocute',
    'magic_missile',
    'meteor',
    'frozen_orb',
    'teleport',
    'black_hole',
    'frost_nova',
    'archon',
  ],
  necromancer: [
    'bone_spike',
    'siphon',
    'death_scythe',
    'bone_spear',
    'command_skeletons',
    'decrepify',
    'blood_step',
    'army_of_dead',
  ],
  druid: [
    'storm_claw',
    'flying_blade',
    'fan_of_knives',
    'poison_vine',
    'shadow_step',
    'hurricane_break',
    'earthen_bulwark',
    'thunder_wolf',
  ],
} satisfies Record<ClassId, string[]>;

export const CAST_ART = Object.fromEntries(
  Object.entries(casts).flatMap(([classId, ids]) =>
    ids.map(
      (id, index) =>
        [
          id,
          {
            src: `./assets/skills/hd/cast-${classId}.webp`,
            column: index % 4,
            row: Math.floor(index / 4),
          },
        ] as const,
    ),
  ),
);

export const EFFECT_CELLS = [
  'burst',
  'ring',
  'slash',
  'lightning',
  'meteor',
  'arrow',
  'missile',
  'bone',
  'orb',
  'blade',
  'vortex',
  'heal',
] as const;
export const GROUND_CELLS = [
  'scorch',
  'frostfield',
  'caltrops',
  'dangerCircle',
  'dangerLine',
  'dangerCone',
  'beacon',
  'globe',
] as const;
export type EffectArt = (typeof EFFECT_CELLS)[number] | (typeof GROUND_CELLS)[number];
