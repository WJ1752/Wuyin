import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { ClassId, SkillDef } from '../core/types';
import {
  CHARACTER_ART,
  CHARACTER_COMBAT_ART,
  getCharacterTexture,
  type WornArt,
} from './CharacterTextures';
import { getAtlasTexture } from './TextureAtlas';
import { drawPixelCreature, PixelSkin, smoothRange, stepLift, stepOffset } from './MonsterRenderer';

const COLORS: Record<ClassId, number> = {
  ranger: 0x84c5a1,
  barbarian: 0xd0a269,
  sorcerer: 0xa99be9,
  necromancer: 0x94c9b3,
  druid: 0xb2cbe1,
};

interface Gesture {
  duration: number;
  torso: readonly [x: number, y: number, pitch: number];
  grip: readonly [x: number, y: number, pitch: number];
  offhand: readonly [x: number, y: number];
}

const CLASS_GESTURES: Record<ClassId, Gesture> = {
  ranger: { duration: 0.26, torso: [-1, -1, -0.045], grip: [6, -10, -0.13], offhand: [5, -10] },
  barbarian: { duration: 0.36, torso: [6, 3, 0.13], grip: [6, 3, 0.19], offhand: [6, -4] },
  sorcerer: { duration: 0.34, torso: [2, -2, 0.04], grip: [4, -5, 0.2], offhand: [4, -8] },
  necromancer: { duration: 0.34, torso: [4, 2, 0.09], grip: [7, 3, 0.25], offhand: [4, -6] },
  druid: { duration: 0.27, torso: [5, 4, 0.1], grip: [6, -4, -0.11], offhand: [-3, -7] },
};
const INVOCATION: Gesture = {
  duration: 0.37,
  torso: [-1, -3, -0.055],
  grip: [3, -8, -0.13],
  offhand: [5, -10],
};
const EVASION: Gesture = {
  duration: 0.25,
  torso: [6, 5, 0.15],
  grip: [0, 0, -0.08],
  offhand: [-4, 2],
};

const TORSO = 0;
const REAR_BOOT = 1;
const FRONT_BOOT = 2;
const GRIP = 3;
const OFFHAND = 4;
const CLOAK = 5;
const BOOT_LEVEL = 12;

function heroSkin(texture: Texture, classId: ClassId) {
  const { hips, boots, grip, offhand } = CHARACTER_COMBAT_ART[classId];
  const uv = ([x, y]: readonly [number, number]) => [x / 128, y / 128] as const;
  const hip = uv(hips);
  const hand = uv(grip);
  const backHand = uv(offhand);
  const center = (boots[0] + boots[1]) / 256;
  const leg = (v: number) => smoothRange(hip[1] + 0.02, 0.96, v);
  const front = (u: number) => smoothRange(center - 0.23, center + 0.23, u);
  const offhandWeight = (u: number, v: number) =>
    (1 - smoothRange(0.065, 0.23, Math.abs(u - backHand[0]))) *
    (1 - smoothRange(0.03, 0.29, Math.abs(v - backHand[1])));
  // Bows, staves and scythes stay bound to the leading wrist along their shafts.
  // The horizontal axe and the low blades leave the shoulders free to counterturn.
  const gripWeight = (u: number, v: number) => {
    const side = smoothRange(hand[0] - 0.23, hand[0] + 0.035, u);
    if (classId === 'barbarian' || classId === 'druid')
      return side * smoothRange(0.12, 0.48, v) * (1 - smoothRange(0.67, 0.96, v));
    return side;
  };
  return new PixelSkin(
    texture,
    88,
    CHARACTER_ART[classId].ground,
    [
      { pivot: hip, weight: (u, v) => (1 - leg(v)) * (1 - gripWeight(u, v) * 0.72) },
      { pivot: uv([boots[0], 124]), weight: (u, v) => leg(v) * (1 - front(u)) },
      { pivot: uv([boots[1], 124]), weight: (u, v) => leg(v) * front(u) * (1 - gripWeight(u, v)) },
      { pivot: hand, weight: gripWeight },
      { pivot: backHand, weight: offhandWeight },
      {
        pivot: uv([48, 47]),
        weight: (u, v) =>
          (1 - smoothRange(0.32, 0.55, u)) *
          smoothRange(0.27, 0.47, v) *
          (1 - smoothRange(0.78, 0.94, v)),
      },
    ],
    9,
  );
}

