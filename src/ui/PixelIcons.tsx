import type { CSSProperties, HTMLAttributes, ReactElement, SVGProps } from 'react';

type PixelIconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  title?: string;
};

type IconComponent = (props: PixelIconProps) => ReactElement;

const atlas: Record<string, [number, number]> = {
  Swords: [0, 0],
  Shield: [1, 0],
  BookOpen: [2, 0],
  Compass: [3, 0],
  Hammer: [0, 1],
  Hexagon: [1, 1],
  Diamond: [2, 1],
  PawPrint: [3, 1],
  Package: [0, 2],
  Crown: [1, 2],
  Settings: [2, 2],
  User: [3, 2],
  Coins: [0, 3],
  Campfire: [1, 3],
  FlaskConical: [2, 3],
  Scroll: [3, 3],
};

const shapes: Record<string, string> = {
  ArrowLeft: 'M2 10H6V6H10V2H14V10H22V14H14V22H10V18H6V14H2Z',
  ArrowRight: 'M22 10H18V6H14V2H10V10H2V14H10V22H14V18H18V14H22Z',
  ArrowUp: 'M10 2H14V6H18V10H22V14H14V22H10V14H2V10H6V6H10Z',
  ArrowDown: 'M10 22H14V18H18V14H22V10H14V2H10V10H2V14H6V18H10Z',
  ChevronLeft: 'M14 2H18V6H14V10H10V14H14V18H18V22H14V18H10V14H6V10H10V6H14Z',
  ChevronRight: 'M10 2H14V6H18V10H22V14H18V18H14V22H10V18H14V14H18V10H14V6H10Z',
  Sword: 'M18 2H22V8H18V12H14V16H12V18H10V20H8V22H2V16H4V14H6V12H8V10H10V8H14V4H18Z M5 17V19H7V17Z',
  Skull:
    'M6 2H18V4H22V14H18V18H14V22H10V18H6V14H2V4H6Z M6 8V12H10V8Z M14 8V12H18V8Z M10 14V16H14V14Z',
  Gem: 'M6 2H18V4H22V10H20V12H18V14H16V16H14V18H12V22H10V18H8V16H6V14H4V12H2V10H0V4H4V2Z M5 6V8H19V6Z',
  Wind: 'M2 5H18V3H22V9H18V7H2Z M2 11H14V9H18V15H14V13H2Z M2 17H18V15H22V21H18V19H2Z',
  Zap: 'M14 2H20V4H16V8H14V10H20V12H18V14H16V16H14V18H12V20H10V22H4V20H8V16H10V14H12V12H6V10H8V8H10V6H12V4H14Z',
  Sparkles:
    'M10 2H14V8H18V12H14V18H10V12H6V8H10Z M20 14H22V18H20V20H18V18H16V14H18V12H20Z M4 2H6V4H8V6H6V8H4V6H2V4H4Z',
  Footprints:
    'M5 2H9V4H11V8H9V12H5V10H3V6H4V4H5Z M15 10H19V12H21V16H19V20H15V18H13V14H14V12H15Z M2 15H6V17H8V21H6V22H2V20H1V17H2Z',
  Check:
    'M8 2H12V6H10V10H8V14H12V12H14V10H16V8H18V6H22V10H20V12H18V14H16V16H14V18H12V20H10V22H6V18H4V16H2V12H6V14H8Z',
  X: 'M4 2H8V4H10V6H14V4H16V2H20V6H18V8H16V10H14V14H16V16H18V18H20V22H16V20H14V18H10V20H8V22H4V18H6V16H8V14H10V10H8V8H6V6H4Z',
  Play: 'M4 2H8V4H12V6H16V8H20V10H22V14H20V16H16V18H12V20H8V22H4Z',
  Pause: 'M4 2H10V22H4Z M14 2H20V22H14Z',
  Heart:
    'M6 2H10V4H14V2H18V4H22V12H20V16H18V18H16V20H14V22H10V20H8V18H6V16H4V12H2V4H6Z M6 6V10H8V12H10V14H14V12H16V10H18V6H16V8H14V6H10V8H8V6Z',
  Moon: 'M10 2H16V4H12V8H14V12H18V14H22V18H20V20H16V22H8V20H4V18H2V10H4V6H8V4H10Z',
  Volume2:
    'M2 8H6V6H10V4H14V20H10V18H6V16H2Z M17 8H19V10H21V14H19V16H17Z M19 4H21V6H23V18H21V20H19V18H21V6H19Z',
  VolumeX:
    'M2 8H6V6H10V4H14V20H10V18H6V16H2Z M17 8H19V10H21V12H19V14H17V12H15V10H17Z M19 14H21V16H19V18H17V16H15V14H17V16H19Z',
  Maximize: 'M2 2H10V6H6V10H2Z M14 2H22V10H18V6H14Z M2 14H6V18H10V22H2Z M18 14H22V22H14V18H18Z',
  Minimize: 'M2 2H10V6H6V10H2Z M14 2H22V10H18V6H14Z M2 14H6V18H10V22H2Z M18 14H22V22H14V18H18Z',
  Shirt: 'M7 2H17V4H21V6H23V12H18V10H17V22H7V10H6V12H1V6H3V4H7Z',
  Hand: 'M3 10H5V4H8V2H11V10H13V6H16V10H18V8H21V10H23V18H21V20H19V22H8V20H6V18H4V16H2V12H3Z',
  CircleDot:
    'M8 2H16V4H20V8H22V16H20V20H16V22H8V20H4V16H2V8H4V4H8Z M9 6V8H7V16H9V18H15V16H17V8H15V6Z M10 10H14V14H10Z',
  WandSparkles:
    'M3 17H5V15H7V13H9V11H11V9H13V7H15V5H17V3H21V7H19V9H17V11H15V13H13V15H11V17H9V19H7V21H3Z M4 2H6V4H8V6H6V8H4V6H2V4H4Z M19 14H21V16H23V18H21V20H19V18H17V16H19Z',
  Dices:
    'M2 2H12V12H2Z M4 4V6H6V4Z M8 8V10H10V8Z M14 14H22V22H14Z M16 16V18H18V16Z M20 20V22H22V20Z',
  Lock: 'M6 2H18V4H20V10H22V22H2V10H4V4H6Z M8 4V10H16V4Z M10 14H14V18H10Z',
  Download: 'M9 2H15V12H19V14H17V16H15V18H9V16H7V14H5V12H9Z M2 18H6V20H18V18H22V22H2Z',
  Upload: 'M9 2H15V4H17V6H19V8H21V12H15V18H9V12H3V8H5V6H7V4H9Z M2 18H6V20H18V18H22V22H2Z',
  RotateCcw:
    'M8 2H16V4H20V8H22V16H20V20H16V22H8V20H4V18H2V14H6V16H8V18H16V16H18V8H16V6H8V8H6V10H2V6H4V4H8Z M8 8H12V14H8Z',
};

