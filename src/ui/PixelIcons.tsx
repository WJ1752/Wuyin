import type { SVGProps } from 'react';
import { PixelArt, pixelMotif, type PixelMotif } from '../data/pixelArt';

type IconProps = SVGProps<SVGSVGElement> & { size?: number | string };
function icon(art: PixelArt) {
  const layers = art.layers('currentColor');
  return function PixelIcon({ size = 24, className = '', ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        shapeRendering="crispEdges"
        aria-hidden="true"
        focusable="false"
        className={`pixel-icon ${className}`}
        {...props}
      >
        {layers.map((layer, index) => (
          <path key={index} d={layer.path} fill={layer.fill} />
        ))}
      </svg>
    );
  };
}
const motif = (name: PixelMotif) => icon(pixelMotif(name));
const arrow = (direction: 'left' | 'right' | 'up' | 'down', chevron = false) => {
  const p = new PixelArt();
  const points = chevron
    ? [14, 3, 17, 6, 11, 12, 17, 18, 14, 21, 5, 12]
    : [11, 3, 11, 8, 21, 8, 21, 16, 11, 16, 11, 21, 2, 12];
  for (let i = 0; i < points.length; i += 2) {
    const [x, y] = [points[i], points[i + 1]];
    if (direction === 'right') points[i] = 24 - x;
    if (direction === 'up') {
      points[i] = y;
      points[i + 1] = x;
    }
    if (direction === 'down') {
      points[i] = y;
      points[i + 1] = 24 - x;
    }
  }
  return icon(p.poly(points));
};
export const ArrowLeft = arrow('left');
export const ArrowRight = arrow('right');
export const ArrowUp = arrow('up');
export const ArrowDown = arrow('down');
export const ChevronLeft = arrow('left', true);
export const ChevronRight = arrow('right', true);
export const Sword = motif('sword');
export const Swords = icon(
  new PixelArt().stamp(pixelMotif('sword'), 0, 0, 24, true).stamp(pixelMotif('sword'), 0, 0, 24),
);
export const BookOpen = motif('book');
export const Shield = motif('shield');
export const Skull = motif('skull');
export const Hammer = motif('hammer');
export const Gem = motif('gem');
export const Diamond = motif('gem');
export const Wind = motif('wave');
export const Zap = motif('bolt');
export const Sparkles = motif('star');
export const Footprints = icon(
  new PixelArt().stamp(pixelMotif('boot'), 0, 5, 15).stamp(pixelMotif('boot'), 10, 0, 15),
);
export const Check = icon(new PixelArt().poly([2, 11, 6, 11, 10, 15, 18, 5, 22, 8, 11, 21]));
export const X = icon(new PixelArt().line(5, 5, 17, 17, 2, 3).line(5, 17, 17, 5, 2, 3));
export const Play = icon(new PixelArt().poly([6, 3, 21, 12, 6, 21]));
export const Pause = icon(new PixelArt().rect(4, 4, 6, 17).rect(14, 4, 6, 17));
export const Heart = icon(
  new PixelArt()
    .poly([2, 6, 5, 3, 9, 3, 12, 6, 15, 3, 19, 3, 22, 6, 22, 12, 12, 22, 2, 12])
    .rect(4, 6, 4, 2, 3),
);
export const Crown = icon(
  new PixelArt()
    .poly([2, 5, 8, 10, 12, 3, 16, 10, 22, 5, 20, 19, 4, 19])
    .rect(5, 16, 14, 2, 3)
    .rect(11, 11, 3, 3, 4),
);
export const Coins = icon(
  new PixelArt()
    .rect(4, 9, 14, 12, 4)
    .rect(2, 11, 17, 3, 2)
    .rect(2, 16, 17, 3, 2)
    .poly([11, 2, 19, 2, 22, 5, 22, 12, 19, 15, 11, 15, 8, 12, 8, 5], 2)
    .rect(11, 5, 3, 6, 3),
);
export const FlaskConical = icon(
  new PixelArt()
    .rect(9, 2, 6, 8, 3)
    .poly([9, 8, 15, 8, 22, 19, 19, 22, 5, 22, 2, 19], 2)
    .rect(6, 17, 12, 3, 3),
);
export const Hexagon = icon(
  new PixelArt()
    .poly([7, 3, 17, 3, 23, 12, 17, 21, 7, 21, 1, 12])
    .poly([7, 4, 12, 7, 12, 18, 4, 12], 3),
);
export const Compass = icon(
  new PixelArt().stamp(pixelMotif('crosshair'), 0, 0, 24).poly([15, 5, 13, 14, 6, 20, 9, 11], 3),
);
export const Moon = icon(
  new PixelArt()
    .poly([10, 2, 16, 2, 11, 6, 9, 12, 12, 17, 18, 19, 22, 16, 20, 21, 13, 23, 6, 20, 2, 13, 4, 6])
    .rect(5, 9, 2, 6, 3),
);
export const PawPrint = icon(
  new PixelArt()
    .rect(3, 5, 4, 5)
    .rect(9, 2, 4, 5)
    .rect(15, 4, 4, 5)
    .rect(19, 9, 4, 5)
    .poly([10, 10, 16, 12, 20, 19, 17, 22, 12, 20, 6, 21, 3, 18, 5, 14]),
);
export const Settings = icon(
  new PixelArt()
    .rect(9, 2, 6, 20)
    .rect(2, 9, 20, 6)
    .rect(5, 5, 14, 14)
    .rect(9, 9, 6, 6, 0)
    .rect(10, 10, 4, 4, 3),
);
export const Volume2 = icon(
  new PixelArt()
    .stamp(pixelMotif('horn'), 0, 2, 19)
    .line(18, 6, 21, 9, 2)
    .line(21, 9, 21, 15, 2)
    .line(21, 15, 18, 18, 2),
);
export const VolumeX = icon(
  new PixelArt().stamp(pixelMotif('horn'), 0, 2, 19).line(17, 8, 22, 16, 2).line(17, 16, 22, 8, 2),
);
export const Maximize = icon(
  new PixelArt()
    .rect(3, 3, 7, 3)
    .rect(3, 3, 3, 7)
    .rect(14, 3, 7, 3)
    .rect(18, 3, 3, 7)
    .rect(3, 18, 7, 3)
    .rect(3, 14, 3, 7)
    .rect(14, 18, 7, 3)
    .rect(18, 14, 3, 7),
);
export const Minimize = icon(
  new PixelArt()
    .rect(4, 8, 7, 3)
    .rect(8, 4, 3, 7)
    .rect(14, 8, 7, 3)
    .rect(14, 4, 3, 7)
    .rect(4, 14, 7, 3)
    .rect(8, 14, 3, 7)
    .rect(14, 14, 7, 3)
    .rect(14, 14, 3, 7),
);
export const Shirt = icon(
  new PixelArt()
    .poly([7, 3, 10, 6, 14, 6, 17, 3, 23, 9, 19, 14, 17, 12, 17, 22, 7, 22, 7, 12, 5, 14, 1, 9])
    .rect(8, 18, 8, 2, 3),
);
export const Hand = icon(
  new PixelArt()
    .rect(5, 10, 15, 11)
    .rect(5, 3, 3, 10)
    .rect(9, 2, 3, 11)
    .rect(13, 3, 3, 10)
    .rect(17, 6, 3, 10)
    .rect(1, 10, 4, 6)
    .rect(7, 13, 10, 2, 3),
);
export const CircleDot = icon(
  new PixelArt().stamp(pixelMotif('orb'), 0, 0, 24).rect(10, 10, 4, 4, 0),
);
export const WandSparkles = icon(
  new PixelArt().line(4, 20, 17, 7, 4, 3).stamp(pixelMotif('star'), 10, 0, 14),
);
export const Dices = icon(
  new PixelArt()
    .rect(3, 3, 18, 18)
    .rect(5, 5, 3, 3, 3)
    .rect(16, 5, 3, 3, 3)
    .rect(5, 16, 3, 3, 3)
    .rect(16, 16, 3, 3, 3)
    .rect(11, 11, 3, 3, 3),
);
export const Lock = icon(
  new PixelArt()
    .rect(7, 3, 10, 3)
    .rect(5, 6, 3, 7)
    .rect(16, 6, 3, 7)
    .rect(3, 12, 18, 10)
    .rect(11, 15, 3, 5, 0),
);
export const Package = icon(
  new PixelArt().rect(3, 5, 18, 17).rect(3, 5, 18, 3, 3).rect(10, 5, 4, 17, 4).rect(4, 17, 5, 2, 3),
);
export const Download = icon(
  new PixelArt()
    .rect(10, 2, 4, 11)
    .poly([5, 10, 19, 10, 12, 18])
    .rect(3, 19, 18, 3)
    .rect(3, 15, 3, 4)
    .rect(18, 15, 3, 4),
);
export const Upload = icon(
  new PixelArt()
    .rect(10, 8, 4, 10)
    .poly([5, 10, 19, 10, 12, 2])
    .rect(3, 19, 18, 3)
    .rect(3, 15, 3, 4)
    .rect(18, 15, 3, 4),
);
export const RotateCcw = icon(
  new PixelArt()
    .line(4, 8, 10, 3, 2, 2)
    .line(10, 3, 18, 5, 2, 2)
    .line(18, 5, 21, 13, 2, 2)
    .line(21, 13, 17, 20, 2, 2)
    .line(17, 20, 7, 20, 2, 2)
    .poly([2, 3, 2, 12, 11, 12]),
);
