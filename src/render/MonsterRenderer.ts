import { Container, Graphics, MeshSimple, Sprite, type Texture } from 'pixi.js';
import { getAtlasTexture } from './TextureAtlas';
import type { MonsterAttackPose } from '../core/coop';
import type { MonsterDef } from '../core/types';
import { pixelEllipse, pixelLine, pixelPolygon, pixelStamp } from './PixelArt';

const INK = 0x14202a;
const BONE = 0xe1d3ad;
const LIGHT = 0xf8ebc5;

export function smoothRange(start: number, end: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

/** The planted leg travels back at a steady rate while its partner swings forward. */
export function stepOffset(phase: number) {
  return phase < 0.5 ? 1 - 4 * phase : 2 * smoothRange(0.5, 1, phase) - 1;
}

export function stepLift(phase: number) {
  const swing = Math.max(0, phase * 2 - 1);
  return 4 * swing * (1 - swing);
}

interface SkinJoint {
  pivot: readonly [number, number];
  weight: (u: number, v: number) => number;
}

/**
 * Skin the original nearest-neighbor artwork as a single silhouette. Each joint
 * moves a localized part of the image, with shared vertices across seams.
 */
export class PixelSkin extends MeshSimple {
  private readonly rest: Float32Array;
  private readonly joints: {
    x: number;
    y: number;
    weights: Float32Array;
    dx: number;
    dy: number;
    angle: number;
  }[];
  private changed = false;

  constructor(texture: Texture, size: number, ground: number, joints: SkinJoint[], detail = 6) {
    const rest = new Float32Array(detail * detail * 2);
    const uvs = new Float32Array(rest.length);
    const indices: number[] = [];
    for (let row = 0; row < detail; row++) {
      for (let column = 0; column < detail; column++) {
        const index = row * detail + column;
        const u = column / (detail - 1);
        const v = row / (detail - 1);
        uvs.set([u, v], index * 2);
        rest.set([(u - 0.5) * size, (v - ground) * size], index * 2);
        if (row && column) {
          const topLeft = index - detail - 1;
          indices.push(topLeft, topLeft + 1, index, topLeft, index, index - 1);
        }
      }
    }
    // Keep the grid batchable and sample the atlas through Pixi's texture UV matrix.
    super({ texture, vertices: rest.slice(), uvs, indices: Uint32Array.from(indices) });
    this.autoUpdate = false;
    this.rest = rest;
    this.joints = joints.map(({ pivot: [u, v], weight }) => ({
      x: (u - 0.5) * size,
      y: (v - ground) * size,
      weights: Float32Array.from({ length: rest.length / 2 }, (_, i) =>
        weight(uvs[i * 2], uvs[i * 2 + 1]),
      ),
      dx: 0,
      dy: 0,
      angle: 0,
    }));
  }

  moveJoint(index: number, dx: number, dy: number, angle = 0) {
    const joint = this.joints[index];
    if (joint.dx === dx && joint.dy === dy && joint.angle === angle) return;
    joint.dx = dx;
    joint.dy = dy;
    joint.angle = angle;
    this.changed = true;
  }

  commitPose() {
    if (!this.changed) return;
    this.changed = false;
    const vertices = this.vertices;
    vertices.set(this.rest);
    for (const { x, y, weights, dx, dy, angle } of this.joints) {
      if (!dx && !dy && !angle) continue;
      const cos = Math.cos(angle) - 1;
      const sin = Math.sin(angle);
      for (let index = 0; index < weights.length; index++) {
        const weight = weights[index];
        if (!weight) continue;
        const i = index * 2;
        const u = this.rest[i] - x;
        const v = this.rest[i + 1] - y;
        vertices[i] += (dx + cos * u - sin * v) * weight;
        vertices[i + 1] += (dy + sin * u + cos * v) * weight;
      }
    }
    this.geometry.getBuffer('aPosition').update();
  }

  override destroy(options?: Parameters<MeshSimple['destroy']>[0]) {
    const geometry = this.geometry;
    super.destroy(options);
    geometry.destroy();
  }
}

/** Family anatomy is drawn as solid pixel clusters with a shared three-pixel grid. */
export function drawPixelCreature(g: Graphics, family: string, color: number, boss = false) {
  const block = (x: number, y: number, w: number, h: number, ink = color) =>
    g.rect(x, y, w, h).fill(ink);
  const orb = (x: number, y: number, rx: number, ry: number, ink = color) =>
    pixelEllipse(g, x, y, rx, ry, ink);
  const poly = (points: number[], ink = color) => pixelPolygon(g, points, ink);
  const line = (x: number, y: number, tx: number, ty: number, ink = BONE, cell = 3) =>
    pixelLine(g, x, y, tx, ty, ink, cell);
  const eyes = (y: number, ink = 0xffb978) => {
    block(-9, y, 6, 6, INK);
    block(6, y, 6, 6, INK);
    block(-9, y, 3, 3, ink);
    block(6, y, 3, 3, ink);
  };
  const skull = () => {
    pixelStamp(
      g,
      [
        '..kkkkkk..',
        '.kbbbbbbk.',
        'kbbwwbbbbk',
        'kwwwwbbbbk',
        'kbkkbbkkbk',
        'kbkkbbkkbk',
        '.kbbkkbbk.',
        '..kb bbk..',
        '..kbbbbk..',
        '...kkkk...',
      ],
      { k: INK, b: BONE, w: LIGHT },
      -15,
      -51,
      3,
    );
    block(-9, -36, 3, 3, color);
    block(6, -36, 3, 3, color);
  };
  if (family === 'dummy') {
    block(-6, -39, 12, 48, 0x382b2b);
    block(-3, -36, 6, 42, 0xa77e47);
    block(-24, -27, 51, 6, 0xa77e47);
    block(-15, 6, 33, 6, 0x70583d);
    orb(0, -33, 21, 24, INK);
    orb(0, -33, 18, 21, 0xc8ad70);
    orb(0, -33, 12, 15, 0x7c5644);
    orb(0, -33, 6, 9, 0xe3c58a);
    block(-3, -36, 6, 9, 0xa95049);
    return;
  }
  if (family === 'goblin') {
    // The treasure carrier has a broad coin sack, pointed ears and short running legs.
    orb(15, -18, 21, 24, INK);
    orb(15, -21, 18, 21, 0x977243);
    orb(12, -27, 12, 12, 0xc69a59);
    block(6, -42, 18, 6, 0xe5c27e);
    block(12, -42, 3, 24, 0x6f5339);
    block(-12, -6, 9, 15, INK);
    block(3, -6, 9, 15, INK);
    block(-12, 3, 9, 6, 0xa08658);
    block(3, 3, 9, 6, 0xa08658);
    orb(-3, -18, 12, 15, INK);
    orb(-3, -21, 9, 12, 0x617f55);
    for (const side of [-1, 1]) {
      poly([side * 6, -39, side * 27, -48, side * 18, -30], INK);
      poly([side * 9, -39, side * 21, -42, side * 15, -33], 0x9baa71);
    }
    orb(-3, -36, 18, 18, INK);
    orb(-3, -36, 15, 15, 0x92a36b);
    eyes(-39, 0xffe39a);
    poly([-3, -36, -9, -27, 3, -27], 0xc2c58c);
    block(-9, -24, 15, 3, INK);
    block(-9, -24, 3, 3, LIGHT);
    block(-18, -18, 6, 12, 0x92a36b);
    pixelStamp(g, ['.aa.', 'abba', 'abba', '.aa.'], { a: 0xf2cf77, b: 0xa8793a }, 21, -15);
  } else if (['insect', 'spider', 'scorpion'].includes(family)) {
    for (const side of [-1, 1])
      for (let i = 0; i < (family === 'spider' ? 4 : 3); i++) {
        line(side * 12, -15, side * (24 + i * 3), -30 + i * 15, INK, 6);
        line(side * (24 + i * 3), -30 + i * 15, side * (36 + i * 3), -21 + i * 15, color);
      }
    orb(0, -24, 21, 21, INK);
    orb(0, -24, 18, 18);
    orb(-6, -30, 9, 9, family === 'insect' ? 0xc8dd8b : 0xab9cb3);
    orb(0, -3, 12, 12, INK);
    orb(0, -3, 9, 9);
    eyes(-6);
    block(-6, 6, 3, 6, BONE);
    block(6, 6, 3, 6, BONE);
    if (family === 'insect') {
      block(-3, -39, 9, 21, 0xd3e48b);
      block(-9, -30, 18, 6, 0xc6e789);
    } else if (family === 'scorpion') {
      line(0, -36, -12, -54, color, 6);
      line(-12, -54, 0, -69, color, 6);
      poly([0, -69, 15, -63, 9, -51, 6, -60], BONE);
      for (const s of [-1, 1])
        poly([s * 12, -6, s * 30, -18, s * 36, -6, s * 27, 9, s * 24, -3, s * 15, 3]);
    }
  } else if (['worm', 'serpent'].includes(family)) {
    for (let i = 5; i >= 0; i--) {
      const x = i * 6 - 12,
        y = Math.round((Math.sin(i) * 6) / 3) * 3;
      orb(x, y, 12 - i, 9, INK);
      orb(x, y - 3, 9 - i, 6);
      block(x - 3, y - 3, 3, 3, BONE);
    }
    orb(-6, -21, 15, 24, INK);
    orb(-6, -24, 12, 21);
    if (family === 'serpent') {
      poly([-21, -39, -27, -27, -18, -6, 12, -6, 21, -27, 12, -39], INK);
      poly([-18, -36, -21, -27, -12, -12, 9, -12, 15, -27, 9, -36]);
      block(-6, -24, 9, 15, 0xd0c294);
      eyes(-30);
      line(0, -9, 0, 3, 0xf59e9e);
    } else {
      orb(-6, -30, 9, 9, INK);
      block(-12, -36, 3, 6, BONE);
      block(0, -36, 3, 6, BONE);
      block(-6, -24, 3, 6, BONE);
    }
  } else if (family === 'eye') {
    for (let i = -2; i <= 2; i++) {
      line(i * 6, -12, i * 9, 0, color);
      line(i * 9, 0, i * 6 + 3, 12, color);
    }
    orb(0, -30, 24, 21, INK);
    orb(0, -30, 21, 18, BONE);
    orb(0, -30, 12, 15);
    block(-3, -42, 6, 27, INK);
    block(-9, -39, 6, 6, LIGHT);
  } else if (['wolf', 'rat', 'drake', 'bat', 'imp'].includes(family)) {
    if (['bat', 'drake', 'imp'].includes(family))
      for (const s of [-1, 1]) {
        poly([s * 9, -30, s * 36, -57, s * 51, -21, s * 36, -27, s * 27, -9, s * 12, -18], INK);
        poly([s * 12, -30, s * 36, -48, s * 45, -27, s * 33, -33, s * 24, -18], color);
        line(s * 33, -42, s * 24, -24, BONE);
      }
    if (family !== 'bat') {
      orb(0, -12, 18, 15, INK);
      orb(0, -15, 15, 12);
      block(-15, -3, 9, 12, INK);
      block(9, -3, 9, 12, INK);
      block(-12, 0, 6, 6, BONE);
      block(9, 0, 6, 6, BONE);
      line(12, -9, 27, -3, color, 6);
      line(27, -3, 36, -18, color, family === 'rat' ? 3 : 6);
    }
    orb(0, -33, 18, 18, INK);
    orb(0, -33, 15, 15);
    if (family === 'rat') {
      orb(-15, -45, 9, 9, INK);
      orb(15, -45, 9, 9, INK);
      orb(-15, -45, 6, 6, 0xba8b91);
      orb(15, -45, 6, 6, 0xba8b91);
    } else
      for (const s of [-1, 1]) {
        poly([s * 6, -45, s * 18, -60, s * 21, -36], INK);
        poly([s * 12, -45, s * 18, -54, s * 18, -39], family === 'imp' ? BONE : color);
      }
    eyes(-36);
    orb(0, -24, 9, 6, BONE);
    block(-3, -27, 6, 3, INK);
    if (family === 'drake') {
      for (let i = 0; i < 3; i++) block(-6 + i * 6, -15, 3, 6, LIGHT);
      poly([-3, -51, 0, -66, 6, -48], BONE);
    }
  } else if (
    ['ghost', 'revenant', 'cultist', 'shaman', 'assassin', 'skeleton_mage'].includes(family)
  ) {
    poly([-12, -36, -21, 9, -9, 3, 0, 12, 9, 3, 21, 9, 12, -36], INK);
    poly([-9, -30, -15, 6, -6, 0, 0, 9, 9, 0, 15, 3, 9, -30]);
    orb(0, -36, 18, 21, INK);
    orb(0, -39, 15, 18);
    poly([-12, -36, 0, -48, 12, -36, 9, -24, -9, -24], INK);
    eyes(-36, 0xb5ffe2);
    block(-12, -48, 6, 6, 0xc4c2bf);
    if (family === 'ghost') {
      block(-24, -21, 6, 12);
      block(21, -21, 6, 12);
    }
    if (family === 'revenant') {
      block(-21, -27, 12, 9, BONE);
      block(12, -27, 12, 9, BONE);
      line(21, -18, 27, 9, BONE, 6);
      poly([24, -3, 24, -45, 30, -54, 33, -3], 0xa7dbe7);
    }
    if (family === 'cultist' || family === 'shaman' || family === 'skeleton_mage') {
      line(24, 9, 24, -48, 0x9d7857);
      poly([24, -63, 33, -51, 24, -39, 15, -51], family === 'shaman' ? 0xbceeff : 0xbda0e3);
      block(21, -54, 3, 6, LIGHT);
      if (family === 'shaman')
        for (let i = -1; i <= 1; i++)
          poly([i * 12 - 6, -48, i * 12, -69 + Math.abs(i) * 6, i * 12 + 6, -48], 0xb3dfdf);
      else if (family === 'cultist') poly([-15, -42, 0, -69, 15, -42], color);
    }
    if (family === 'skeleton_mage') skull();
    if (family === 'assassin')
      for (const s of [-1, 1]) {
        line(s * 15, -18, s * 21, 0, color, 6);
        poly([s * 21, 0, s * 27, -30, s * 30, -36, s * 30, 0], BONE);
      }
  } else if (family === 'ent' || family === 'golem') {
    for (const s of [-1, 1]) {
      block(s * 15 - 9, -3, 15, 15, INK);
      block(s * 15 - 6, 0, 9, 9, 0x8e8066);
      orb(s * 24, -21, 12, 15, INK);
      orb(s * 24, -24, 9, 12);
    }
    orb(0, -24, 21, 24, INK);
    orb(0, -27, 18, 21);
    orb(0, -42, 18, 18, INK);
    orb(0, -45, 15, 15);
    eyes(-45, family === 'ent' ? 0xd6eda1 : 0xffdc97);
    if (family === 'ent') {
      for (const s of [-1, 1]) {
        line(s * 9, -54, s * 21, -66, 0x99855c, 6);
        line(s * 21, -66, s * 18, -78, 0x99855c);
        orb(s * 21, -63, 12, 6, 0x60794d);
      }
      block(-9, -27, 3, 21, 0xb29967);
      block(9, -21, 3, 18, 0xb29967);
    } else {
      line(-3, -33, 6, -21, 0xffb66d);
      line(6, -21, 0, -6, 0xffdb93);
      block(-27, -33, 12, 3, 0xc99973);
      block(18, -33, 12, 3, 0xc99973);
    }
  } else {
    // Short armored bodies and oversized heads unify skeleton, knight and bruiser proportions.
    block(-12, -6, 9, 15, INK);
    block(6, -6, 9, 15, INK);
    block(-12, 3, 9, 6, 0x7e7972);
    block(6, 3, 9, 6, 0x7e7972);
    orb(0, -15, 15, 18, INK);
    orb(0, -18, 12, 15);
    block(-18, -24, 6, 21, BONE);
    block(15, -24, 6, 21, BONE);
    block(-9, -9, 21, 3, INK);
    block(-3, -9, 6, 3, 0xe6bd72);
    skull();
    if (family === 'skeleton' || family === 'archer') {
      block(-9, -24, 21, 3, BONE);
      block(-6, -18, 15, 3, BONE);
      if (family === 'archer') {
        line(24, -42, 33, -27, 0xcb9b60);
        line(33, -27, 33, -15, 0xcb9b60);
        line(33, -15, 24, 0, 0xcb9b60);
        line(24, -42, 24, 0, BONE);
        line(18, -21, 39, -21, BONE);
      } else {
        block(-27, -24, 15, 24, INK);
        block(-24, -21, 9, 18, 0x718784);
        line(24, -30, 24, 3, 0xc3d5cb, 6);
        block(18, -3, 15, 3, 0xc6a35f);
      }
    } else if (family === 'knight') {
      block(-15, -48, 33, 15, 0x8a9ba4);
      block(-12, -36, 27, 6, INK);
      block(0, -51, 6, 24, 0xc5d3cd);
      block(-24, -27, 15, 12, 0x93a2a8);
      block(12, -27, 15, 12, 0x93a2a8);
      poly([24, 3, 24, -42, 30, -54, 36, -42, 33, 3], BONE);
      block(18, -3, 21, 3, 0xcba771);
    } else if (family === 'zombie') {
      orb(0, -36, 15, 15);
      eyes(-39);
      block(-9, -27, 18, 3, INK);
      block(-24, -27, 15, 9);
      block(15, -30, 15, 9);
      block(-6, -18, 9, 6, 0xa16a66);
    } else {
      orb(0, -36, 18, 18);
      eyes(-39);
      orb(0, -27, 12, 6, 0xb79882);
      for (const s of [-1, 1]) poly([s * 9, -45, s * 24, -45, s * 27, -63, s * 18, -51], BONE);
      if (family === 'jailer') {
        line(-18, -6, -36, 9, 0x9ea9a6);
        orb(-42, 9, 12, 12, INK);
        orb(-42, 9, 9, 9, 0x718080);
      } else {
        line(27, 6, 27, -42, 0xaa855c, 6);
        poly([18, -42, 42, -45, 42, -24, 18, -30], BONE);
      }
    }
  }
  if (boss) {
    // Each keeper has regalia tied to its identity, beyond the larger family body.
    if (family === 'skeleton') {
      pixelStamp(
        g,
        ['a..a..a', 'aa.a.aa', 'aaaaaaa', '.bbbbb.'],
        { a: 0xe5bd72, b: 0x88674b },
        -9,
        -63,
      );
      poly([-18, -24, -27, -3, -21, 9, -12, 6, -12, -18], 0x895067);
      block(-27, -24, 15, 3, 0xe5bd72);
      block(-24, -18, 3, 12, 0xe5bd72);
      block(-18, -15, 3, 9, 0xe5bd72);
    } else if (family === 'ent') {
      for (const side of [-1, 1]) {
        line(side * 21, -66, side * 39, -72, 0x8c754e, 6);
        line(side * 39, -72, side * 42, -84, 0x8c754e);
        poly([side * 27, -69, side * 27, -81, side * 36, -72], 0xe1c1a0);
        pixelStamp(g, ['.aa.', 'abba', '.aa.'], { a: 0xd7a3a4, b: 0xf7dfac }, side * 21 - 6, -69);
      }
      block(-6, -21, 15, 9, 0x304b3b);
      block(-3, -18, 9, 3, 0xe0d392);
    } else if (family === 'golem') {
      block(-15, -24, 33, 24, INK);
      block(-12, -21, 27, 18, 0xb85b3b);
      block(-9, -18, 21, 12, 0xffc36c);
      for (let x = -6; x <= 9; x += 6) block(x, -21, 3, 18, 0x5a3f3c);
      for (const side of [-1, 1]) {
        block(side * 24 - 6, -51, 12, 24, INK);
        block(side * 24 - 3, -48, 6, 18, 0x7d5650);
        poly(
          [
            side * 24 - 3,
            -51,
            side * 24 - 6,
            -57,
            side * 24,
            -69,
            side * 24 + 3,
            -57,
            side * 24 + 6,
            -54,
          ],
          0xf3b15c,
        );
      }
    } else if (family === 'ghost') {
      pixelEllipse(g, 0, -66, 27, 9, 0xc7b6eb, 3, 1, true);
      block(-3, -78, 9, 6, 0xe8d5f3);
      poly([-15, -24, -27, 9, -18, 6, -9, -18], 0x7c6aa0);
      poly([15, -24, 27, 9, 18, 6, 9, -18], 0x7c6aa0);
      for (const x of [-33, 30]) pixelStamp(g, ['.a.', 'aaa', '.a.'], { a: 0xe8d5f3 }, x, -27);
      block(-3, -21, 9, 6, 0xe7d2ac);
    } else if (family === 'drake') {
      for (const side of [-1, 1]) {
        poly([side * 18, -42, side * 36, -60, side * 33, -33], 0x94c4da);
        line(side * 21, -42, side * 33, -54, 0xe2f4ed);
        poly([side * 15, -6, side * 24, -12, side * 21, 6], 0xd0eced);
      }
      block(-6, -18, 15, 3, INK);
      block(-6, -12, 15, 3, INK);
      block(-3, -21, 6, 18, 0xe2f4ed);
    } else if (family === 'minotaur') {
      block(-9, -18, 21, 24, 0x543d43);
      block(-6, -18, 15, 21, 0xa66f62);
      block(0, -15, 6, 9, 0xd09b7d);
      block(21, -45, 24, 24, INK);
      block(24, -42, 18, 18, 0xb9bdb0);
      block(24, -24, 18, 3, LIGHT);
      block(36, -39, 3, 3, INK);
      line(-18, -18, -27, -6, 0x92a4a3);
      line(-27, -6, -36, -12, 0x92a4a3);
      line(-36, -12, -36, -24, 0x92a4a3);
    } else if (family === 'knight') {
      for (const side of [-1, 1]) {
        poly([side * 12, -42, side * 21, -63, side * 18, -39], 0xd9d3fa);
        poly(
          [side * 21, -27, side * 36, -42, side * 30, -24, side * 39, -27, side * 24, -12],
          0xa5b8eb,
        );
      }
      pixelStamp(g, ['.aa.', 'aaa.', '.aa.', 'aa..', 'a...'], { a: 0xf5e7b5 }, -3, -24);
    } else if (family === 'serpent') {
      for (const side of [-1, 1]) {
        poly(
          [side * 12, -36, side * 30, -60, side * 24, -30, side * 36, -39, side * 21, -12],
          0x8d78af,
        );
        line(side * 18, -36, side * 27, -48, 0xd4b6e3);
        block(side * 18, -27, 6, 3, 0xe4d0a6);
      }
      orb(0, -15, 6, 9, INK);
      block(-3, -21, 3, 12, 0xe9cce6);
      block(3, -18, 3, 6, 0xb792dc);
    }
  }
}

type EnemyGait = 'stride' | 'scuttle' | 'wing' | 'float' | 'slither' | 'still';

function enemyGait(family: string): EnemyGait {
  if (['bat', 'drake', 'imp'].includes(family)) return 'wing';
  if (['ghost', 'eye'].includes(family)) return 'float';
  if (['serpent', 'worm'].includes(family)) return 'slither';
  if (['wolf', 'rat', 'spider', 'scorpion', 'insect'].includes(family)) return 'scuttle';
  return family === 'dummy' ? 'still' : 'stride';
}

const CORE = 0;
const REAR_FOOT = 1;
const FRONT_FOOT = 2;
const LEADING_LIMB = 3;
const TRAILING_LIMB = 4;

function monsterSkin(texture: Texture, size: number, gait: EnemyGait, def: MonsterDef) {
  const low = gait === 'scuttle';
  const winged = gait === 'wing';
  const coiled = gait === 'slither';
  const hovering = gait === 'float';
  const hips = low ? 0.69 : 0.6;
  const legs = (v: number) => smoothRange(hips + 0.02, 0.94, v);
  const near = (u: number) => smoothRange(0.31, 0.73, u);
  const limbHeight = coiled && def.family === 'serpent' ? 0.34 : low ? 0.63 : 0.52;
  const jointHeight = winged ? 0.48 : limbHeight;
  const arm = (v: number) =>
    smoothRange(0.18, jointHeight - 0.05, v) * (1 - smoothRange(jointHeight + 0.12, 0.91, v));
  const leading = (u: number) => smoothRange(0.54, 0.85, u);
  const trailing = (u: number) => 1 - smoothRange(0.22, 0.49, u);
  return new PixelSkin(texture, size, 0.956, [
    {
      pivot: [0.5, hips],
      weight: (u, v) => (1 - legs(v)) * (1 - leading(u) * arm(v) * 0.56),
    },
    { pivot: [0.3, 0.956], weight: (u, v) => legs(v) * (1 - near(u)) },
    { pivot: [0.7, 0.956], weight: (u, v) => legs(v) * near(u) },
    {
      pivot: [0.63, jointHeight],
      weight: (u, v) => leading(u) * (winged ? 1 - smoothRange(0.55, 0.82, v) : arm(v)),
    },
    {
      pivot: [0.38, winged ? 0.41 : hovering || coiled ? 0.64 : jointHeight],
      weight: (u, v) =>
        trailing(u) * (winged ? 1 - smoothRange(0.56, 0.8, v) : hovering || coiled ? 1 : arm(v)),
    },
  ]);
}

export class MonsterRig extends Container {
  private form = new Container();
  private shadow = new Graphics();
  private bar = new Graphics();
  private motionMarks = new Graphics();
  private skin?: PixelSkin;
  private flash = 0;
  private step = 0.25;
  private facing = 1;
  private pace = 0;
  private travelX = 0;
  private travelY = 0;
  private footfall = 0;
  private footfallSide = 1;
  private aim = 0;
  private action = 0;
  private defeatAge = 0;
  private defeatOriginY = 0;
  private priorBarWidth = -1;
  private readonly motion = !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  private readonly gait: EnemyGait;
  private readonly charge: boolean;
  private readonly ranged: boolean;
  private readonly artSize: number;

  constructor(
    def: MonsterDef,
    public elite = false,
    public boss = false,
    public minion = false,
  ) {
    super();
    this.gait = enemyGait(def.family);
    this.charge = def.behavior === 'charge' || (boss && def.family === 'minotaur');
    this.ranged = def.behavior === 'ranged' || def.family === 'ghost';
    this.artSize = boss ? 90 : 42 + def.radius * 1.3;
    const color = Number.parseInt(def.color.replace('#', ''), 16);
    this.shadow.ellipse(0, 5, boss ? 59 : 25, boss ? 17 : 9).fill({ color: 0x0c1418, alpha: 0.48 });
    this.shadow.ellipse(0, 5, boss ? 42 : 17, boss ? 11 : 6).fill({ color: 0x0a1318, alpha: 0.36 });
    if (elite || boss || minion)
      this.shadow.ellipse(0, 5, boss ? 56 : 26, boss ? 18 : 11).stroke({
        color: boss ? 0xcf6f57 : minion ? 0x87bcc8 : 0xcfb17d,
        width: boss ? 2 : 1.4,
        alpha: 0.86,
      });
    this.addChild(this.shadow, this.form, this.motionMarks);
    const texture = getAtlasTexture(`monster:${def.id}`);
    if (texture && this.motion && this.gait !== 'still') {
      this.skin = monsterSkin(texture, this.artSize, this.gait, def);
      this.form.addChild(this.skin);
    } else if (texture) {
      const body = new Sprite(texture);
      body.anchor.set(0.5, 0.956);
      body.width = body.height = this.artSize;
      this.form.addChild(body);
    } else {
      const body = new Graphics();
      drawPixelCreature(body, def.family.toLowerCase(), color, boss);
      this.form.addChild(body);
    }
    if (boss) this.form.scale.set(2);
    this.addChild(this.bar);
    this.motionMarks.visible = false;
    this.drawHealth(1);
  }

  hit() {
    this.flash = 0.12;
  }

  defeat(dt: number) {
    if (this.defeatAge === 0) this.defeatOriginY = this.form.y;
    this.defeatAge += dt;
    const fall = Math.min(1, this.defeatAge / 0.34);
    const size = this.boss ? 2 : 1;
    const settle = this.motion ? fall * (2 - fall) : 0;
    this.bar.visible = false;
    this.form.alpha = 1 - fall * 0.62;
    this.form.rotation = this.facing * settle * 0.48;
    this.form.y = this.defeatOriginY * (1 - settle) + settle * 7 * size;
    this.form.scale.set(this.facing * size, size * (1 - 0.45 * settle));
    this.shadow.alpha = 1 - fall;
    this.motionMarks.visible = this.motion && fall < 1;
    if (!this.motionMarks.visible) return;
    this.motionMarks.clear();
    for (const direction of [-1, 1]) {
      const distance = (5 + 18 * fall) * size;
      this.motionMarks.ellipse(direction * distance, -4 - 6 * fall, 4 + 3 * fall, 2).fill({
        color: 0xa69a89,
        alpha: (1 - fall) * 0.45,
      });
    }
  }

  drawHealth(ratio: number) {
    const w = this.boss ? 90 : 36,
      y = this.boss ? -183 : -81;
    const filled = Math.round(w * Math.max(0, Math.min(1, ratio)));
    this.bar.alpha = ratio < 1 || this.elite || this.boss ? 1 : 0;
    if (filled === this.priorBarWidth) return;
    this.priorBarWidth = filled;
    this.bar
      .clear()
      .rect(-w / 2 - 2, y - 2, w + 4, 8)
      .fill(INK)
      .rect(-w / 2, y, w, 4)
      .fill(0x3c3644)
      .rect(-w / 2, y, filled, 4)
      .fill(this.boss ? 0xe97c81 : this.elite ? 0xe9c680 : 0xc87a83);
  }

  update(time: number, dt: number, dx: number, dy: number, id: number, pose?: MonsterAttackPose) {
    this.flash = Math.max(0, this.flash - dt);
    this.footfall = Math.max(0, this.footfall - dt);
    const distance = Math.hypot(dx, dy);
    // Ignore jumps from charges and warps; their silhouettes use the attack pose.
    const travel = distance < 70 ? Math.min(distance, 230 * dt) : 0;
    const size = this.boss ? 2 : 1;
    const unit = this.artSize / 62;
    const scuttles = this.gait === 'scuttle';
    const steps = scuttles || this.gait === 'stride';
    const follow = 1 - Math.exp(-dt * 20);
    if (travel > 0.001) {
      this.travelX += (dx / distance - this.travelX) * follow;
      this.travelY += (dy / distance - this.travelY) * follow;
    }
    const travelHeading = travel > 0.001 ? dx / distance : 0;
    const heading = pose ? Math.cos(pose.angle) : travelHeading;
    // Vertical movement and near-vertical aim preserve the last readable side.
    if (Math.abs(heading) > 0.24) this.facing = Math.sign(heading);
    this.form.scale.x = size * this.facing;
    this.pace +=
      (Math.min(1, travel / Math.max(dt * (scuttles ? 60 : 42), 0.01)) - this.pace) * follow;

    let intention = 0;
    if (pose) {
      this.aim = pose.angle;
      const t = (time - pose.start) / Math.max(0.01, pose.duration);
      intention = pose.strike
        ? smoothRange(0, 0.2, t) * (1 - smoothRange(0.24, 1, t))
        : -smoothRange(0, 0.78, t);
    }
    // Preserve the loaded joints when a strike replaces its warning in a frame.
    this.action += (intention - this.action) * (1 - Math.exp(-dt * (pose?.strike ? 35 : 21)));
    const recoil = this.flash / 0.12;
    this.form.tint = this.flash > 0 ? 0xedc6b4 : 0xffffff;
    if (this.skin) {
      const wasFirstHalf = this.step < 0.5;
      const length = (scuttles ? 24 : 30) * unit * size;
      this.step = (this.step + travel / length) % 1;
      if (steps && wasFirstHalf !== this.step < 0.5) {
        this.footfall = 0.13;
        this.footfallSide = this.step < 0.5 ? 1 : -1;
      }
      const aimX = 0.4 + 0.6 * Math.abs(Math.cos(this.aim));
      const aimY = Math.sin(this.aim);
      const angle = this.action;
      const air = this.gait === 'wing' || this.gait === 'float';
      const breath = Math.sin(time * 2.7 + id * 0.49);
      const direction = this.facing * this.travelX;
      const flex = Math.sin(this.step * Math.PI * 2);
      const ready = Math.min(0, angle);
      const thrust = Math.max(0, angle);
      const reach = this.charge ? 12 : this.ranged ? 3.5 : 8;
      const coreX = (reach * thrust + 5 * ready) * aimX + direction * this.pace * 1.2;
      const coreY = (Math.abs(ready) * (scuttles ? 2 : 4) - thrust + aimY * angle * 3) * unit;
      this.skin.moveJoint(
        CORE,
        (coreX - recoil * 3.7) * unit,
        coreY - breath * 0.5,
        (angle * (this.ranged ? 0.07 : 0.14) - recoil * 0.115) * aimX,
      );
      if (steps) {
        const phase = (this.step + 0.5) % 1;
        const width = (scuttles ? 4.4 : 5.8) * unit * this.pace;
        const clearance = (scuttles ? 2.8 : 3.4) * unit * this.pace;
        const rear = stepOffset(this.step) * width;
        const front = stepOffset(phase) * width;
        this.skin.moveJoint(
          REAR_FOOT,
          direction * rear,
          this.travelY * rear * 0.65 - clearance * stepLift(this.step),
        );
        this.skin.moveJoint(
          FRONT_FOOT,
          direction * front,
          this.travelY * front * 0.65 - clearance * stepLift(phase),
        );
      }

      let leadX = angle * aimX * (this.ranged ? 5 : 9);
      let leadY = aimY * angle * 6;
      let leadAngle = angle * (this.ranged ? -0.26 : 0.27);
      let followX = -angle * 2;
      let followY = recoil * 1.5;
      let followAngle = -angle * 0.18;
      if (this.gait === 'wing') {
        const wingbeat = Math.sin(time * 9 + id) * (0.13 + this.pace * 0.055);
        leadAngle += wingbeat;
        followAngle -= wingbeat * 0.8;
        followY -= Math.abs(wingbeat) * 4;
      } else if (this.gait === 'slither' || this.gait === 'float') {
        const wave = this.gait === 'float' ? breath : flex * this.pace;
        followX += wave * 2.5;
        followAngle += wave * 0.085;
        followY -= wave * 1.5;
      } else if (scuttles) {
        leadX += direction * flex * this.pace * 2.5;
        followX -= direction * flex * this.pace * 2.2;
        leadY -= thrust * 2.5;
      } else {
        leadAngle += flex * this.pace * 0.065;
        followAngle -= flex * this.pace * 0.065;
      }
      this.skin.moveJoint(LEADING_LIMB, leadX * unit, leadY * unit, leadAngle);
      this.skin.moveJoint(TRAILING_LIMB, followX * unit, followY * unit, followAngle);
      this.skin.commitPose();
      this.form.y = air ? -(2.8 + breath * 1.65) * size : 0;
      this.shadow.alpha = 1 - Math.min(0.18, Math.abs(this.form.y) * 0.035);
    } else if (this.motion && this.gait === 'still') {
      this.form.rotation = -this.facing * recoil * 0.045;
    }

    this.motionMarks.visible = this.footfall > 0 || this.flash > 0;
    if (!this.motionMarks.visible) return;
    this.motionMarks.clear();
    if (this.footfall > 0) {
      const spread = (1 - this.footfall / 0.13) * 8 * size;
      this.motionMarks
        .ellipse(this.facing * this.footfallSide * (7 + spread), 4, 3 + spread, 1.7)
        .fill({
          color: 0xa99b84,
          alpha: this.footfall * 2,
        });
    }
    if (this.flash > 0) {
      const x = this.facing * (9 + (1 - recoil) * 12) * size;
      const y = this.gait === 'still' ? -36 : -28 * size;
      this.motionMarks
        .moveTo(x - 7, y - 6)
        .lineTo(x + 6, y + 5)
        .moveTo(x + 3, y - 8)
        .lineTo(x + 9, y - 4)
        .stroke({
          color: 0xf2d4a6,
          width: 1.8,
          alpha: recoil * 0.88,
        });
    }
  }
}
