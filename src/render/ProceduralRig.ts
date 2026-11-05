import { Container, Graphics, Sprite } from 'pixi.js';
import type { ClassId, SkillDef } from '../core/types';
import { CHARACTER_ART, getCharacterTexture } from './CharacterTextures';
import { getAtlasTexture } from './TextureAtlas';
import { drawPixelCreature } from './MonsterRenderer';
import { pixelEllipse, pixelStamp } from './PixelArt';

const COLORS: Record<ClassId, number> = {
  ranger: 0x84c5a1,
  barbarian: 0xd0a269,
  sorcerer: 0xa99be9,
  necromancer: 0x94c9b3,
  druid: 0xb2cbe1,
};
const MOTION = {
  strike: { reach: 7, lean: 0.14, lift: 1.5 },
  shoot: { reach: -4, lean: -0.09, lift: 1.5 },
  invoke: { reach: 1.5, lean: -0.055, lift: 5 },
  dash: { reach: 10, lean: 0.19, lift: 1.5 },
};

/** Player art and summoned allies share the upright pixel grid. */
export class CharacterRig extends Container {
  private aura = new Graphics();
  private body = new Container();
  private heading = 1;
  private attackTime = 0;
  private actionDuration = 0.28;
  private pose: 'strike' | 'shoot' | 'invoke' | 'dash' = 'strike';
  private actionHeading = 1;
  private readonly motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? 0.25
    : 1;
  constructor(
    public classId: ClassId,
    options: { summon?: boolean } = {},
  ) {
    super();
    const shadow = new Graphics();
    pixelEllipse(shadow, 0, 11, 24, 8, 0x0c1c23, 3, 0.6);
    const accent = COLORS[classId];
    pixelEllipse(this.aura, 0, 12, 30, 10, accent, 3, 0.4, true);
    for (const x of [-33, 30]) pixelStamp(this.aura, ['.a.', 'aaa', '.a.'], { a: accent }, x, 9, 2);
    this.addChild(shadow, this.aura, this.body);
    this.body.pivot.set(0, 12);
    this.body.y = 12;
    const texture = options.summon
      ? getAtlasTexture(classId === 'sorcerer' ? 'monster:ice_shaman' : 'monster:skeleton')
      : getCharacterTexture(classId);
    if (texture) {
      const art = CHARACTER_ART[classId];
      const portrait = new Sprite(texture);
      portrait.anchor.set(
        options.summon ? 0.5 : art.anchorX,
        options.summon ? 251 / 256 : art.ground,
      );
      portrait.width = portrait.height = 88;
      portrait.y = 12;
      this.body.addChild(portrait);
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
  attack(skill?: SkillDef, angle?: number, interval = 0.38) {
    this.pose =
      skill?.kind === 'movement'
        ? 'dash'
        : skill &&
            (skill.kind === 'ultimate' ||
              skill.kind === 'defense' ||
              this.classId === 'sorcerer' ||
              (this.classId === 'necromancer' && skill.effect !== 'scythe'))
          ? 'invoke'
          : this.classId === 'ranger'
            ? 'shoot'
            : 'strike';
    const dx = angle === undefined ? this.heading : Math.cos(angle);
    this.actionHeading = Math.abs(dx) < 0.1 ? this.heading : Math.sign(dx);
    this.actionDuration = Math.max(0.09, Math.min(interval, this.pose === 'invoke' ? 0.42 : 0.3));
    this.attackTime = this.actionDuration;
  }
  update(time: number, dt: number, moving: boolean, facing: number, empowered: boolean) {
    this.attackTime = Math.max(0, this.attackTime - dt);
    if (moving && Math.abs(facing) > 0.05) this.heading = Math.sign(facing);
    if (this.attackTime > 0) this.heading = this.actionHeading;
    const breath = Math.sin(time * 2.5) * this.motion;
    const stride = moving ? Math.sin(time * 13) * this.motion : 0;
    const phase = 1 - this.attackTime / this.actionDuration;
    // A short anticipation, then an extension and return to the grounded pose.
    const stroke =
      this.attackTime <= 0
        ? 0
        : this.motion *
          (phase < 0.28
            ? -0.47 * Math.sin((Math.PI * phase) / 0.28)
            : Math.sin((Math.PI * (phase - 0.28)) / 0.72));
    const { reach, lean, lift } = MOTION[this.pose];
    this.body.position.set(
      this.heading * (stroke * reach + breath * 0.7),
      12 - Math.abs(stride) * 2 - stroke * lift,
    );
    this.body.rotation = this.heading * (breath * 0.016 + stride * 0.035 + stroke * lean);
    this.body.scale.set(
      this.heading * (1 - breath * 0.012 + stroke * 0.035),
      1 + breath * 0.025 - stroke * 0.018,
    );
    this.aura.alpha = empowered ? 1 : 0.6;
    this.scale.set(empowered ? 1.2 : 1);
  }
}
