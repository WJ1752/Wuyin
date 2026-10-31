import { Container, Graphics, ColorMatrixFilter } from 'pixi.js';
import type { MonsterDef } from '../core/types';
export class MonsterRig extends Container {
  private form = new Container();
  private legs: Graphics[] = [];
  private bar = new Graphics();
  private flash = 0;
  private hitFilter = new ColorMatrixFilter();
  constructor(
    def: MonsterDef,
    public elite = false,
    public boss = false,
    public minion = false,
  ) {
    super();
    const color = Number.parseInt(def.color.replace('#', ''), 16);
    const seed = [...def.id].reduce((n, c) => n + c.charCodeAt(0), 0);
    const family = def.family.toLowerCase();
    this.addChild(
      new Graphics()
        .ellipse(0, 7, boss ? 35 : 19, boss ? 12 : 7)
        .fill({ color: 0x000000, alpha: 0.4 }),
    );
    this.hitFilter.matrix = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0];
    if (elite || boss || minion)
      this.addChild(
        new Graphics().ellipse(0, 6, boss ? 37 : 25, boss ? 13 : 9).stroke({
          color: boss ? 0xcf546b : minion ? 0x81a8d5 : 0xc5a464,
          alpha: 0.7,
          width: 1.5,
        }),
      );
    this.addChild(this.form);
    const beast = /beast|wolf|hound|虫|蛛|兽|insect|spider/.test(family);
    for (let i = 0; i < (beast ? 4 : 2); i++) {
      const leg = new Graphics();
      leg.position.set((i % 2 === 0 ? -1 : 1) * (beast ? 12 : 6), beast ? -12 : -5);
      leg
        .moveTo(0, 0)
        .lineTo(i % 2 === 0 ? -7 : 7, 9)
        .lineTo(i % 2 === 0 ? -9 : 9, 17)
        .stroke({ color: 0x6c7271, width: beast ? 3 : 5 });
      leg
        .moveTo(i % 2 === 0 ? -9 : 9, 17)
        .lineTo(i % 2 === 0 ? -13 : 13, 18)
        .stroke({ color: 0xb3b1a2, width: 2 });
      this.form.addChild(leg);
      this.legs.push(leg);
    }
    const g = new Graphics();
    if (beast) {
      g.poly([-16, -20, -8, -30, 10, -27, 19, -12, 13, 0, -8, 0, -18, -9])
        .fill(color)
        .stroke({ color: 0x94a39b, width: 1 });
      for (let i = 0; i < 4; i++)
        g.moveTo(-11 + i * 7, -21)
          .lineTo(-9 + i * 6, -6)
          .stroke({ color: 0x18272a, width: 2 });
      g.poly([-12, -21, -18, -36, -4, -28, 6, -31, 18, -37, 15, -19]).fill(0x3d4d4d);
      g.poly([-7, -18, 7, -18, 3, -10, -4, -10]).fill(0x111d21);
      g.moveTo(-7, -23)
        .lineTo(-3, -22)
        .moveTo(4, -23)
        .lineTo(9, -24)
        .stroke({ color: 0xefb985, width: 2 });
    } else {
      g.poly([-11, -28, 0, -34, 12, -26, 9, -6, -7, -5])
        .fill(color)
        .stroke({ color: 0x88968f, width: 1 });
      for (let i = 0; i < 3; i++)
        g.moveTo(-7, -22 + i * 5)
          .lineTo(7, -20 + i * 5)
          .stroke({ color: 0x132021, width: 2 });
      g.moveTo(-12, -25)
        .lineTo(-20, -8)
        .lineTo(-16, -2)
        .moveTo(12, -25)
        .lineTo(20, -12)
        .lineTo(21, -2)
        .stroke({ color: 0x8b9385, width: 4 });
      g.poly([-9, -43, -4, -49, 6, -47, 10, -37, 5, -29, -6, -30])
        .fill(seed % 3 === 0 ? 0xc3c4a8 : 0x71827b)
        .stroke({ color: 0xb2b79e, width: 1 });
      g.rect(-6, -40, 4, 4).fill(0xe98670).rect(3, -40, 4, 4).fill(0xe98670);
      g.moveTo(-4, -32).lineTo(4, -32).stroke({ color: 0x172b2a, width: 2 });
      if (seed % 3 === 0) {
        g.moveTo(20, 4).lineTo(23, -34).stroke({ color: 0x7b6653, width: 3 });
        g.poly([20, -32, 20, -47, 28, -35, 25, -27]).fill(0xadb8b4);
      } else if (seed % 3 === 1) {
        g.poly([-24, -17, -13, -17, -10, -1, -19, 6, -27, -1])
          .fill(0x485654)
          .stroke({ color: 0xb8aa74, width: 1 });
        g.poly([18, -7, 25, -33, 29, -36, 25, -6]).fill(0xa5b6b1);
      } else {
        g.moveTo(20, 1).lineTo(21, -45).stroke({ color: 0x635b4c, width: 3 });
        g.poly([21, -53, 28, -44, 21, -37, 15, -44])
          .fill(color)
          .stroke({ color: 0xe0c799, width: 1 });
      }
    }
    // Family-specific anatomy is layered over the articulated common skeleton.
    if (['bat', 'drake', 'imp'].includes(family))
      for (const side of [-1, 1])
        g.poly([
          side * 9,
          -28,
          side * 31,
          -53,
          side * 49,
          -26,
          side * 33,
          -31,
          side * 24,
          -12,
          side * 17,
          -22,
          side * 9,
          -9,
        ])
          .fill({ color, alpha: 0.9 })
          .stroke({ color: 0x9daca1, width: 1 });
    if (['wolf', 'rat', 'drake'].includes(family)) {
      g.moveTo(11, -4)
        .bezierCurveTo(35, -4, 30, -27, 39, -31)
        .stroke({ color, width: family === 'rat' ? 3 : 7 });
      g.poly([-8, -20, 0, -30, 12, -20, 0, -11]).fill(0xa3aa95);
    }
    if (family === 'minotaur')
      for (const side of [-1, 1])
        g.poly([
          side * 6,
          -46,
          side * 17,
          -48,
          side * 22,
          -64,
          side * 26,
          -54,
          side * 20,
          -40,
          side * 8,
          -38,
        ])
          .fill(0xd7c89d)
          .stroke({ color: 0x635d4c, width: 1 });
    if (family === 'archer') {
      g.moveTo(21, -43).bezierCurveTo(47, -30, 47, -9, 21, 5).stroke({ color: 0xc4ad7d, width: 2 });
      g.moveTo(21, -43).lineTo(23, -17).lineTo(21, 5).stroke({ color: 0xc7cfbb, width: 1 });
    }
    if (family === 'zombie') {
      g.poly([-14, -21, -23, -27, -29, -18, -25, -5, -18, -8, -8, -13]).fill(0x7a8260);
      g.ellipse(3, -14, 6, 8).fill(0x545e4a).stroke({ color: 0x9a6c61, width: 1 });
    }
    if (family === 'insect') {
      g.ellipse(0, -10, 19, 15)
        .fill({ color: 0xabc25a, alpha: 0.8 })
        .stroke({ color: 0xe1ce7f, width: 1 });
      g.ellipse(-5, -13, 5, 7).fill({ color: 0xe0e8a0, alpha: 0.5 });
    }
    if (family === 'spider')
      for (const side of [-1, 1])
        for (let i = 0; i < 4; i++)
          g.moveTo(side * 10, -10 - i * 3)
            .lineTo(side * (25 + i * 3), -32 + i * 11)
            .lineTo(side * (36 + i * 2), -22 + i * 12)
            .stroke({ color: 0xa19e8b, width: 2 });
    if (['ghost', 'revenant'].includes(family)) {
      g.poly([-13, -40, -22, -4, -11, 7, -7, 0, 0, 12, 7, 0, 14, 6, 22, -6, 13, -40])
        .fill({ color, alpha: 0.45 })
        .stroke({ color: 0xb7cfdd, alpha: 0.4, width: 1 });
      this.form.alpha = 0.72;
    }
    if (family === 'cultist') {
      g.poly([-12, -37, 0, -65, 12, -37, 0, -31])
        .fill(0x4e3c57)
        .stroke({ color: 0xab8da3, width: 1 });
      g.poly([-9, -23, -19, 11, 0, 5, 18, 11, 9, -23]).fill(0x443347);
    }
    if (family === 'ent') {
      for (const side of [-1, 1])
        g.moveTo(side * 8, -35)
          .lineTo(side * 20, -51)
          .lineTo(side * 32, -56)
          .moveTo(side * 20, -51)
          .lineTo(side * 18, -68)
          .stroke({ color: 0x8d9a72, width: 4 });
      g.moveTo(-5, -27)
        .lineTo(-8, 0)
        .moveTo(4, -28)
        .lineTo(6, 0)
        .stroke({ color: 0xa4a575, width: 3 });
    }
    if (family === 'golem') {
      g.poly([-20, -34, -32, -28, -29, -10, -15, -13])
        .fill(color)
        .stroke({ color: 0xc0926d, width: 2 });
      g.poly([18, -35, 32, -31, 29, -11, 14, -15])
        .fill(color)
        .stroke({ color: 0xc0926d, width: 2 });
      g.moveTo(0, -30)
        .lineTo(-3, -18)
        .lineTo(4, -12)
        .lineTo(0, -4)
        .stroke({ color: 0xf2ad68, width: 3 });
    }
    if (family === 'shaman') {
      g.poly([-13, -44, -18, -60, -5, -52, 1, -67, 6, -51, 20, -60, 13, -43])
        .fill(0x8bbfc8)
        .stroke({ color: 0xc9e2d6, width: 1 });
    }
    if (family === 'assassin') {
      g.poly([-12, -39, 0, -57, 12, -39, 0, -32]).fill(0x303445).stroke({ color, width: 1 });
      g.poly([-17, -5, -25, -31, -29, -36, -24, -3]).fill(0xd4c8df);
    }
    if (family === 'knight') {
      g.poly([-15, -30, -23, -40, -29, -25, -13, -15])
        .fill(0x677784)
        .stroke({ color: 0xc8bf8c, width: 1 });
      g.poly([15, -30, 23, -40, 29, -25, 13, -15])
        .fill(0x677784)
        .stroke({ color: 0xc8bf8c, width: 1 });
      g.poly([-10, -42, 0, -56, 10, -42, 5, -30, -5, -30])
        .fill(0x899598)
        .stroke({ color: 0xb6b6a3, width: 1 });
      g.rect(-8, -40, 16, 3).fill(0x283940);
    }
    if (family === 'scorpion') {
      g.moveTo(0, -20).bezierCurveTo(-21, -45, -8, -74, 12, -57).stroke({ color, width: 7 });
      g.poly([8, -60, 17, -56, 16, -48, 10, -52]).fill(0xdac794);
      for (const side of [-1, 1])
        g.poly([
          side * 10,
          -7,
          side * 30,
          -15,
          side * 34,
          -31,
          side * 25,
          -26,
          side * 27,
          -20,
          side * 13,
          -15,
        ])
          .fill(color)
          .stroke({ color: 0xb9b68e, width: 1 });
    }
    if (['worm', 'serpent'].includes(family)) {
      g.moveTo(-5, -12).bezierCurveTo(-36, 1, 28, 25, 36, 2).stroke({ color, width: 12 });
      for (let i = 0; i < 5; i++)
        g.moveTo(-7 + i * 8, 9)
          .lineTo(-5 + i * 8, 16)
          .stroke({ color: 0xe3c79b, alpha: 0.55, width: 1 });
      g.poly([-10, -40, 0, -49, 11, -40, 5, -30, -5, -30]).fill(color);
      g.moveTo(0, -30)
        .lineTo(0, -19)
        .lineTo(-5, -15)
        .moveTo(0, -19)
        .lineTo(4, -15)
        .stroke({ color: 0xe28e8a, width: 1 });
    }
    if (family === 'eye') {
      g.ellipse(0, -27, 25, 19).fill(0x9faaaa).stroke({ color: 0xc4cebc, width: 2 });
      g.ellipse(0, -27, 12, 14)
        .fill(color)
        .ellipse(0, -27, 4, 11)
        .fill(0x17292b)
        .ellipse(-5, -33, 3, 4)
        .fill(0xe8e5b5);
      for (let i = -2; i <= 2; i++)
        g.moveTo(i * 8, -10)
          .bezierCurveTo(i * 15, 0, i * 4, 10, i * 11, 15)
          .stroke({ color, width: 2 });
    }
    if (family === 'jailer') {
      g.moveTo(-19, -1)
        .lineTo(-29, 8)
        .lineTo(-34, 1)
        .lineTo(-43, 8)
        .stroke({ color: 0xa3aaa4, width: 2 });
      g.poly([-48, 1, -39, 5, -39, 15, -48, 20, -56, 13, -55, 5])
        .fill(0x596569)
        .stroke({ color: 0xb8bbae, width: 2 });
    }
    if (family === 'dummy') {
      this.legs.forEach((leg) => (leg.visible = false));
      g.clear()
        .poly([-10, 10, -5, -55, 6, -55, 10, 10])
        .fill(0x76634a)
        .stroke({ color: 0xb8a17b, width: 1 });
      g.moveTo(-4, -48)
        .lineTo(-1, 4)
        .moveTo(3, -50)
        .lineTo(5, 6)
        .stroke({ color: 0x443c32, width: 1.5 });
      g.moveTo(-28, -26).lineTo(28, -26).stroke({ color: 0x847253, width: 7 });
      g.ellipse(0, -33, 21, 24)
        .fill(0xb1a078)
        .stroke({ color: 0x5d594e, width: 3 })
        .ellipse(0, -33, 14, 17)
        .stroke({ color: 0x69594e, width: 2 })
        .ellipse(0, -33, 6, 8)
        .fill(0x6c4c48);
      g.poly([-4, -45, 4, -45, 4, -21, -4, -21]).stroke({ color: 0xd6c398, alpha: 0.5, width: 1 });
      g.moveTo(-18, 11).lineTo(18, 11).stroke({ color: 0x787565, width: 5 });
    }
    if (boss) {
      g.poly([-9, -44, -25, -63, -22, -73, -13, -53, -5, -49])
        .fill(0xc7b887)
        .poly([8, -44, 25, -63, 23, -73, 13, -53, 5, -49])
        .fill(0xc7b887);
      g.poly([-17, -25, -31, -37, -27, -13, -15, -8])
        .fill(color)
        .stroke({ color: 0xc7a06b, width: 1 });
      g.poly([17, -25, 31, -37, 27, -13, 15, -8]).fill(color).stroke({ color: 0xc7a06b, width: 1 });
      this.form.scale.set(3.5);
    }
    this.form.addChild(g);
    this.addChild(this.bar);
    this.drawHealth(1);
  }
  hit() {
    this.flash = 0.07;
  }
  drawHealth(ratio: number) {
    const w = this.boss ? 86 : 34,
      y = this.boss ? -275 : -57;
    this.bar
      .clear()
      .roundRect(-w / 2, y, w, 4, 2)
      .fill(0x171b23)
      .roundRect(-w / 2, y, Math.max(0, w * ratio), 4, 2)
      .fill(this.boss ? 0xe36a78 : this.elite ? 0xd8b774 : 0xa65663);
    this.bar.alpha = ratio < 1 || this.elite || this.boss ? 1 : 0;
  }
  update(time: number, dt: number, moving: boolean) {
    this.flash = Math.max(0, this.flash - dt);
    this.form.filters = this.flash > 0 ? [this.hitFilter] : [];
    this.form.y = moving ? Math.sin(time * 8) * 2 : 0;
    this.legs.forEach(
      (leg, i) => (leg.rotation = moving ? Math.sin(time * 8 + i * Math.PI) * 0.23 : 0),
    );
  }
}
