import { useId } from 'react';
import type { CSSProperties } from 'react';
import { HALL_LAYOUT } from '../data/npcHall';
import './hall-effects.css';

export const CAMP_ART = 'assets/maps/watchers-camp-v3.png';

// Pixel coordinates follow the authored map, so effects move with its shared camera.
const LANTERNS = [
  [137, 129],
  [508, 64],
  [1044, 62],
  [1147, 111],
  [110, 286],
  [191, 318],
  [364, 315],
  [529, 298],
  [771, 298],
  [949, 316],
  [1125, 314],
  [1200, 307],
  [561, 386],
  [738, 385],
  [85, 615],
  [254, 614],
  [971, 614],
  [1212, 616],
  [470, 655],
  [827, 654],
  [137, 905],
  [344, 904],
  [553, 861],
  [745, 861],
  [1004, 868],
  [1219, 868],
  [886, 1068],
  [1015, 1068],
  [563, 1060],
  [737, 1060],
] as const;

function HallEffects() {
  const id = useId();
  const portalClip = `${id}-portal`;
  const warmGlow = `${id}-warm`;
  const coolGlow = `${id}-cool`;
  return (
    <svg
      className="hall-effects"
      viewBox={`0 0 ${HALL_LAYOUT.world.width} ${HALL_LAYOUT.world.height}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={portalClip}>
          <path d="M594 326V204Q594 150 649 134Q704 150 704 204V326Z" />
        </clipPath>
        <radialGradient id={warmGlow}>
          <stop stopColor="#ffc873" stopOpacity=".36" />
          <stop offset="1" stopColor="#f2a54e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={coolGlow}>
          <stop stopColor="#65ffed" stopOpacity=".32" />
          <stop offset="1" stopColor="#31d6ca" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse
        className="hall-portal-glow"
        cx="649"
        cy="314"
        rx="112"
        ry="62"
        fill={`url(#${coolGlow})`}
      />
      <g clipPath={`url(#${portalClip})`}>
        <path d="M594 326V134H704V326Z" fill="#083e42" opacity=".3" />
        <g className="hall-portal-current">
          <path
            d="M649 348C558 318 570 222 636 205C706 187 727 252 674 271C641 282 624 254 649 240"
            fill="none"
            stroke="#45e8dd"
            strokeWidth="9"
            strokeLinecap="round"
            opacity=".58"
          />
          <path
            className="hall-portal-stream"
            d="M649 348C558 318 570 222 636 205C706 187 727 252 674 271C641 282 624 254 649 240"
            fill="none"
            stroke="#c5fff4"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="20 55 7 38"
            opacity=".75"
          />
          <path
            d="M649 137C743 162 732 261 665 280C604 297 574 239 624 218C657 204 676 235 649 245"
            fill="none"
            stroke="#2bd5ce"
            strokeWidth="7"
            strokeLinecap="round"
            opacity=".65"
          />
        </g>
        {Array.from({ length: 9 }, (_, i) => (
          <rect
            key={i}
            className="hall-portal-mote"
            x={610 + ((i * 23) % 77)}
            y={315 - ((i * 19) % 160)}
            width={i % 3 === 0 ? 4 : 2}
            height={i % 3 === 0 ? 4 : 2}
            fill="#d0fff5"
            style={{ '--effect-delay': `${-i * 0.63}s` } as CSSProperties}
          />
        ))}
      </g>
      <g className="hall-plaza-runes" fill="none" stroke="#83fff0">
        <ellipse cx="649" cy="548" rx="123" ry="81" strokeWidth="3" strokeDasharray="14 94" />
        <ellipse cx="649" cy="548" rx="69" ry="45" strokeWidth="2" strokeDasharray="7 66" />
      </g>

      {/* Flame tongues stay inside the existing furnace mouth and roof brazier. */}
      <ellipse
        className="hall-forge-glow"
        cx="157"
        cy="636"
        rx="77"
        ry="59"
        fill={`url(#${warmGlow})`}
      />
      <g transform="translate(157 645)" className="hall-fire">
        <path
          className="hall-flame hall-flame-outer"
          d="M-22 0H23V-12H18V-23H11V-17H7V-33H2V-24H-3V-36H-8V-22H-14V-16H-19Z"
          fill="#ffa538"
        />
        <path
          className="hall-flame hall-flame-inner"
          d="M-12 0H13V-10H9V-16H5V-10H1V-24H-3V-14H-8V-7H-12Z"
          fill="#ffeaa0"
        />
      </g>
      <g transform="translate(157 587)" className="hall-fire hall-roof-fire">
        <path
          className="hall-flame hall-flame-outer"
          d="M-18 0H18V-10H13V-19H8V-12H4V-34H0V-25H-5V-17H-10V-24H-14V-13H-18Z"
          fill="#ffc04e"
        />
        <path
          className="hall-flame hall-flame-inner"
          d="M-8 0H9V-9H5V-19H1V-11H-3V-7H-8Z"
          fill="#fff2ad"
        />
      </g>
      {Array.from({ length: 7 }, (_, i) => (
        <rect
          key={i}
          className="hall-forge-spark"
          x={143 + ((i * 11) % 31)}
          y="620"
          width="3"
          height="3"
          fill="#ffdb83"
          style={
            {
              '--effect-delay': `${-i * 0.37}s`,
              '--spark-drift': `${((i % 3) - 1) * 15}px`,
            } as CSSProperties
          }
        />
      ))}
      <g transform="translate(118 465)" fill="#b8c5bd">
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            className="hall-forge-smoke"
            d="M-10 0H10V-5H17V-17H11V-22H-4V-17H-13V-6H-10Z"
            style={{ '--effect-delay': `${-i * 1.6}s` } as CSSProperties}
          />
        ))}
      </g>

      {[512, 786].map((x, i) => (
        <g
          key={x}
          transform={`translate(${x} 383)`}
          className="hall-fire hall-magic-fire"
          style={{ '--effect-delay': `${-i * 0.6}s` } as CSSProperties}
        >
          <ellipse cy="-8" rx="36" ry="40" fill={`url(#${coolGlow})`} />
          <path
            className="hall-flame hall-flame-outer"
            d="M-10 0H11V-8H15V-17H9V-25H5V-38H1V-30H-4V-20H-10V-14H-14V-6H-10Z"
            fill="#4ff9ef"
          />
          <path
            className="hall-flame hall-flame-inner"
            d="M-5 0H5V-8H8V-13H3V-25H0V-16H-4V-9H-7V-5H-5Z"
            fill="#d6fff8"
          />
        </g>
      ))}
      {LANTERNS.map(([x, y], i) => (
        <g
          key={`${x}-${y}`}
          transform={`translate(${x} ${y})`}
          className="hall-lantern"
          style={
            {
              '--effect-delay': `${-i * 0.41}s`,
              '--light-period': `${2.4 + (i % 5) * 0.37}s`,
            } as CSSProperties
          }
        >
          <ellipse
            className="hall-lantern-glow"
            cy="12"
            rx="34"
            ry="39"
            fill={`url(#${warmGlow})`}
          />
          <rect className="hall-lantern-wick" x="-4" y="-7" width="8" height="14" fill="#ffe5a4" />
        </g>
      ))}
    </svg>
  );
}

/** Background and actors share one fixed world plane and one camera transform. */
export function HallScene({
  src,
  onLoad,
  onError,
}: {
  src: string;
  onLoad: () => void;
  onError: () => void;
}) {
  return (
    <>
      <img
        className="town-scene hall-scene"
        src={src}
        fetchPriority="high"
        onLoad={onLoad}
        onError={onError}
        width={HALL_LAYOUT.world.width}
        height={HALL_LAYOUT.world.height}
        alt="暮林守望者营地：中央传送门、空旷符文广场和南北石道，七处服务建筑与居民沿外围分布"
        draggable={false}
        style={{ objectFit: 'fill', opacity: 1, imageRendering: 'pixelated' }}
      />
      <HallEffects />
    </>
  );
}
