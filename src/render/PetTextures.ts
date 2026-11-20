import { Assets, Sprite, Texture } from 'pixi.js';
import { PET_ART } from '../data/petVisuals';

const textures = new Map<string, { idle: Texture; action: Texture }>();

/** Combat and the companion panel share the companion's base sprite. */
export async function preloadPetTexture(id: string) {
  const art = PET_ART[id] ?? PET_ART.owl;
  const [idle, action] = await Promise.all([
    Assets.load<Texture>(art.src),
    Assets.load<Texture>(art.action),
  ]);
  idle.source.scaleMode = action.source.scaleMode = 'nearest';
  textures.set(id, { idle, action });
}

export class PetRig extends Sprite {
  private heading = 1;
  private traveling = false;
  private actionTime = 0;
  private readonly art;
  private readonly frames;
  private readonly motion = !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  constructor(id: string) {
    const frames = textures.get(id);
    super(frames?.idle ?? Texture.EMPTY);
    this.frames = frames;
    this.art = PET_ART[id] ?? PET_ART.owl;
    this.anchor.set(this.art.anchorX, this.art.ground);
    this.width = this.height = 38;
  }

  travel(dx: number, moving: boolean) {
    if (Math.abs(dx) > 0.5) this.heading = Math.sign(dx);
    this.traveling = moving;
  }

  react() {
    this.actionTime = 0.3;
  }

  updatePose(time: number, dt: number, down: boolean) {
    this.actionTime = Math.max(0, this.actionTime - dt);
    const stride = Math.sin(time * (this.art.flies ? 10 : 17));
    const active =
      !down && (this.actionTime > 0 || (this.traveling && (!this.motion || stride > -0.1)));
    const next = this.frames?.[active ? 'action' : 'idle'];
    if (next && this.texture !== next) this.texture = next;
    const size = 38 / this.texture.width;
    this.scale.set(size * this.heading, size);
    this.y = this.art.flies ? -3 : 0;
    this.rotation = 0;
    if (this.motion && !down && (this.traveling || this.art.flies)) {
      this.y -= this.art.flies ? stride * 1.5 : Math.max(0, stride) * 2;
      this.rotation = this.heading * stride * (this.art.flies ? 0.045 : 0.08);
    }
    this.alpha = down ? 0.4 : 1;
  }
}
