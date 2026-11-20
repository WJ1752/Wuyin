import { Container, Graphics, Sprite } from 'pixi.js';
import type { ClassId, SkillDef } from '../core/types';
import { CHARACTER_ART, getCharacterTexture, type CharacterPose } from './CharacterTextures';
import { getAtlasTexture } from './TextureAtlas';
import { drawPixelCreature } from './MonsterRenderer';

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

/** Keep the body, contact shadow and combat halo on the same ground origin. */
export class CharacterRig extends Container {
  private aura = new Graphics();
  private body = new Container();
  private portrait?: Sprite;
  private heading = 1;
  private attackTime = 0;
  private hitTime = 0;
  private down = false;
  private actionDuration = 0.28;
  private pose: 'strike' | 'shoot' | 'invoke' | 'dash' = 'strike';
  private actionHeading = 1;
  private readonly motion = !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  constructor(
    public classId: ClassId,
    options: { summon?: boolean } = {},
  ) {
    super();
    const shadow = new Graphics().ellipse(0, 11, 22, 7).fill({ color: 0x11191d, alpha: 0.55 });
    const accent = COLORS[classId];
    this.aura.ellipse(0, 12, 27, 9).stroke({ color: accent, width: 1.5, alpha: 0.55 });
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
      if (!options.summon) this.portrait = portrait;
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
  private displayPose(pose: CharacterPose) {
    if (!this.portrait) return;
    const frame = getCharacterTexture(this.classId, pose);
    if (frame && this.portrait.texture !== frame) this.portrait.texture = frame;
  }
  hit() {
    if (!this.down) this.hitTime = 0.18;
  }
  setDown(down: boolean) {
    if (down === this.down) return;
    this.down = down;
    this.attackTime = this.hitTime = 0;
    this.displayPose('idle');
    this.body.position.set(0, down ? 15 : 12);
    this.body.rotation = down ? -this.heading * 0.7 : 0;
    this.body.scale.set(this.heading, down ? 0.45 : 1);
    this.aura.alpha = down ? 0 : 0.6;
    if (this.portrait) this.portrait.tint = 0xffffff;
  }
  attack(skill?: SkillDef, angle?: number, interval = 0.38) {
    if (this.down) return;
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
    if (this.down) return;
    this.attackTime = Math.max(0, this.attackTime - dt);
    this.hitTime = Math.max(0, this.hitTime - dt);
    if (moving && Math.abs(facing) > 0.05) this.heading = Math.sign(facing);
    if (this.attackTime > 0) this.heading = this.actionHeading;
    const breath = this.motion ? Math.sin(time * 2.5) : 0;
    const step = Math.sin(time * 15);
    const stride = moving && this.motion ? step : 0;
    const phase = 1 - this.attackTime / this.actionDuration;
    const releasing = this.attackTime > 0 && phase >= 0.14;
    const striding = moving && (!this.motion || step >= -0.22);
    this.displayPose(
      releasing && this.pose !== 'dash' ? 'action' : striding || releasing ? 'walk' : 'idle',
    );
    const rebound = this.motion ? this.hitTime / 0.18 : 0;
    const stroke =
      this.attackTime <= 0 || !this.motion
        ? 0
        : phase < 0.28
          ? -0.47 * Math.sin((Math.PI * phase) / 0.28)
          : Math.sin((Math.PI * (phase - 0.28)) / 0.72);
    const { reach, lean, lift } = MOTION[this.pose];
    this.body.position.set(
      this.heading * (stroke * reach + breath * 0.7 - rebound * 4),
      12 - Math.abs(stride) * 1.5 - stroke * lift,
    );
    this.body.rotation =
      this.heading * (breath * 0.016 + stride * 0.04 + stroke * lean - rebound * 0.12);
    this.body.scale.set(
      this.heading * (1 - breath * 0.012 + stroke * 0.035),
      1 + breath * 0.025 - stroke * 0.018,
    );
    if (this.portrait) this.portrait.tint = this.hitTime > 0 ? 0xf1b7a9 : 0xffffff;
    this.aura.alpha = empowered ? 1 : 0.6;
    this.scale.set(empowered ? 1.2 : 1);
  }
}
