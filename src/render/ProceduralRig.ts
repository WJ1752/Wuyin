import { Container, Graphics, Sprite } from 'pixi.js';
import type { ClassId, Item, SaveData, Slot } from '../core/types';
import { RARITY_COLORS } from '../core/types';
import { SETS } from '../data/sets';
import { CHARACTER_ART, getCharacterTexture, getEquipmentTexture } from './CharacterTextures';

const COLORS = {
  ranger: 0x84c5a1,
  barbarian: 0xd0a269,
  sorcerer: 0xa99be9,
  necromancer: 0x94c9b3,
  druid: 0xb2cbe1,
};
function gearStyle(item: Item | undefined, fallback: number) {
  const set = SETS.find((entry) => entry.id === item?.setId);
  const color = set?.color ?? (item ? RARITY_COLORS[item.rarity] : undefined);
  return {
    color: color ? Number.parseInt(color.slice(1), 16) : fallback,
    // The shared SVG asset supplies item identity; these are only mounting shapes.
    variant: item?.rarity === 'primal' ? 3 : set ? 2 : item?.legendaryId ? 1 : 0,
    equipped: Boolean(item),
    primal: item?.rarity === 'primal',
    set: Boolean(set),
  };
}
/** Set crests use one shared motif across matching armor, instead of random per-item marks. */
function crest(graphic: Graphics, x: number, y: number, color: number, variant: number, scale = 1) {
  const r = (3 + variant) * scale;
  if (variant === 0)
    graphic.poly([x, y - r, x + r, y, x, y + r, x - r, y]).stroke({ color, width: 1 });
  else if (variant === 1)
    graphic
      .moveTo(x - r, y - r)
      .lineTo(x + r, y + r)
      .moveTo(x + r, y - r)
      .lineTo(x - r, y + r)
      .moveTo(x, y - r - 2)
      .lineTo(x, y + r + 2)
      .stroke({ color, width: 1 });
  else if (variant === 2)
    graphic.poly([x - r, y + r, x, y - r, x + r, y + r, x, y + r / 2]).stroke({ color, width: 1 });
  else
    graphic
      .moveTo(x - r, y)
      .lineTo(x - r / 2, y + r)
      .lineTo(x + r / 2, y + r)
      .lineTo(x + r, y)
      .moveTo(x - r, y)
      .lineTo(x - r / 2, y - r)
      .lineTo(x + r / 2, y - r)
      .lineTo(x + r, y)
      .stroke({ color, width: 1 });
}
/** Each articulated piece is a retained scene node; animation does not rebuild geometry. */
export class CharacterRig extends Container {
  private cloak = new Graphics();
  private leftLeg = new Graphics();
  private rightLeg = new Graphics();
  private leftArm = new Container();
  private rightArm = new Container();
  private aura = new Graphics();
  private body = new Container();
  private portrait: Sprite | null = null;
  private heading = 1;
  private attackTime = 0;
  constructor(
    public classId: ClassId,
    equipment: SaveData['equipment'] = {},
    options: { summon?: boolean } = {},
  ) {
    super();
    const style = (slot: Slot) => gearStyle(equipment[slot], COLORS[classId]);
    const chestStyle = style('chest'),
      headStyle = style('head'),
      handStyle = style('hands');
    const legStyle = style('legs'),
      feetStyle = style('feet'),
      offhandStyle = style('offhand');
    const jewelryStyle = style('jewelry'),
      weaponStyle = style('weapon');
    const accent = chestStyle.color;
    const weaponId = equipment.weapon?.legendaryId ?? '';
    const offhandId = equipment.offhand?.legendaryId ?? '';
    this.addChild(new Graphics().ellipse(0, 11, 24, 8).fill({ color: 0x000000, alpha: 0.4 }));
    this.aura
      .ellipse(0, 12, 32, 12)
      .stroke({ color: accent, alpha: 0.24, width: 1 })
      .ellipse(0, 12, 25, 9)
      .stroke({ color: accent, alpha: 0.25, width: 1 });
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      this.aura
        .moveTo(Math.cos(a) * 28, 12 + Math.sin(a) * 10)
        .lineTo(Math.cos(a) * 34, 12 + Math.sin(a) * 14)
        .stroke({ color: accent, alpha: 0.65, width: 1 });
    }
    this.addChild(this.aura, this.body);
    if (jewelryStyle.equipped) {
      this.aura
        .ellipse(0, 12, 38 + jewelryStyle.variant * 2, 15 + jewelryStyle.variant)
        .stroke({ color: jewelryStyle.color, alpha: 0.5, width: 1 });
      for (let i = 0; i < 4 + jewelryStyle.variant; i++) {
        const a = (i * Math.PI * 2) / (4 + jewelryStyle.variant);
        crest(
          this.aura,
          Math.cos(a) * 41,
          12 + Math.sin(a) * 16,
          jewelryStyle.color,
          jewelryStyle.variant,
          0.4,
        );
      }
    }
    const texture = options.summon ? undefined : getCharacterTexture(classId);
    if (texture) {
      const art = CHARACTER_ART[classId];
      this.portrait = new Sprite(texture);
      this.portrait.anchor.set(art.anchorX, art.ground);
      this.portrait.width = 88;
      this.portrait.height = 88;
      this.portrait.y = 12;
      this.body.addChild(this.portrait);
      this.addEquipmentLayers(equipment);
      return;
    }
    this.cloak
      .poly([-13, -31, -22, 3, -12, 10, -4, 4, 5, 13, 18, 3, 12, -31])
      .fill(0x172931)
      .stroke({ color: accent, alpha: 0.5, width: 1 });
    this.cloak
      .moveTo(-10, -25)
      .lineTo(-13, 2)
      .moveTo(0, -25)
      .lineTo(2, 5)
      .moveTo(10, -25)
      .lineTo(14, 0)
      .stroke({ color: accent, alpha: 0.18, width: 2 });
    this.body.addChild(this.cloak);
    for (const [leg, x] of [
      [this.leftLeg, -7],
      [this.rightLeg, 7],
    ] as const) {
      leg.position.set(x, -4);
      leg
        .poly([-4, 0, 4, 0, 5, 13, 2, 17, -5, 16])
        .fill(legStyle.equipped ? 0x3c4653 : 0x26343d)
        .stroke({ color: legStyle.equipped ? legStyle.color : 0x76858b, width: 1 });
      if (legStyle.equipped) {
        const flare = legStyle.variant;
        leg
          .poly([-5 - flare, 1, 5 + flare, 1, 4, 9, 0, 12, -4, 9])
          .fill(0x4d5860)
          .stroke({ color: legStyle.color, width: 1 });
        crest(leg, 0, 5, legStyle.color, legStyle.variant, 0.45);
      }
      leg
        .poly([-5, 11, 5, 11, 8 + (feetStyle.equipped ? feetStyle.variant + 2 : 0), 18, -6, 18])
        .fill(feetStyle.equipped ? 0x4a4d56 : 0x30343c)
        .stroke({ color: feetStyle.color, alpha: feetStyle.equipped ? 0.9 : 0.45, width: 1 });
      if (feetStyle.equipped)
        leg
          .moveTo(-4, 13)
          .lineTo(5, 13)
          .moveTo(-4, 16)
          .lineTo(6, 16)
          .stroke({ color: feetStyle.color, width: 1 });
      this.body.addChild(leg);
    }
    const chest = new Graphics()
      .poly([-12, -31, 0, -36, 12, -31, 11, -12, 6, -3, -6, -3, -11, -12])
      .fill(0x35424a)
      .stroke({ color: accent, alpha: 0.8, width: 1.2 });
    chest
      .poly([-9, -29, 0, -32, 9, -29, 6, -19, 0, -15, -6, -19])
      .fill(0x54616a)
      .stroke({ color: 0xc6b98b, alpha: 0.6, width: 0.7 });
    chest.poly([0, -30, 4, -24, 0, -18, -4, -24]).fill(accent);
    for (let i = 0; i < 3; i++)
      chest
        .moveTo(-8, -14 + i * 4)
        .lineTo(8, -14 + i * 4)
        .stroke({ color: 0x0e1b22, width: 2 });
    chest.rect(-10, -6, 20, 4).fill(0x1a2026).rect(-3, -6, 6, 4).fill(0x9c8658);
    if (chestStyle.equipped) {
      const flare = chestStyle.variant * 2;
      chest
        .poly([-11, -30, -18 - flare, -32, -17, -18, -10, -13])
        .fill(0x3e4757)
        .stroke({ color: accent, width: 1 });
      chest
        .poly([11, -30, 18 + flare, -32, 17, -18, 10, -13])
        .fill(0x3e4757)
        .stroke({ color: accent, width: 1 });
      crest(chest, 0, -23, accent, chestStyle.variant, 0.9);
      if (chestStyle.primal)
        chest
          .moveTo(-10, -31)
          .lineTo(-5, -25)
          .lineTo(-9, -19)
          .moveTo(10, -31)
          .lineTo(5, -25)
          .lineTo(9, -19)
          .stroke({ color: 0xff4762, width: 1 });
    }
    if (jewelryStyle.equipped) {
      chest
        .moveTo(-7, -33)
        .lineTo(-5, -28)
        .lineTo(0, -25)
        .lineTo(5, -28)
        .lineTo(7, -33)
        .stroke({ color: jewelryStyle.color, width: 1.2 });
      crest(chest, 0, -26, jewelryStyle.color, jewelryStyle.variant, 0.45);
    }
    this.body.addChild(chest);
    for (const [arm, x] of [
      [this.leftArm, -15],
      [this.rightArm, 15],
    ] as const) {
      arm.position.set(x, -28);
      const g = new Graphics()
        .poly([-7, -4, 1, -10, 8, -4, 6, 5, -5, 5])
        .fill(0x46525c)
        .stroke({ color: accent, width: 1 });
      g.poly([-3, 5, 4, 5, 5, 17, -4, 17])
        .fill(0x344049)
        .stroke({ color: 0xa4a8a1, alpha: 0.65, width: 0.7 });
      g.roundRect(-4, 16, 9, 7, 2).fill(0xa79580);
      if (handStyle.equipped) {
        const spike = handStyle.variant + 2;
        g.poly([-5, 12, -6 - spike, 9, -5, 21, 0, 25, 6, 20, 6 + spike, 9, 4, 12])
          .fill(0x525963)
          .stroke({ color: handStyle.color, width: 1 });
        crest(g, 0, 17, handStyle.color, handStyle.variant, 0.45);
      }
      arm.addChild(g);
      this.body.addChild(arm);
    }
    const head = new Graphics();
    if (classId === 'ranger') {
      head
        .poly([-12, -38, -8, -51, 0, -57, 9, -50, 13, -38, 0, -32])
        .fill(0x243a3b)
        .stroke({ color: accent, width: 1 });
      head.poly([-7, -44, 7, -44, 4, -34, -4, -34]).fill(0x101a21);
    } else if (classId === 'barbarian') {
      head.roundRect(-10, -49, 20, 17, 5).fill(0x82705a);
      head.poly([-11, -45, -21, -54, -18, -60, -14, -50, -8, -46]).fill(0xd1c6a5);
      head.poly([11, -45, 21, -54, 18, -60, 14, -50, 8, -46]).fill(0xd1c6a5);
      head.rect(-10, -49, 20, 7).fill(0x5d6471).rect(-2, -49, 4, 16).fill(0x6a7480);
    } else if (classId === 'sorcerer') {
      head
        .ellipse(0, -42, 9, 11)
        .fill(0xafa697)
        .poly([-11, -47, -12, -58, -5, -51, 0, -64, 5, -51, 12, -58, 11, -47])
        .fill(0x8f86b4)
        .stroke({ color: accent, width: 1 });
      head.poly([0, -59, 3, -54, 0, -49, -3, -54]).fill(0xdfd4ff);
    } else if (classId === 'necromancer') {
      head
        .poly([-10, -48, -8, -55, 0, -51, 8, -55, 11, -48, 8, -34, -7, -34])
        .fill(0xc4c8b8)
        .stroke({ color: 0x647b73, width: 1 });
      head.ellipse(-5, -43, 3, 4).fill(0x192b2b).ellipse(5, -43, 3, 4).fill(0x192b2b);
      for (let i = -4; i <= 4; i += 4)
        head.moveTo(i, -37).lineTo(i, -33).stroke({ color: 0x344b47, width: 2 });
    } else {
      head
        .poly([-12, -39, -14, -58, -5, -51, 4, -51, 13, -59, 12, -39, 0, -31])
        .fill(0x687d89)
        .stroke({ color: accent, width: 1 });
      head.poly([-8, -42, 0, -46, 8, -42, 0, -33]).fill(0xb4c0c0);
      head.poly([-3, -39, 3, -39, 0, -35]).fill(0x1a262e);
    }
    head
      .moveTo(-7, -43)
      .lineTo(-3, -42)
      .moveTo(3, -42)
      .lineTo(7, -43)
      .stroke({ color: 0xccf8df, width: 2 });
    if (headStyle.equipped) {
      const peak = 4 + headStyle.variant * 3;
      head
        .poly([-12, -47, -13, -52, -7, -50, 0, -54 - peak, 7, -50, 13, -52, 12, -47])
        .fill(0x5c6570)
        .stroke({ color: headStyle.color, width: 1 });
      head
        .moveTo(-10, -45)
        .lineTo(-10, -36)
        .moveTo(10, -45)
        .lineTo(10, -36)
        .stroke({ color: headStyle.color, width: 2 });
      crest(head, 0, -49, headStyle.color, headStyle.variant, 0.5);
    }
    this.body.addChild(head);
    const weapon = new Graphics();
    const weaponColor = equipment.weapon ? weaponStyle.color : 0xd8c28d;
    if (classId === 'ranger') {
      if (weaponId === 'dawn') {
        weapon
          .poly([-10, -5, 18, -5, 27, 1, 18, 6, -6, 6, -12, 15, -16, 12])
          .fill(0x4d555e)
          .stroke({ color: weaponColor, width: 1.5 });
        weapon
          .moveTo(10, -21)
          .bezierCurveTo(28, -16, 28, 17, 10, 24)
          .stroke({ color: weaponColor, width: 3 });
        weapon.moveTo(10, -21).lineTo(6, 1).lineTo(10, 24).stroke({ color: 0xe6e4cd, width: 1 });
        weapon.moveTo(0, 1).lineTo(34, 1).stroke({ color: 0xbdcbd0, width: 2 });
      } else {
        const reach =
          weaponId === 'yang' ? 15 : weaponId === 'windforce' ? 8 : weaponStyle.variant * 2;
        weapon
          .moveTo(5, -20 - reach)
          .bezierCurveTo(33 + reach * 0.4, -13, 33 + reach * 0.4, 17, 5, 28 + reach)
          .stroke({ color: weaponColor, width: 3 });
        weapon
          .moveTo(5, -20 - reach)
          .lineTo(8, 3)
          .lineTo(5, 28 + reach)
          .stroke({ color: 0xe9ead8, width: 1 });
        weapon.moveTo(-6, 3).lineTo(35, 3).stroke({ color: 0x8f9b9b, width: 2 });
        weapon.poly([31, 0, 40, 3, 31, 6]).fill(0xc9dfdf);
        if (weaponId === 'froststring')
          for (const y of [-22, -10, 15, 27])
            weapon.poly([19, y, 30, y - 6, 25, y + 4]).fill(0xa4ddeb);
        if (weaponId === 'windforce')
          weapon
            .moveTo(9, -27)
            .bezierCurveTo(42, -16, 42, 22, 9, 35)
            .stroke({ color: 0xd3dfc7, width: 1 });
      }
    } else if (classId === 'barbarian') {
      weapon.moveTo(0, 24).lineTo(8, -24).stroke({ color: 0x7e6243, width: 5 });
      if (weaponId === 'judgment') {
        weapon
          .poly([-13, -33, 27, -33, 33, -26, 30, -13, -15, -13, -20, -20])
          .fill(0x65717a)
          .stroke({ color: weaponColor, width: 2 });
        weapon.rect(-11, -29, 7, 12).fill(0xb2b7b4).rect(22, -29, 6, 12).fill(0xb2b7b4);
        crest(weapon, 7, -23, weaponColor, 2, 1.2);
      } else if (['bulkathos', 'lamentation', 'oathkeeper'].includes(weaponId)) {
        weapon
          .poly([3, 6, 1, -29, 9, -45, 15, -29, 10, 7])
          .fill(0xb5c1be)
          .stroke({ color: weaponColor, width: 1.5 });
        weapon.moveTo(8, -34).lineTo(7, 5).stroke({ color: 0xeff0d8, width: 1 });
        weapon.poly([-4, 7, 7, 2, 18, 7, 17, 11, 7, 8, -3, 11]).fill(weaponColor);
      } else {
        weapon
          .poly([5, -27, 24, -32, 30, -13, 10, -9, 4, -14, -8, -10, -12, -25])
          .fill(0xabb3b6)
          .stroke({ color: weaponColor, width: 2 });
        weapon.moveTo(10, -24).lineTo(23, -22).stroke({ color: 0xf2e3ad, width: 1 });
      }
    } else if (classId === 'sorcerer') {
      weapon.moveTo(1, 29).lineTo(7, -31).stroke({ color: 0x9e8c65, width: 3 });
      weapon.poly([7, -45, 17, -34, 8, -23, -2, -34]).stroke({ color: weaponColor, width: 2 });
      weapon.poly([7, -42, 12, -34, 7, -27, 3, -34]).fill(0xb9a4ff);
      if (weaponStyle.equipped) {
        const halo = 9 + weaponStyle.variant * 2;
        weapon.ellipse(7, -34, halo, halo + 5).stroke({ color: weaponColor, width: 1, alpha: 0.6 });
        crest(weapon, 7, -34, weaponColor, weaponStyle.variant, 0.7);
        if (weaponId === 'serpent_spark')
          weapon
            .moveTo(5, 22)
            .bezierCurveTo(20, 5, -8, -8, 10, -26)
            .stroke({ color: 0xbad7e4, width: 2 });
      }
    } else if (classId === 'necromancer') {
      weapon.moveTo(2, 28).lineTo(5, -35).stroke({ color: 0x9bada2, width: 3 });
      weapon
        .moveTo(5, -35)
        .bezierCurveTo(26, -48, 40, -35, 43, -14)
        .bezierCurveTo(29, -32, 18, -28, 5, -28)
        .fill(0xcdd5ba)
        .stroke({ color: weaponColor, width: 1 });
      if (weaponStyle.equipped) {
        for (let i = 0; i < 2 + weaponStyle.variant; i++)
          weapon
            .poly([13 + i * 5, -30, 16 + i * 5, -22 + (i % 2) * 5, 18 + i * 5, -31])
            .fill(weaponColor);
        crest(weapon, 6, -32, weaponColor, weaponStyle.variant, 0.65);
      }
    } else {
      if (weaponId === 'moonfang') {
        for (let i = 0; i < 3; i++)
          weapon
            .poly([
              -7 + i * 7,
              8,
              -8 + i * 7,
              -17,
              -4 + i * 7,
              -28,
              -1 + i * 7,
              -12,
              -2 + i * 7,
              10,
            ])
            .fill(0xc4d7df)
            .stroke({ color: weaponColor, width: 1 });
        weapon.roundRect(-10, 7, 25, 9, 2).fill(0x4e606b).stroke({ color: weaponColor, width: 1 });
      } else {
        weapon
          .poly([0, 21, -3, 9, 3, -24, 10 + (weaponId === 'greenstone' ? 7 : 0), -35, 9, 4, 5, 20])
          .fill(0xc5dbe0)
          .stroke({ color: weaponColor, width: 1 });
        weapon.rect(-5, 12, 17, 3).fill(0x7f7251);
        if (weaponId === 'greenstone') weapon.poly([3, -14, 9, -22, 11, -10, 7, 3]).fill(0x80a77b);
        if (weaponId === 'shadowfang')
          weapon.moveTo(4, -23).lineTo(5, 9).stroke({ color: 0xb593e3, width: 2 });
      }
    }
    if (weaponStyle.equipped) crest(weapon, 3, 17, weaponColor, weaponStyle.variant, 0.5);
    this.rightArm.addChild(weapon);
    const offhand = new Graphics();
    if (classId === 'barbarian' && weaponId === 'bulkathos' && !equipment.offhand) {
      offhand
        .poly([-5, 22, -8, -15, -1, -38, 7, -17, 2, 22])
        .fill(0xb7c3c6)
        .stroke({ color: weaponColor, width: 1.5 });
      offhand.rect(-13, 15, 22, 3).fill(weaponColor);
    } else if (classId === 'barbarian' && offhandId === 'gavel') {
      offhand.moveTo(-4, 25).lineTo(-3, -15).stroke({ color: 0x977e58, width: 4 });
      offhand
        .poly([-17, -19, 9, -19, 12, -8, 7, -3, -18, -4])
        .fill(0x697784)
        .stroke({ color: offhandStyle.color, width: 2 });
    } else if (classId === 'ranger')
      offhand
        .poly([-8, -2, 1, -2, 1, 25, -8, 25])
        .fill(0x6e563e)
        .stroke({ color: offhandStyle.equipped ? offhandStyle.color : 0xbca87b, width: 1 })
        .moveTo(-6, -10)
        .lineTo(-5, 16)
        .moveTo(-1, -12)
        .lineTo(-2, 13)
        .stroke({ color: 0xa9bcc1, width: 1 });
    else if (classId === 'barbarian')
      offhand
        .poly([-14, -4, 5, -4, 7, 13, -4, 25, -16, 13])
        .fill(0x45505b)
        .stroke({ color: offhandStyle.equipped ? offhandStyle.color : weaponColor, width: 2 })
        .poly([-4, 0, 1, 8, -4, 16, -9, 8])
        .fill(0xa49a79);
    else
      offhand
        .poly([-8, -1, 1, -7, 10, 0, 8, 12, 0, 18, -9, 10])
        .fill({ color: offhandStyle.color, alpha: 0.6 })
        .stroke({ color: 0xd0e6d5, width: 1 })
        .poly([0, -3, 5, 4, 0, 11, -4, 4])
        .fill(0xd8efcf);
    if (offhandStyle.equipped) {
      const rim = offhandStyle.variant + 1;
      if (classId === 'ranger')
        for (let i = 0; i < rim + 2; i++)
          offhand
            .moveTo(-9 + i * 3, -12 - rim)
            .lineTo(-8 + i * 3, 4)
            .stroke({ color: offhandStyle.color, width: 1 });
      else
        offhand
          .ellipse(-2, 5, 13 + rim, 18 + rim)
          .stroke({ color: offhandStyle.color, alpha: 0.6, width: 1 });
      crest(offhand, -3, 8, offhandStyle.color, offhandStyle.variant, 0.8);
      if (offhandStyle.primal)
        offhand
          .moveTo(-14, -5)
          .lineTo(-18, 3)
          .lineTo(-12, 11)
          .stroke({ color: 0xff4762, width: 1 });
    }
    this.leftArm.addChild(offhand);
  }
  attack() {
    this.attackTime = 0.25;
  }
  /** Equip-specific inlaid emblems and weapon outlines sit above the painted base. */
  private addEquipmentLayers(equipment: SaveData['equipment']) {
    const art = CHARACTER_ART[this.classId];
    const mounts: Record<ClassId, Record<Slot, [number, number, number]>> = {
      ranger: {
        head: [0.51, 0.2, 7],
        chest: [0.54, 0.64, 10],
        hands: [0.78, 0.63, 7],
        legs: [0.54, 0.81, 9],
        feet: [0.52, 0.91, 8],
        jewelry: [0.55, 0.56, 6],
        weapon: [0.83, 0.53, 26],
        offhand: [0.25, 0.45, 12],
      },
      barbarian: {
        head: [0.46, 0.27, 8],
        chest: [0.49, 0.6, 12],
        hands: [0.74, 0.56, 8],
        legs: [0.48, 0.8, 10],
        feet: [0.47, 0.9, 9],
        jewelry: [0.51, 0.66, 7],
        weapon: [0.78, 0.27, 28],
        offhand: [0.23, 0.68, 14],
      },
      sorcerer: {
        head: [0.49, 0.29, 8],
        chest: [0.55, 0.65, 10],
        hands: [0.79, 0.64, 7],
        legs: [0.55, 0.82, 9],
        feet: [0.55, 0.91, 8],
        jewelry: [0.54, 0.69, 6],
        weapon: [0.24, 0.49, 26],
        offhand: [0.84, 0.55, 13],
      },
      necromancer: {
        head: [0.47, 0.28, 7],
        chest: [0.45, 0.6, 10],
        hands: [0.63, 0.6, 7],
        legs: [0.43, 0.79, 9],
        feet: [0.43, 0.89, 8],
        jewelry: [0.45, 0.55, 6],
        weapon: [0.76, 0.27, 27],
        offhand: [0.41, 0.73, 12],
      },
      druid: {
        head: [0.57, 0.22, 8],
        chest: [0.55, 0.64, 10],
        hands: [0.75, 0.73, 7],
        legs: [0.55, 0.81, 9],
        feet: [0.53, 0.91, 8],
        jewelry: [0.57, 0.59, 6],
        weapon: [0.83, 0.77, 21],
        offhand: [0.24, 0.75, 18],
      },
    };
    for (const [slot, item] of Object.entries(equipment) as [Slot, Item][]) {
      if (!item) continue;
      const texture = getEquipmentTexture(item);
      if (!texture) continue;
      const [x, y, size] = mounts[this.classId][slot];
      const attachment = new Sprite(texture);
      attachment.label = `equipment:${slot}`;
      attachment.anchor.set(0.5);
      attachment.width = size;
      attachment.height = size;
      attachment.position.set((x - art.anchorX) * 88, (y - art.ground) * 88 + 12);
      // Every equipped slot has its own retained layer, including jewelry and boots.
      this.body.addChild(attachment);
    }
  }
  update(time: number, dt: number, moving: boolean, facing: number, empowered: boolean) {
    this.attackTime = Math.max(0, this.attackTime - dt);
    if (Math.abs(facing) > 0.05) this.heading = Math.sign(facing);
    this.body.scale.x = this.heading;
    const step = moving ? Math.sin(time * 12) * 0.32 : 0;
    this.leftLeg.rotation = step;
    this.rightLeg.rotation = -step;
    this.cloak.skew.x = Math.sin(time * 4) * 0.08 + (moving ? 0.1 : 0);
    const bob = Math.sin(time * (moving ? 12 : 3)) * (moving ? 1.5 : 0.8);
    this.body.y = this.portrait ? Math.round(bob) : bob;
    // Keep the pixel grid upright; attacks lunge by whole pixels instead of rotating the art.
    this.body.x = this.portrait
      ? this.heading * Math.round(Math.sin((this.attackTime / 0.25) * Math.PI) * 3)
      : 0;
    this.rightArm.rotation = -0.15 + Math.sin((this.attackTime / 0.25) * Math.PI) * -1.2;
    this.leftArm.rotation = -0.1 - step * 0.35;
    this.aura.alpha = empowered ? 1 : 0.6;
    this.scale.set(empowered ? 1.2 : 1);
  }
}
