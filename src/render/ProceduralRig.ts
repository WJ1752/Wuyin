import { Container, Graphics, Sprite } from 'pixi.js';
import type { ClassId, Item, SaveData, Slot } from '../core/types';
import { CHARACTER_ART, getCharacterTexture, getEquipmentTexture } from './CharacterTextures';
import { drawPixelCreature } from './MonsterRenderer';
import { pixelEllipse, pixelStamp } from './PixelArt';

const COLORS: Record<ClassId, number> = {
  ranger: 0x84c5a1,
  barbarian: 0xd0a269,
  sorcerer: 0xa99be9,
  necromancer: 0x94c9b3,
  druid: 0xb2cbe1,
};

/** Player art, summoned allies and every equipment mount share the upright pixel grid. */
export class CharacterRig extends Container {
  private aura = new Graphics();
  private body = new Container();
  private heading = 1;
  private attackTime = 0;
  constructor(
    public classId: ClassId,
    equipment: SaveData['equipment'] = {},
    options: { summon?: boolean } = {},
  ) {
    super();
    const shadow = new Graphics();
    pixelEllipse(shadow, 0, 11, 24, 8, 0x0c1c23, 3, 0.6);
    const accent = COLORS[classId];
    pixelEllipse(this.aura, 0, 12, 30, 10, accent, 3, 0.4, true);
    for (const x of [-33, 30]) pixelStamp(this.aura, ['.a.', 'aaa', '.a.'], { a: accent }, x, 9, 2);
    this.addChild(shadow, this.aura, this.body);
    const texture = options.summon ? undefined : getCharacterTexture(classId);
    if (texture) {
      const art = CHARACTER_ART[classId];
      const portrait = new Sprite(texture);
      portrait.anchor.set(art.anchorX, art.ground);
      portrait.width = portrait.height = 88;
      portrait.y = 12;
      this.body.addChild(portrait);
      this.addEquipmentLayers(equipment);
    } else {
      const ally = new Graphics();
      drawPixelCreature(
        ally,
        classId === 'sorcerer' ? 'skeleton_mage' : classId === 'druid' ? 'wolf' : 'skeleton',
        accent,
      );
      this.body.addChild(ally);
    }
  }
  attack() {
    this.attackTime = 0.25;
  }
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
    this.body.y = Math.round(Math.sin(time * (moving ? 12 : 3)) * (moving ? 2 : 0.8));
    this.body.x = this.heading * Math.round(Math.sin((this.attackTime / 0.25) * Math.PI) * 3);
    this.aura.alpha = empowered ? 1 : 0.6;
    this.scale.set(empowered ? 1.2 : 1);
  }
}
