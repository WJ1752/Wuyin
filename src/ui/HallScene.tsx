import { useId, type CSSProperties } from 'react';
import { HALL_LAYOUT } from '../data/npcHall';
import './hall-effects.css';

export const CAMP_ART = 'assets/maps/watchers-keep.webp';

// The hand-painted lanterns and the playable map share one coordinate space.
const LANTERNS = [
  [522, 239],
  [742, 240],
  [524, 339],
  [739, 338],
  [225, 321],
  [306, 296],
  [1008, 262],
  [1076, 264],
  [394, 554],
  [982, 559],
  [1069, 563],
  [293, 799],
  [416, 800],
  [884, 947],
  [1040, 770],
  [552, 1093],
  [701, 1094],
] as const;

function HallEffects() {
  const id = useId();
  const gate = `${id}-gate`;
  const gold = `${id}-gold`;
  const mist = `${id}-mist`;
  const silver = `${id}-silver`;
  return (
    <svg
      className="hall-effects"
      viewBox={`0 0 ${HALL_LAYOUT.world.width} ${HALL_LAYOUT.world.height}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={gate}>
          <path d="M573 284V217Q579 179 630 163Q678 173 689 217V284Z" />
        </clipPath>
        <radialGradient id={gold}>
          <stop stopColor="#ffd695" stopOpacity=".48" />
          <stop offset=".38" stopColor="#e69a57" stopOpacity=".2" />
          <stop offset="1" stopColor="#c6703f" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={mist}>
          <stop stopColor="#b2c4c8" stopOpacity=".17" />
          <stop offset="1" stopColor="#b2c4c8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={silver}>
          <stop stopColor="#b5e6da" stopOpacity=".32" />
          <stop offset="1" stopColor="#92c6bc" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className="hall-mist" fill={`url(#${mist})`}>
        <ellipse cx="156" cy="172" rx="293" ry="88" />
        <ellipse cx="1060" cy="394" rx="290" ry="54" />
        <ellipse cx="727" cy="1165" rx="434" ry="68" />
      </g>
      <g clipPath={`url(#${gate})`}>
        <ellipse
          className="hall-portal-glow"
          cx="628"
          cy="231"
          rx="59"
          ry="74"
          fill={`url(#${silver})`}
        />
        <g className="hall-portal-current" fill="none" stroke="#d6fff1" strokeLinecap="round">
          <path d="M597 280C651 258 578 207 662 176" strokeWidth="2.2" opacity=".58" />
          <path d="M622 295C680 260 627 230 673 193" strokeWidth="1" opacity=".46" />
          <path
            className="hall-portal-stream"
            d="M597 280C651 258 578 207 662 176"
            strokeWidth="3"
            strokeDasharray="5 25 10 39"
          />
        </g>
        {Array.from({ length: 7 }, (_, i) => (
          <circle
            key={i}
            className="hall-portal-mote"
            cx={587 + ((i * 19) % 92)}
            cy={264 - ((i * 13) % 68)}
            r={i % 3 === 0 ? 1.8 : 0.9}
            fill="#d6fff1"
            style={{ '--effect-delay': `${-i * 0.55}s` } as CSSProperties}
          />
        ))}
      </g>
      <ellipse
        className="hall-plaza-runes"
        cx="630"
        cy="453"
        rx="126"
        ry="56"
        fill="none"
        stroke="#beded2"
        strokeWidth="1.2"
        strokeDasharray="2 18 1 50"
      />

      <ellipse
        className="hall-forge-glow"
        cx="215"
        cy="587"
        rx="69"
        ry="33"
        fill={`url(#${gold})`}
      />
      {Array.from({ length: 7 }, (_, i) => (
        <circle
          key={i}
          className="hall-forge-spark"
          cx={203 + ((i * 7) % 23)}
          cy={585 - (i % 3) * 3}
          r={i % 3 === 0 ? 1.5 : 0.85}
          fill="#ffc989"
          style={
            {
              '--effect-delay': `${-i * 0.37}s`,
              '--spark-drift': `${i % 2 ? -15 : 18}px`,
            } as CSSProperties
          }
        />
      ))}
      <ellipse
        className="hall-forge-smoke"
        cx="212"
        cy="528"
        rx="37"
        ry="19"
        fill={`url(#${mist})`}
      />

      {LANTERNS.map(([x, y], i) => (
        <g
          key={`${x}-${y}`}
          transform={`translate(${x} ${y})`}
          style={
            {
              '--effect-delay': `${-i * 0.41}s`,
              '--light-period': `${2 + (i % 5) * 0.43}s`,
            } as CSSProperties
          }
        >
          <ellipse className="hall-lantern-glow" cy="8" rx="28" ry="32" fill={`url(#${gold})`} />
          <ellipse className="hall-lantern-wick" rx="2" ry="3.3" fill="#fff2d2" />
        </g>
      ))}
    </svg>
  );
}

/** Background and actors share one world plane and one camera transform. */
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
        alt="守望者营地，铁门和铜制罗盘广场旁分布着七处服务建筑"
        draggable={false}
      />
      <HallEffects />
    </>
  );
}
