import { Container, Graphics } from 'pixi.js';
export function createMap(theme: number, size = 1800): Container {
  const root = new Container();
  const palettes = [
    [0x172a2c, 0x233b3a, 0x42645a],
    [0x22292e, 0x30383c, 0x676c63],
    [0x301f25, 0x422b2b, 0xb96942],
    [0x211e32, 0x302b42, 0x73639d],
  ];
  const p = palettes[theme % 4];
  const ground = new Graphics().rect(-size / 2, -size / 2, size, size).fill(p[0]);
  root.addChild(ground);
  let seed = 77 + theme * 973;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let y = -size / 2; y < size / 2; y += 62)
    for (let x = -size / 2; x < size / 2; x += 86) {
      const stagger = (Math.floor(y / 62) % 2) * 43;
      ground
        .poly([
          x + stagger + 2,
          y + 2,
          x + stagger + 83,
          y + 2,
          x + stagger + 81,
          y + 58,
          x + stagger + 3,
          y + 59,
        ])
        .fill({ color: rand() > 0.6 ? p[1] : p[0], alpha: 0.7 })
        .stroke({ color: 0x111c20, alpha: 0.8, width: 1 });
      if (rand() > 0.7)
        ground
          .moveTo(x + stagger + 20, y + 10)
          .lineTo(x + stagger + 34, y + 27)
          .lineTo(x + stagger + 32, y + 53)
          .stroke({ color: p[2], alpha: 0.15, width: 1 });
    }
  // An ancient circular seal anchors the otherwise continuous ruin floor.
  ground
    .ellipse(0, 0, 225, 166)
    .stroke({ color: p[2], alpha: 0.4, width: 3 })
    .ellipse(0, 0, 211, 154)
    .stroke({ color: p[2], alpha: 0.25, width: 1 });
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const x = Math.cos(a) * 218,
      y = Math.sin(a) * 160;
    ground
      .moveTo(x - 4, y - 5)
      .lineTo(x + 4, y + 5)
      .moveTo(x + 4, y - 5)
      .lineTo(x - 4, y + 5)
      .stroke({ color: 0xa0a28a, alpha: 0.4, width: 1.5 });
  }
  for (let i = 0; i < 95; i++) {
    const x = (rand() - 0.5) * size,
      y = (rand() - 0.5) * size;
    if (Math.hypot(x, y) < 190) continue;
    const g = new Graphics();
    g.position.set(x, y);
    const h = 18 + rand() * 42;
    if (theme === 0) {
      g.ellipse(0, 4, 27, 8).fill({ color: 0x071719, alpha: 0.45 });
      g.poly([-5, 0, -4, -h, 2, -h - 17, 7, -h, 5, 0]).fill(0x303d38);
      g.moveTo(-2, -h * 0.5)
        .lineTo(-22, -h * 0.9)
        .lineTo(-27, -h * 1.2)
        .moveTo(3, -h * 0.7)
        .lineTo(22, -h)
        .lineTo(28, -h * 1.3)
        .stroke({ color: 0x394b40, width: 4 });
      for (let j = 0; j < 5; j++)
        g.poly([
          -26 + j * 12,
          -h + rand() * 20,
          -14 + j * 11,
          -h - 22 - rand() * 22,
          -3 + j * 10,
          -h + 4,
        ]).fill({ color: 0x31564a, alpha: 0.7 });
    } else if (theme === 1) {
      g.poly([-11, 0, -10, -h, -5, -h - 6, 7, -h - 6, 12, -h, 11, 0])
        .fill(0x47504f)
        .stroke({ color: 0x71766a, alpha: 0.6, width: 1 });
      g.moveTo(0, -h + 4)
        .lineTo(0, -10)
        .moveTo(-6, -h + 13)
        .lineTo(6, -h + 13)
        .stroke({ color: 0x1e2c2d, width: 3 });
      g.ellipse(0, 4, 18, 5).fill({ color: 0x151f23, alpha: 0.6 });
    } else if (theme === 2) {
      g.poly([-17, 6, -21, -12, -7, -h, 10, -h * 0.7, 20, -11, 11, 4])
        .fill(0x4e3434)
        .stroke({ color: 0x68433a, width: 1 });
      g.moveTo(-4, -h + 7)
        .lineTo(1, -20)
        .lineTo(-6, -3)
        .stroke({ color: 0xea8b45, alpha: 0.8, width: 2 });
    } else {
      g.poly([-11, 0, -15, -h * 0.6, 0, -h - 10, 13, -h * 0.6, 9, 0])
        .fill({ color: 0x685c83, alpha: 0.65 })
        .stroke({ color: 0xa493c1, alpha: 0.7, width: 1 });
      g.poly([0, -h - 10, 0, -3, 9, 0, 13, -h * 0.6]).fill({ color: 0xb19fd1, alpha: 0.22 });
    }
    root.addChild(g);
  }
  return root;
}
