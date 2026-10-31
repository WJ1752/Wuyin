import type { Element, Item, Slot } from '../core/types';
import { RARITY_COLORS, SLOTS } from '../core/types';
import { SKILLS } from './skillTrees';
import { LEGENDARIES } from './legendaries';
import { SETS } from './sets';

export interface VisualLayer {
  path: string;
  transform?: string;
  accent?: boolean;
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

/** Browser/Pixi consumers use the same geometry as React without importing UI. */
export function visualToSvg(visual: AssetVisual): string {
  const paths = visual.layers
    .map(
      (layer) =>
        `<path d="${layer.path}"${layer.transform ? ` transform="${layer.transform}"` : ''}${layer.accent ? ' stroke="#f7ecce" stroke-width="3"' : ''}/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 48 48" fill="none" stroke="${visual.color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
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

// All paths share a 48-unit canvas. Each entry is authored for its named ability;
// branch skills retain their parent's motif but change its silhouette and motion.
const SKILL_ART: Record<string, [SkillShape, string]> = {
  hunting_arrow: [
    'arrow',
    'M8 39 36 11M27 10 39 9 38 21M10 29 18 29 18 37M26 20A12 12 0 1 0 28 31',
  ],
  explosive_arrow: [
    'burst',
    'M7 40 26 21M6 31 15 33 17 42M28 8 32 17 42 14 37 24 44 31 33 32 29 42 24 31 14 27 23 22ZM28 22 34 27 28 30Z',
  ],
  split_arrow: ['arrow', 'M24 42V9M17 16 24 7 31 16M24 30 8 14M8 23V13H18M24 30 40 14M30 13H40V23'],
  frost_pierce: [
    'arrow',
    'M7 41 40 8M30 8H40V18M17 13V35M8 18 26 30M8 30 26 18M13 11 17 15 21 11M13 37 17 33 21 37',
  ],
  rapid_fire: [
    'arrow',
    'M6 14H39L33 9M39 14 33 19M10 25H43L37 20M43 25 37 30M4 36H35L29 31M35 36 29 41',
  ],
  elemental_arrow: [
    'arrow',
    'M9 40 37 12M27 12H37V22M19 6 24 13 19 20 14 13ZM34 30 40 36 34 42 28 36ZM5 23 10 28 5 33',
  ],
  fan_barrage: [
    'arrow',
    'M24 42 7 12M5 21 6 9 16 15M24 42V5M19 12 24 4 29 12M24 42 41 12M32 15 42 9 43 21',
  ],
  laser_arrow: [
    'bolt',
    'M4 35 37 10M8 41 41 16M27 8 42 6 40 22M10 11 15 16M7 24 12 24M27 32 31 37M20 35V41',
  ],
  tumble: [
    'wave',
    'M7 23A17 17 0 1 1 24 41M5 13 7 23 17 21M20 15 30 19 26 27 16 29M26 27 34 35M16 29 13 36M28 11A3 3 0 1 0 28 17A3 3 0 1 0 28 11',
  ],
  arrow_rain: [
    'arrow',
    'M9 5 5 23 11 18M5 23 2 16M23 3 18 30 24 25M18 30 14 24M38 5 33 26 39 21M33 26 29 20M13 35 9 43M28 35 25 44M41 32 38 40',
  ],
  raven: [
    'spirit',
    'M24 28 9 31 4 16 18 22 24 11 32 10 37 15 43 17 35 20 30 31 21 40 22 31M10 19 13 27M15 22 18 28M30 14H31',
  ],
  vengeance: [
    'spirit',
    'M24 10 14 25 24 38 34 25ZM14 25 4 13 6 31 17 39M34 25 44 13 42 31 31 39M20 22 24 27 28 22M21 34 18 44M27 34 30 44',
  ],
  steady_aim: [
    'arrow',
    'M24 5V12M24 36V43M5 24H12M36 24H43M35 24A11 11 0 1 0 13 24A11 11 0 1 0 35 24M24 24 40 8M32 8H40V16',
  ],
  ballistics: [
    'arrow',
    'M5 39Q11 3 40 15M31 7 41 15 30 19M7 40H43M10 32H14M16 22H20M25 19H29M18 39A12 12 0 0 0 12 29',
  ],
  night_hunt: [
    'spirit',
    'M30 5A17 17 0 1 0 41 30A15 15 0 0 1 30 5M9 38 33 14M25 14H33V22M13 18 16 20 13 22M35 37 38 39 41 37',
  ],
  frenzy: [
    'blade',
    'M8 5 29 26 25 30 4 9ZM21 34 34 21M27 29 40 42M40 5 19 26 23 30 44 9ZM14 21 27 34M21 29 8 42',
  ],
  bash: [
    'burst',
    'M9 8 25 5 33 17 17 25ZM22 22 37 40 42 36 28 18M4 30 12 28M9 41 15 34M27 39 25 45M35 8 42 4',
  ],
  frenzy_flurry: [
    'blade',
    'M6 14Q23 1 39 12M7 13 8 5M40 12 43 21M42 34Q23 48 8 36M41 34 41 43M7 36 4 28M17 11 29 25 22 29 12 16ZM26 28 36 39M27 12Q40 25 33 27Q24 27 27 12',
  ],
  seismic_bash: [
    'burst',
    'M10 6H29V18H10ZM20 18V31M5 37 15 33 23 38 31 32 44 36M22 39 19 45M32 33 36 23M13 33 7 26',
  ],
  whirlwind: [
    'orbit',
    'M40 24A16 16 0 1 0 27 40M40 24 34 18M40 24 44 16M16 24A8 8 0 1 0 23 16M16 24 21 29M16 24 12 31M28 38 32 44 38 34ZM6 13 3 22 12 18Z',
  ],
  ancestor_hammer: [
    'burst',
    'M10 11 25 4 37 12 30 27 14 25ZM23 25 17 43 24 44 29 26M14 14 23 18 32 13M23 18 21 24M4 25 8 30M38 30 44 26',
  ],
  hurricane: [
    'orbit',
    'M5 15Q23 0 41 15Q24 31 11 24Q5 19 13 17M9 29Q22 41 38 28M15 39Q24 46 33 38M20 9 24 15 28 9M41 15 36 11 35 20',
  ],
  lava_whirl: [
    'orbit',
    'M39 26A15 15 0 1 0 25 40M39 26 43 18M39 26 32 22M24 12Q30 23 28 29Q40 26 28 38Q13 39 15 27Q23 28 24 12M6 36 9 30M34 6 38 11',
  ],
  iron_hook: [
    'blade',
    'M31 6 27 13 32 17 37 10ZM25 15 21 22 26 26 31 19ZM20 25 16 31M16 31Q3 20 7 36Q13 48 25 39L29 28 21 31',
  ],
  war_cry: [
    'wave',
    'M8 18 18 15 27 8V38L18 31 8 28ZM18 15V31M32 17Q39 24 32 31M38 11Q49 24 38 37M12 30 16 42H22L18 32',
  ],
  charge: [
    'wave',
    'M4 12H18M2 24H14M5 36H18M20 7 35 15 44 26 33 38 20 42 27 26ZM24 17 34 24 29 32',
  ],
  berserker: [
    'spirit',
    'M14 18 7 5 5 26 15 32M34 18 41 5 43 26 33 32M14 18 24 12 34 18 32 36 24 43 16 36ZM16 24 21 27M32 24 27 27M19 35 24 31 29 35',
  ],
  bloodthirst: [
    'spirit',
    'M24 5Q12 21 11 30A13 13 0 0 0 37 30Q35 21 24 5M17 26 21 36 24 29 27 36 32 26M18 20 15 26',
  ],
  ruthless: [
    'blade',
    'M9 5 35 29 26 37 4 12ZM22 40 40 22M31 33 42 44M8 33 14 32 12 39M19 43 17 38M38 13 41 5',
  ],
  thick_skin: [
    'ward',
    'M24 5 39 12 36 32 24 43 12 32 9 12ZM14 16H34M13 23H35M17 30H31M24 9V38M5 10 3 18M43 10 45 18',
  ],
  electrocute: ['bolt', 'M28 4 10 27 22 25 18 44 38 18 26 20ZM5 13 10 16M39 32 44 35'],
  magic_missile: [
    'arrow',
    'M7 39Q22 28 26 13L34 6 42 14 35 23Q20 28 7 39ZM26 13 35 23M10 25 17 21M22 38 28 33',
  ],
  chain_lightning: [
    'bolt',
    'M8 7 17 12 12 22 26 17 21 31 39 25 33 41M6 4 10 4 10 8 6 8ZM36 23 42 23 42 29 36 29ZM30 38 36 38 36 44 30 44',
  ],
  seeking_missile: [
    'arrow',
    'M5 36Q3 16 22 13Q38 12 38 29M32 24 38 32 44 24M15 35 21 28 27 35 21 42ZM16 9 19 5M27 7 28 2',
  ],
  meteor: [
    'burst',
    'M7 41Q1 25 18 24L35 5 31 23 44 10 36 31Q35 46 19 44ZM12 31 17 27 25 30 29 37 21 41 13 37ZM15 34 20 32 23 37',
  ],
  frozen_orb: [
    'orbit',
    'M37 24A13 13 0 1 0 11 24A13 13 0 1 0 37 24M24 4V44M4 24H44M10 10 38 38M10 38 38 10M20 5 24 10 28 5M5 20 10 24 5 28M43 20 38 24 43 28',
  ],
  meteor_shower: [
    'burst',
    'M9 27 23 6 17 29Q13 38 7 34Q2 30 9 27ZM26 33 42 12 35 37Q29 45 24 40Q20 36 26 33ZM28 6 32 2M4 17 10 9M39 40 45 31',
  ],
  frost_meteor: [
    'burst',
    'M9 32 21 20 34 23 39 35 27 43 14 41ZM21 20 25 33 39 35M25 33 14 41M25 33 27 43M20 15 28 5M30 18 39 6M38 23 45 15M10 15V25M5 20H15',
  ],
  teleport: [
    'wave',
    'M16 5C2 5 2 43 16 43M16 5C27 5 27 43 16 43M32 7C42 7 42 41 32 41M32 7C26 7 26 41 32 41M11 24H40M34 18 40 24 34 30',
  ],
  black_hole: [
    'orbit',
    'M31 24A7 7 0 1 0 17 24A7 7 0 1 0 31 24M5 24Q12 4 31 9M31 9 26 3M43 24Q36 44 17 39M17 39 22 45M24 5Q44 12 39 31M9 17Q4 36 24 43',
  ],
  frost_nova: [
    'burst',
    'M24 4V44M6 14 42 34M6 34 42 14M18 7 24 13 30 7M18 41 24 35 30 41M7 21 14 19 15 11M33 37 34 29 41 27M7 27 14 29 15 37M33 11 34 19 41 21M18 24 24 18 30 24 24 30Z',
  ],
  archon: [
    'spirit',
    'M24 5 31 14 27 22 35 41 24 35 13 41 21 22 17 14ZM16 16 6 12 12 30 18 27M32 16 42 12 36 30 30 27M20 11 24 15 28 11M24 22V31',
  ],
  elemental_exposure: [
    'ward',
    'M24 4 30 13 24 18 18 13ZM40 18 44 27 35 31 32 23ZM30 36 24 44 18 36 24 30ZM8 18 4 27 13 31 16 23ZM24 20V25M21 23H27',
  ],
  glass_cannon: [
    'bolt',
    'M7 29 13 12 32 8 40 26 27 35 10 36ZM13 12 21 25 32 8M21 25 27 35M21 25 40 26M10 36 8 43M27 35 31 43M32 17 44 9M35 21 46 18',
  ],
  prodigy: [
    'ward',
    'M5 11Q15 7 24 15Q33 7 43 11V37Q33 33 24 40Q15 33 5 37ZM24 15V40M10 17 19 20M10 24 19 27M34 15 29 24H36L31 31M18 4 24 8 30 4',
  ],
  bone_spike: [
    'blade',
    'M5 41 10 21 17 41ZM17 41 25 5 31 41ZM31 41 38 16 43 41ZM4 43H44M23 30 26 15',
  ],
  siphon: [
    'wave',
    'M32 5Q23 17 27 24Q32 30 38 24Q42 18 32 5M6 31Q16 17 26 25M9 39Q19 25 29 29M16 44Q21 35 34 32M6 25V31H12',
  ],
  bone_splinters: [
    'burst',
    'M21 34 24 8 29 34 25 42ZM7 18 16 26 12 31 4 25ZM37 16 44 22 34 30 31 25ZM8 38 15 35M34 38 41 42M19 5 16 12M33 5 32 11',
  ],
  blood_drain: [
    'wave',
    'M7 35Q24 47 41 35M10 29Q24 39 38 29M24 4Q14 18 17 24Q24 33 31 24Q34 18 24 4M24 37V45M5 11Q7 20 14 23M43 11Q41 20 34 23',
  ],
  death_scythe: [
    'blade',
    'M17 43 26 9M15 12Q32 0 43 19Q30 13 25 22M26 9 22 7M13 41 22 44M5 30 9 34M6 22 12 25',
  ],
  bone_spear: [
    'arrow',
    'M9 40 32 17M27 18 34 4 44 5 43 15 30 22ZM8 36 4 38 6 44 12 44 14 40M20 25 24 29M25 20 29 24M34 13 39 9',
  ],
  poison_scythe: [
    'blade',
    'M13 43 24 10M13 12Q29 0 43 17Q30 12 23 22M29 27Q20 39 29 42Q38 39 29 27M7 26 5 33M38 27 42 31',
  ],
  shatter_spear: [
    'arrow',
    'M5 43 23 25M18 26 23 18 29 23 22 29ZM28 16 33 6 41 4 43 12 34 19ZM30 31 39 28 36 38ZM12 13 16 6 20 17ZM35 22 44 21',
  ],
  command_skeletons: [
    'spirit',
    'M11 20Q9 4 24 4Q39 4 37 20L31 28V35H17V28ZM17 17 21 17 21 21 17 21ZM27 17 31 17 31 21 27 21ZM24 24 21 28H27ZM21 30V35M27 30V35M6 40H42M14 37 10 43M34 37 38 43',
  ],
  decrepify: [
    'ward',
    'M8 7 40 41M40 7 8 41M17 14Q24 8 31 14L29 25 24 29 19 25ZM24 29V41M17 35H31M6 19 11 24 6 29M42 19 37 24 42 29',
  ],
  blood_step: [
    'wave',
    'M10 4Q4 14 11 16Q18 13 10 4M34 8 39 15 32 28 24 24ZM22 28 29 33 24 43 16 39ZM4 31H15M8 38H12M14 20H23M40 32 43 37 38 41',
  ],
  army_of_dead: [
    'spirit',
    'M17 20Q15 9 24 9Q33 9 31 20L28 24V29H20V24ZM20 18H22M26 18H28M24 24V28M4 21Q1 11 9 11L14 16 12 25H6ZM35 16 39 11Q47 11 44 21L42 25H36ZM17 44V36Q24 29 31 36V44M4 40V32L10 29 15 33M33 33 38 29 44 32V40',
  ],
  final_service: [
    'ward',
    'M24 3 41 12 37 31 24 44 11 31 7 12ZM16 23Q14 11 24 11Q34 11 32 23L29 27V33H19V27ZM19 21H21M27 21H29M23 28V33M5 34 9 39M43 34 39 39',
  ],
  spreading_malediction: [
    'wave',
    'M24 18 30 24 24 30 18 24ZM24 18V4M18 10 24 14 30 10M30 24H44M38 18 34 24 38 30M24 30V44M18 38 24 34 30 38M18 24H4M10 18 14 24 10 30',
  ],
  overwhelming_essence: [
    'spirit',
    'M24 4Q9 14 10 30Q12 44 24 43Q36 44 38 30Q39 14 24 4M24 13Q16 20 17 31Q24 39 31 31Q32 20 24 13M20 25 22 27M28 25 26 27M24 31V35M4 15 7 9M44 15 41 9',
  ],
  storm_claw: [
    'blade',
    'M10 6 7 27 15 42 14 24ZM24 4 19 25 25 43 27 23ZM39 7 31 26 35 41 40 26ZM8 30 22 19 19 29 36 18',
  ],
  flying_blade: [
    'blade',
    'M8 40 21 23M18 22 37 5 43 5 42 12 25 29ZM15 21 27 33M10 13 23 10M5 22 15 18M26 42 30 33',
  ],
  thunder_claw: [
    'bolt',
    'M8 8 5 26 12 40 12 23M20 6 17 24 22 39M32 7 29 20M35 19 23 33 33 30 29 44 44 25 34 27ZM39 5 37 12',
  ],
  return_blade: [
    'orbit',
    'M10 29Q3 8 26 6Q41 6 42 23M36 18 42 25 46 17M14 38 31 18 39 14 35 24 20 42ZM8 34 21 44M7 26 5 21',
  ],
  fan_of_knives: [
    'blade',
    'M24 39 20 10 24 4 28 10ZM21 39 6 18 5 10 13 13 24 37M27 39 42 18 43 10 35 13 24 37M15 42H33M24 39V45',
  ],
  poison_vine: [
    'wave',
    'M24 43Q12 33 25 23Q36 14 26 5M22 35Q6 36 5 23Q19 22 22 35ZM27 24Q42 24 43 12Q30 12 27 24ZM25 13Q13 16 11 5Q22 3 25 13',
  ],
  blood_fan: [
    'blade',
    'M24 34 18 12 24 6 30 12ZM20 34 5 19 4 11 12 14 24 32M28 34 43 19 44 11 36 14 24 32M24 35Q16 44 24 46Q32 44 24 35M8 31 11 39M40 31 37 39',
  ],
  spore_vine: [
    'wave',
    'M24 44Q13 36 24 28M8 27Q7 7 24 7Q41 7 40 27ZM17 27 19 39M31 27 29 39M16 15A2 2 0 1 0 16 19A2 2 0 1 0 16 15M28 12A3 3 0 1 0 28 18A3 3 0 1 0 28 12M5 37 8 40M40 36 44 34',
  ],
  shadow_step: [
    'wave',
    'M31 4A17 17 0 0 0 37 36A20 20 0 0 1 15 8M22 15 29 19 24 29 17 25ZM15 29 23 33 19 42 11 38ZM3 24H11M5 32H9',
  ],
  hurricane_break: [
    'orbit',
    'M5 17Q18 3 36 12M36 12 30 5M43 31Q30 45 12 36M12 36 18 43M14 21 24 13 34 21 24 34ZM24 13V34M14 21H34M4 28 9 25M39 23 44 20',
  ],
  earthen_bulwark: [
    'ward',
    'M24 4 42 15 37 35 24 44 11 35 6 15ZM6 15 20 19 24 4M20 19 16 32 24 44M16 32 29 28 37 35M29 28 34 15 42 15M20 19 34 15',
  ],
  thunder_wolf: [
    'spirit',
    'M7 5 21 14 27 14 41 5 36 24 33 35 24 44 15 35 12 24ZM13 20 20 24M35 20 28 24M18 31 24 27 30 31 24 36ZM26 9 20 19 26 18 22 27M4 31 9 36M44 31 39 36',
  ],
  predator: [
    'spirit',
    'M4 24Q24 5 44 24Q24 43 4 24ZM24 14 19 24 24 34 29 24ZM7 10 12 15M41 10 36 15M7 38 12 33M41 38 36 33',
  ],
  toxic_blood: [
    'spirit',
    'M24 4Q8 22 10 32Q12 44 24 44Q36 44 38 32Q40 22 24 4M17 24Q24 18 31 24V32H17ZM20 27V28M28 27V28M21 32V36M27 32V36M6 14 10 18M42 14 38 18',
  ],
  stormborn: [
    'bolt',
    'M12 25Q1 24 6 15Q9 9 16 12Q20 2 30 8Q36 10 36 15Q46 13 44 24H32M26 16 16 31H25L20 44 38 25H28ZM6 32 3 38M41 33 38 41',
  ],
};

export const SKILL_VISUALS: Record<string, SkillVisual> = Object.fromEntries(
  SKILLS.map((skill) => {
    const [shape, path] = SKILL_ART[skill.id];
    return [
      skill.id,
      {
        key: `skill:${skill.id}`,
        effectKey: skill.id,
        shape,
        color: ELEMENT_PALETTE[skill.element],
        layers: [{ path }],
      },
    ];
  }),
);

const GEAR_SHAPES = {
  weapon: 'M10 40 21 29M16 25 25 34M21 25 35 6 42 5 41 12 27 31Z',
  offhand: 'M24 4 40 12 36 33 24 44 12 33 8 12ZM14 16 24 11 34 16 31 30 24 37 17 30Z',
  head: 'M10 37V22Q10 7 24 7Q38 7 38 22V37L28 32V25H20V32ZM10 22H38M24 7V18',
  chest: 'M15 5 8 12 4 24 12 28 14 42H34L36 28 44 24 40 12 33 5 28 11H20ZM14 16V30M34 16V30',
  hands:
    'M15 43 9 29 7 20Q8 16 12 19L16 26V8Q19 4 21 8V22 5Q24 2 26 6V22 8Q29 5 31 9V23 13Q34 11 36 15V30L31 43ZM15 36H32',
  legs: 'M12 5H36L37 24 33 43H25L24 24 23 43H15L11 24ZM12 11H36M15 34H23M25 34H34',
  feet: 'M13 5H33L30 27 41 33Q45 39 40 43H8V34L15 28ZM13 12H32M8 37H43',
  winged_boots:
    'M18 5H34L31 27 41 33Q45 39 40 43H11V34L19 28ZM18 12H33M11 37H43M18 27Q4 25 4 11L12 17 10 7 19 15M8 20 18 24',
  jewelry: 'M35 28A11 11 0 1 0 13 28A11 11 0 1 0 35 28M17 9 24 4 31 9 28 18H20ZM17 9H31M24 4V18',
  bow: 'M12 5Q45 23 12 43L24 24ZM5 24H42M36 18 43 24 36 30',
  crossbow: 'M7 7Q31 5 41 29M7 7 21 25 41 29M18 30 37 9M13 29 23 39 28 34 18 24ZM29 9H37V17',
  quiver:
    'M11 17 31 20 27 44 8 40ZM18 18 22 4M14 8 22 4 25 11M26 19 34 3M29 6 34 3 38 9M10 28 29 31',
  blade: 'M11 43 20 32M14 28 25 39M18 27 29 5 40 4 39 15 25 34ZM24 26 35 9',
  dual: 'M6 6 20 18 22 27 16 26 4 12ZM13 29 26 16M21 25 31 38M42 6 28 18 26 27 32 26 44 12ZM35 29 22 16M27 25 17 38',
  hammer: 'M8 8 31 4 38 21 15 28ZM22 26 17 44 25 44 30 24M12 12 32 9',
  staff: 'M20 44 26 20M18 9 28 3 37 12 28 23 17 18ZM18 9 28 14 37 12M28 14V23',
  scythe: 'M14 44 25 9M12 12Q29 0 43 18Q28 12 23 23M11 41 20 44',
  orb: 'M37 22A13 13 0 1 0 11 22A13 13 0 1 0 37 22M14 34 18 42H30L34 34M17 42H31',
  mirror: 'M36 20A12 16 0 1 0 12 20A12 16 0 1 0 36 20M20 35 18 44H30L28 35M30 10 18 27',
  pendant: 'M8 5Q9 26 24 28Q39 26 40 5M24 28 16 35 24 44 32 35ZM8 5 14 6M34 6 40 5',
  feather: 'M9 43 33 7M16 34Q4 22 20 12L39 4 37 24Q31 38 16 34ZM19 26 32 26M23 20 36 20',
  lantern:
    'M19 10V6Q24 0 29 6V10M15 11H33L37 34 30 42H18L11 34ZM15 16H33M11 34H37M18 17V34M30 17V34',
  totem:
    'M17 44 15 11 24 4 33 11 31 44ZM15 15H33M16 34H32M16 10 6 6 8 23 16 28M32 10 42 6 40 23 32 28',
  branch:
    'M23 44 25 7M24 21 10 12 6 5M10 12 6 19M24 30 38 20 43 8M38 20 44 27M25 12 35 5M23 37 12 31 7 35',
  claw: 'M9 34 12 12 18 5 17 30M20 32 23 8 29 3 28 32M31 32 36 10 42 6 39 35M8 34 39 35 37 44 10 44Z',
} satisfies Record<string, string>;
type GearShape = keyof typeof GEAR_SHAPES;

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

function gearVisual(key: string, shape: GearShape, motif: string, color: string): AssetVisual {
  return {
    key,
    color,
    layers: [
      { path: GEAR_SHAPES[shape] },
      { path: SKILL_ART[motif][1], transform: 'translate(15 15) scale(.4)', accent: true },
    ],
  };
}

export const LEGENDARY_VISUALS: Record<string, AssetVisual> = Object.fromEntries(
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

export const SET_VISUALS: Record<string, AssetVisual> = Object.fromEntries(
  SETS.flatMap((set) =>
    SLOTS.map((slot) => {
      const visual = gearVisual(`set:${set.id}:${slot}`, slot, SET_CRESTS[set.id], set.color);
      // The diamond mount identifies a matching set crest, distinct from a
      // legendary engraving even when both depict the same in-world symbol.
      return [
        `${set.id}:${slot}`,
        {
          ...visual,
          layers: [visual.layers[0], { path: 'M13 24 24 13 35 24 24 35Z' }, visual.layers[1]],
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

export const ORDINARY_VISUALS: Record<string, AssetVisual> = Object.fromEntries(
  Object.entries(ORDINARY_SERIES).flatMap(([rarity, [name, motif]]) =>
    SLOTS.map((slot) => [
      `${name}:${slot}`,
      gearVisual(`ordinary:${name}:${slot}`, slot, motif, RARITY_COLORS[rarity as Item['rarity']]),
    ]),
  ),
);

export type ItemVisualIdentity = Pick<Item, 'slot'> &
  Partial<Pick<Item, 'name' | 'rarity' | 'legendaryId' | 'setId'>>;

export function getItemVisual(item: ItemVisualIdentity): AssetVisual {
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