/** Keep the boots, contact shadow and combat halo on the same ground plane. */
export class CharacterRig extends Container {
  private aura = new Graphics();
  private body = new Container();
  private skin?: PixelSkin;
  private stillArt?: Sprite;
  private actionArt?: Texture;
  private restArt?: Texture;
  private heading = 1;
  private actionHeading = 1;
  private aimX = 1;
  private aimY = 0;
  private gesture: Gesture;
  private actionAge = 1;
  private actionDuration = 0.28;
  private actionWeight = 0;
  private hitTime = 0;
  private down = false;
  private lastX?: number;
  private lastY?: number;
  private stridePhase = 0.25;
  private pace = 0;
  private travelX = 0;
  private travelY = 0;
  private readonly motion = !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  private readonly summon: boolean;

  constructor(
    public classId: ClassId,
    options: { summon?: boolean; equipment?: WornArt } = {},
  ) {
    super();
    this.gesture = CLASS_GESTURES[classId];
    this.summon = !!options.summon;
    const shadow = new Graphics().ellipse(0, 11, 22, 7).fill({ color: 0x11191d, alpha: 0.55 });
    const accent = COLORS[classId];
    this.aura.ellipse(0, BOOT_LEVEL, 27, 9).stroke({ color: accent, width: 1.5, alpha: 0.55 });
    this.body.y = BOOT_LEVEL;
    this.addChild(shadow, this.aura, this.body);
    const texture = this.summon
      ? getAtlasTexture(classId === 'sorcerer' ? 'monster:ice_shaman' : 'monster:skeleton')
      : getCharacterTexture(classId, 'idle', options.equipment);
    this.restArt = texture;
    if (texture && !this.summon && this.motion) {
      this.skin = heroSkin(texture, classId);
      this.body.addChild(this.skin);
    } else if (texture) {
      this.stillArt = new Sprite(texture);
      this.stillArt.anchor.set(0.5, this.summon ? 251 / 256 : CHARACTER_ART[classId].ground);
      this.stillArt.width = this.stillArt.height = 88;
      this.body.addChild(this.stillArt);
      if (!this.summon) this.actionArt = getCharacterTexture(classId, 'action', options.equipment);
    } else {
      const ally = new Graphics();
      drawPixelCreature(
        ally,
        classId === 'sorcerer' ? 'skeleton_mage' : classId === 'druid' ? 'wolf' : 'skeleton',
        accent,
      );
      ally.y = -BOOT_LEVEL;
      this.body.addChild(ally);
    }
  }

  hit() {
    if (!this.down) this.hitTime = 0.16;
  }

  setDown(down: boolean) {
    if (down === this.down) return;
    this.down = down;
    this.actionAge = 1;
    this.actionWeight = this.hitTime = this.pace = 0;
    this.lastX = this.lastY = undefined;
    this.body.y = BOOT_LEVEL + (down ? 3 : 0);
    this.body.rotation = down ? -this.heading * 0.94 : 0;
    this.body.scale.set(this.heading, down ? 0.72 : 1);
    this.body.tint = down ? 0x9faaa8 : 0xffffff;
    this.aura.alpha = down ? 0 : 0.6;
    if (this.stillArt && !this.summon) {
      const rest = this.restArt;
      if (rest) this.stillArt.texture = rest;
    }
  }

  attack(skill?: SkillDef, angle?: number, interval = 0.38) {
    if (this.down) return;
    if (skill?.kind === 'movement') this.gesture = EVASION;
    else if (
      skill &&
      (skill.kind === 'defense' ||
        (this.classId === 'necromancer' && skill.effect !== 'scythe') ||
        (this.classId === 'druid' && ['raven', 'vine', 'storm'].includes(skill.effect)))
    )
      this.gesture = INVOCATION;
    else this.gesture = CLASS_GESTURES[this.classId];

    this.aimX = angle === undefined ? this.heading : Math.cos(angle);
    this.aimY = angle === undefined ? 0 : Math.sin(angle);
    this.actionHeading = Math.abs(this.aimX) > 0.18 ? Math.sign(this.aimX) : this.heading;
    this.actionDuration = Math.max(0.09, Math.min(interval, this.gesture.duration));
    this.actionAge = 0;
  }