function makeIcon(name: string): IconComponent {
  return function PixelIcon({ size = 24, className = '', style, title, ...props }) {
    const shared = {
      ...(props as unknown as HTMLAttributes<HTMLSpanElement>),
      className: `pixel-ui-icon${className ? ` ${className}` : ''}`,
      style: { width: size, height: size, flexShrink: 0, ...style } as CSSProperties,
      'aria-hidden': title ? undefined : (props['aria-hidden'] ?? true),
      'aria-label': title ? (props['aria-label'] ?? title) : props['aria-label'],
      role: title ? 'img' : props.role,
      title,
    };
    const tile = atlas[name];
    return tile ? (
      <span
        {...shared}
        className={`${shared.className} pixel-ui-icon-atlas`}
        style={{
          ...shared.style,
          display: 'inline-block',
          backgroundImage: 'url(/assets/ui/pixel-nav.webp)',
          backgroundSize: '400% 400%',
          imageRendering: 'pixelated',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: `${(tile[0] / 3) * 100}% ${(tile[1] / 3) * 100}%`,
        }}
      />
    ) : (
      <svg
        {...(shared as unknown as SVGProps<SVGSVGElement>)}
        viewBox="0 0 24 24"
        shapeRendering="crispEdges"
        fill="currentColor"
      >
        <path d={shapes[name] ?? shapes.Sparkles} />
      </svg>
    );
  };
}

export const ArrowLeft = makeIcon('ArrowLeft');
export const ArrowRight = makeIcon('ArrowRight');
export const ArrowUp = makeIcon('ArrowUp');
export const ArrowDown = makeIcon('ArrowDown');
export const ChevronLeft = makeIcon('ChevronLeft');
export const ChevronRight = makeIcon('ChevronRight');
export const Sword = makeIcon('Sword');
export const Swords = makeIcon('Swords');
export const BookOpen = makeIcon('BookOpen');
export const Shield = makeIcon('Shield');
export const Skull = makeIcon('Skull');
export const Hammer = makeIcon('Hammer');
export const Gem = makeIcon('Diamond');
export const Diamond = makeIcon('Diamond');
export const Wind = makeIcon('Wind');
export const Zap = makeIcon('Zap');
export const Sparkles = makeIcon('Sparkles');
export const Footprints = makeIcon('PawPrint');
export const PawPrint = makeIcon('PawPrint');
export const Check = makeIcon('Check');
export const X = makeIcon('X');
export const Play = makeIcon('Play');
export const Pause = makeIcon('Pause');
export const Heart = makeIcon('Heart');
export const Crown = makeIcon('Crown');
export const Coins = makeIcon('Coins');
export const FlaskConical = makeIcon('FlaskConical');
export const Hexagon = makeIcon('Hexagon');
export const Compass = makeIcon('Compass');
export const Moon = makeIcon('Moon');
export const Settings = makeIcon('Settings');
export const Volume2 = makeIcon('Volume2');
export const VolumeX = makeIcon('VolumeX');
export const Maximize = makeIcon('Maximize');
export const Minimize = makeIcon('Minimize');
export const Shirt = makeIcon('Shirt');
export const Hand = makeIcon('Hand');
export const CircleDot = makeIcon('CircleDot');
export const WandSparkles = makeIcon('WandSparkles');
export const Dices = makeIcon('Dices');
export const Lock = makeIcon('Lock');
export const Package = makeIcon('Package');
export const Download = makeIcon('Download');
export const Upload = makeIcon('Upload');
export const RotateCcw = makeIcon('RotateCcw');
export const User = makeIcon('User');
export const Campfire = makeIcon('Campfire');
export const Scroll = makeIcon('Scroll');
