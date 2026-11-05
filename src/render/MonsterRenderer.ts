import { Container, Graphics, ColorMatrixFilter, Sprite } from 'pixi.js';
import { getAtlasTexture } from './TextureAtlas';
import type { MonsterAttackPose } from '../core/coop';
import type { MonsterDef } from '../core/types';
import { pixelEllipse, pixelLine, pixelPolygon, pixelStamp } from './PixelArt';

const INK = 0x14202a;
const BONE = 0xe1d3ad;
const LIGHT = 0xf8ebc5;

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

export class MonsterRig extends Container {
  private form = new Container();
  private bar = new Graphics();
  private flash = 0;
  private stride = 0;
  private facing = -1;
  private pace = 0;
  private readonly motion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ? 0.25
    : 1;
  private readonly gait: 'hover' | 'slither' | 'walk' | 'still';
  private hitFilter = new ColorMatrixFilter();
  constructor(
    def: MonsterDef,
    public elite = false,
    public boss = false,
    public minion = false,
  ) {
    super();
    if (['ghost', 'eye', 'bat', 'drake', 'imp'].includes(def.family)) this.gait = 'hover';
    else if (['serpent', 'worm'].includes(def.family)) this.gait = 'slither';
    else this.gait = def.family === 'dummy' ? 'still' : 'walk';
    const color = Number.parseInt(def.color.replace('#', ''), 16);
    const shadow = new Graphics();
    pixelEllipse(shadow, 0, 8, boss ? 54 : 23, boss ? 18 : 9, 0x09151f, 3, 0.6);
    if (elite || boss || minion)
      pixelEllipse(
        shadow,
        0,
        8,
        boss ? 60 : 27,
        boss ? 21 : 12,
        boss ? 0xdf7680 : minion ? 0x8fc8d8 : 0xdfbd77,
        3,
        0.85,
        true,
      );
    this.addChild(shadow, this.form);
    this.hitFilter.matrix = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0];
    const texture = getAtlasTexture(`monster:${def.id}`);
    if (texture) {
      const body = new Sprite(texture);
      body.anchor.set(0.5, 251 / 256);
      body.width = body.height = boss ? 90 : 42 + def.radius * 1.3;
      body.y = 8;
      this.form.addChild(body);
    } else {
      const body = new Graphics();
      drawPixelCreature(body, def.family.toLowerCase(), color, boss);
      this.form.addChild(body);
    }
    if (boss) this.form.scale.set(2);
    this.addChild(this.bar);
    this.drawHealth(1);
  }
  hit() {
    if (this.flash <= 0) this.form.filters = [this.hitFilter];
    this.flash = 0.12;
  }
  drawHealth(ratio: number) {
    const w = this.boss ? 90 : 36,
      y = this.boss ? -183 : -81;
    this.bar
      .clear()
      .rect(-w / 2 - 2, y - 2, w + 4, 8)
      .fill(INK)
      .rect(-w / 2, y, w, 4)
      .fill(0x3c3644)
      .rect(-w / 2, y, Math.round(w * Math.max(0, Math.min(1, ratio))), 4)
      .fill(this.boss ? 0xe97c81 : this.elite ? 0xe9c680 : 0xc87a83);
    this.bar.alpha = ratio < 1 || this.elite || this.boss ? 1 : 0;
  }
  update(time: number, dt: number, dx: number, dy: number, id: number, pose?: MonsterAttackPose) {
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt);
      if (this.flash === 0) this.form.filters = null;
    }
    if (this.gait === 'still') return;
    const heading = pose ? Math.cos(pose.angle) : dx / Math.max(0.001, Math.hypot(dx, dy));
    if (Math.abs(heading) > 0.18) this.facing = Math.sign(heading);
    // Cap displacement so a teleport cannot skip through multiple steps in one frame.
    const distance = Math.min(Math.hypot(dx, dy), 180 * dt);
    this.stride += distance / (this.boss ? 12 : 7);
    const activity = Math.min(1, distance / Math.max(45 * dt, 0.001));
    this.pace += (activity - this.pace) * (1 - Math.exp(-dt * 14));

    const breath = Math.sin(time * 2.6 + id) * this.motion;
    const sway = Math.sin(this.stride + id) * this.pace * this.motion;
    let lift = Math.abs(sway) * 2.8;
    let drift = sway * 0.8;
    if (this.gait === 'hover') {
      lift = (3 + Math.sin(time * 3.8 + id) * 2.5) * this.motion;
      drift += breath * 0.9;
    } else if (this.gait === 'slither') {
      lift *= 0.18;
      drift = sway * 2.8;
    }
    let reachX = 0;
    let reachY = 0;
    let crouch = 0;
    if (pose) {
      const t = Math.min(1, Math.max(0, (time - pose.start) / Math.max(0.01, pose.duration)));
      const windup = t * t * (3 - 2 * t);
      // Release from the held pose, extend quickly, then settle back on the feet.
      const reach = pose.strike
        ? 8 * Math.sin(Math.PI * t) * (1 - t) - 3 * Math.exp(-15 * t)
        : -3 * windup;
      reachX = Math.cos(pose.angle) * reach * this.motion;
      reachY = Math.sin(pose.angle) * reach * this.motion;
      crouch = (pose.strike ? Math.exp(-15 * t) : windup) * 0.055 * this.motion;
    }
    const size = this.boss ? 2 : 1;
    this.form.position.set((drift + reachX) * size, (reachY - lift) * size);
    this.form.rotation = sway * 0.034 + reachX * 0.012;
    this.form.scale.set(
      -this.facing * size * (1 - breath * 0.006 + crouch),
      size * (1 + breath * 0.014 - crouch),
    );
  }
}