  update(time: number, dt: number, moving: boolean, facing: number, empowered: boolean) {
    if (this.down) return;
    const art = CHARACTER_COMBAT_ART[this.classId];
    const firstSample = this.lastX === undefined;
    const dx = this.lastX === undefined ? 0 : this.x - this.lastX;
    const dy = this.lastY === undefined ? 0 : this.y - this.lastY;
    this.lastX = this.x;
    this.lastY = this.y;

    const distance = Math.hypot(dx, dy);
    const stepping = moving && distance > 0.01 && distance < 94 && dt > 0;
    const travel = stepping ? Math.min(distance, 520 * dt) : 0;
    const follow = 1 - Math.exp(-dt * 29);
    this.pace += (Math.min(1, travel / Math.max(100 * dt, 0.01)) - this.pace) * follow;
    if (stepping) {
      this.stridePhase = (this.stridePhase + travel / (2 * art.stride)) % 1;
      this.travelX += (dx / distance - this.travelX) * follow;
      this.travelY += (dy / distance - this.travelY) * follow;
    }

    this.actionAge += dt;
    const t = this.actionAge / this.actionDuration;
    const attacking = t < 1;
    // Cast effects and damage already happen at attack(). Enter extension right away.
    const extension = smoothRange(0, 0.17, t) * (1 - smoothRange(0.24, 1, t));
    this.actionWeight += (extension - this.actionWeight) * (1 - Math.exp(-dt * 52));
    if (attacking) this.heading = this.actionHeading;
    else if (stepping && Math.abs(dx / distance) > 0.24) this.heading = Math.sign(dx);
    else if (moving && firstSample && Math.abs(facing) > 0.24) this.heading = Math.sign(facing);
    this.body.scale.x = this.heading;
    this.hitTime = Math.max(0, this.hitTime - dt);
    const recoil = this.hitTime / 0.16;
    this.body.tint = this.hitTime > 0 ? 0xf1c1ad : 0xffffff;
    this.aura.alpha = empowered ? 1 : 0.6;
    if (!this.summon) this.scale.set(empowered ? 1.2 : 1);

    if (this.skin) {
      const weight = this.actionWeight;
      const secondStep = (this.stridePhase + 0.5) % 1;
      const localX = this.travelX * this.heading;
      const pace = this.pace * (1 - weight * 0.34);
      const rise = Math.cos(this.stridePhase * Math.PI * 4);
      const idle = Math.sin(time * 2.4) * (1 - this.pace);
      const lean = localX * pace;
      const aimX = 0.37 + 0.63 * Math.abs(this.aimX);
      const { torso, grip, offhand } = this.gesture;
      this.skin.moveJoint(
        TORSO,
        torso[0] * aimX * weight + 2.8 * lean - recoil * 3.5,
        torso[1] * weight - idle * 0.65 - rise * pace,
        torso[2] * weight + 0.065 * lean - recoil * 0.072,
      );
      const backStep = stepOffset(this.stridePhase) * art.bootTravel * pace;
      const frontStep = stepOffset(secondStep) * art.bootTravel * pace;
      this.skin.moveJoint(
        REAR_BOOT,
        localX * backStep,
        this.travelY * backStep * 0.58 - stepLift(this.stridePhase) * art.clearance * pace,
      );
      this.skin.moveJoint(
        FRONT_BOOT,
        localX * frontStep,
        this.travelY * frontStep * 0.58 - stepLift(secondStep) * art.clearance * pace,
      );
      this.skin.moveJoint(
        GRIP,
        grip[0] * aimX * weight - lean + recoil * 1.8,
        (grip[1] + this.aimY * 5) * weight - 0.8 * idle,
        (grip[2] + this.aimY * this.heading * 0.09) * weight - lean * 0.045,
      );
      this.skin.moveJoint(
        OFFHAND,
        offhand[0] * weight + backStep * localX * 0.24,
        offhand[1] * weight - stepLift(secondStep) * pace,
      );
      this.skin.moveJoint(
        CLOAK,
        -3.6 * lean - weight * 2,
        idle * 0.8,
        -0.13 * lean + weight * 0.09,
      );
      this.skin.commitPose();
    } else if (this.actionArt && this.stillArt) {
      const frame = attacking && this.gesture !== EVASION ? this.actionArt : this.restArt;
      if (frame && this.stillArt.texture !== frame) this.stillArt.texture = frame;
    } else if (this.motion) {
      this.body.rotation = this.heading * (this.actionWeight * 0.07 - recoil * 0.08);
    }
  }
}
