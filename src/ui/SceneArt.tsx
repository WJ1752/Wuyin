import type { ClassId } from '../core/types';

export function HeroArt({
  classId = 'ranger',
  small = false,
}: {
  classId?: ClassId;
  small?: boolean;
}) {
  const colors = {
    ranger: '#70b9a6',
    barbarian: '#d38b58',
    sorcerer: '#aaa2ee',
    necromancer: '#99c5ac',
    druid: '#92bd82',
  };
  const color = colors[classId];
  return (
    <svg
      viewBox="0 0 240 300"
      className={small ? 'hero-art small' : 'hero-art'}
      aria-label="职业角色立绘"
      role="img"
    >
      <defs>
        <radialGradient id={`aura-${classId}`}>
          <stop stopColor={color} stopOpacity=".25" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`armor-${classId}`} x2="1" y2="1">
          <stop stopColor="#87918c" />
          <stop offset=".3" stopColor="#34454a" />
          <stop offset=".65" stopColor="#142227" />
          <stop offset="1" stopColor="#657270" />
        </linearGradient>
      </defs>
      <ellipse cx="120" cy="264" rx="108" ry="29" fill={`url(#aura-${classId})`} />
      <ellipse cx="120" cy="262" rx="66" ry="12" fill="none" stroke={color} opacity=".2" />
      <path
        d="M96 83Q69 92 61 154L41 251 91 238 117 262 140 237 193 247Q164 199 165 123L143 80Z"
        fill="#101c24"
        stroke="#405154"
      />
      <path d="M96 92L70 233 107 210 121 246 133 212 178 235 143 95" fill="#1b3035" opacity=".7" />
      <path
        d="M99 179L92 228 85 258 112 258 124 200 133 231 134 260 158 260 145 178"
        fill="#202b2e"
        stroke="#75817a"
      />
      <path
        d="M91 230L112 235 111 258 80 261 83 253Z M133 235L154 231 160 259 130 262Z"
        fill="#384347"
        stroke="#a29472"
      />
      <path
        d="M91 104L121 89 151 105 147 156 136 181 103 180 91 155Z"
        fill={`url(#armor-${classId})`}
        stroke="#9a977e"
      />
      <path
        d="M99 119L119 134 142 114M103 135L120 145 140 132M105 151L122 157 139 146"
        fill="none"
        stroke="#a79870"
        strokeWidth="2"
      />
      <path
        d="M96 100L77 91 64 115 88 130 102 114M145 100L165 91 180 117 156 128 141 115"
        fill="#3b494c"
        stroke="#b8a878"
      />
      <path
        d="M71 121L65 155 75 177 88 167 84 134M164 123L174 150 165 178 152 171 155 135"
        fill="#27373c"
        stroke="#879081"
      />
      <path
        d="M65 148L85 151 90 173 72 180ZM157 151L175 149 172 175 151 180Z"
        fill="#4c5857"
        stroke="#ac9b75"
      />
      <path d="M106 159L141 159 142 173 102 173Z" fill="#493e32" stroke="#b39b62" />
      <path d="M116 159L129 159 132 168 121 175 113 168Z" fill={color} />
      <path
        d="M100 93L98 58 111 36 135 39 148 61 143 93 124 107Z"
        fill="#273b40"
        stroke="#84988d"
      />
      <path d="M106 71L120 51 139 70 135 88 122 97 108 86Z" fill="#101c20" />
      <path d="M108 73L119 77M127 77L138 72" stroke={color} strokeWidth="3" />
      <path d="M111 88L123 92 134 86" fill="none" stroke="#627169" />
      {classId === 'ranger' && (
        <g>
          <path d="M57 84Q4 157 63 232M57 84L64 232" fill="none" stroke="#c4ac73" strokeWidth="4" />
          <path
            d="M57 84Q26 151 63 232M57 84L42 155 63 232"
            fill="none"
            stroke="#4a8175"
            strokeWidth="2"
          />
          <path d="M39 151L122 159M35 151L45 146 44 156Z" stroke="#dfd4a5" fill="#dfd4a5" />
          <path d="M158 96L181 57M164 103L193 61M170 107L201 71" stroke="#8b957f" strokeWidth="3" />
        </g>
      )}
      {classId === 'barbarian' && (
        <g>
          <path
            d="M103 53L82 33 86 66 104 75M141 53L163 33 159 65 142 75"
            fill="#c0b087"
            stroke="#5e6259"
          />
          <path d="M169 82L152 244" stroke="#9f8157" strokeWidth="7" />
          <path
            d="M165 96Q205 75 208 135L163 121 134 136 138 100Z"
            fill="#9aa3a0"
            stroke="#d2c6a1"
          />
        </g>
      )}
      {classId === 'sorcerer' && (
        <g>
          <path
            d="M101 58L98 23 115 45 124 17 132 45 149 26 144 61"
            fill="#847aa0"
            stroke="#c3b589"
          />
          <path d="M172 67L158 251" stroke="#b49b70" strokeWidth="5" />
          <path d="M170 36L190 57 171 80 151 57Z" fill="#645389" stroke="#c4b4e0" />
          <path d="M171 44L179 57 170 70 161 57Z" fill={color} />
          <circle cx="58" cy="166" r="17" fill="#7a66bd" opacity=".6" />
          <circle cx="58" cy="166" r="10" fill="#d9cef9" />
        </g>
      )}
      {classId === 'necromancer' && (
        <g>
          <path
            d="M99 61L102 29 114 43 122 23 132 43 144 30 146 63"
            fill="#aeb2a1"
            stroke="#565e56"
          />
          <path d="M172 69L149 254" stroke="#9a9278" strokeWidth="5" />
          <path d="M161 79Q203 71 213 121Q217 53 167 50L145 67Z" fill="#c0c7b4" stroke="#688f82" />
          <path d="M52 156L69 156 77 171 68 183 57 183 45 172Z" fill="#adc0ad" />
          <path d="M52 165L59 171 52 175M68 165L62 171 68 175" fill="#192c25" />
        </g>
      )}
      {classId === 'druid' && (
        <g>
          <path
            d="M97 62L95 34 112 45 133 43 150 30 146 68 135 59 121 69 108 59Z"
            fill="#728977"
            stroke="#c2c6a2"
          />
          <path
            d="M66 168L39 220 48 230 77 175M161 169L188 214 179 229 151 178"
            fill="#b7c9c0"
            stroke="#6ca495"
          />
        </g>
      )}
      <path d="M116 114L123 108 130 114 123 125Z" fill={color} />
    </svg>
  );
}

export function TownScene() {
  return (
    <svg
      className="town-scene"
      viewBox="0 0 1000 760"
      preserveAspectRatio="xMidYMid slice"
      aria-label="暮色中的守望者营地，古老传送门散发秘境幽光"
      role="img"
    >
      <defs>
        <linearGradient id="sky" x2="0" y2="1">
          <stop stopColor="#17232c" />
          <stop offset=".55" stopColor="#365157" />
          <stop offset="1" stopColor="#111a1c" />
        </linearGradient>
        <linearGradient id="stone" x2="1" y2=".5">
          <stop stopColor="#4e5855" />
          <stop offset=".45" stopColor="#344544" />
          <stop offset="1" stopColor="#172727" />
        </linearGradient>
        <linearGradient id="floor" x2="0" y2="1">
          <stop stopColor="#3b4844" />
          <stop offset="1" stopColor="#111b20" />
        </linearGradient>
        <linearGradient id="beam" x2="0" y2="1">
          <stop stopColor="#c1e5c6" stopOpacity="0" />
          <stop offset=".6" stopColor="#c1e5c6" stopOpacity=".16" />
          <stop offset="1" stopColor="#c1e5c6" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="portal">
          <stop stopColor="#d8fff0" stopOpacity=".9" />
          <stop offset=".35" stopColor="#84c9bd" stopOpacity=".4" />
          <stop offset="1" stopColor="#396a67" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lamp">
          <stop stopColor="#ffdfa2" stopOpacity=".8" />
          <stop offset=".3" stopColor="#ed9a47" stopOpacity=".2" />
          <stop offset="1" stopColor="#d28134" stopOpacity="0" />
        </radialGradient>
        <filter id="mist">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <pattern
          id="paving"
          width="100"
          height="56"
          patternUnits="userSpaceOnUse"
          patternTransform="skewX(-25)"
        >
          <path
            d="M0 0H100V56H0ZM50 0V28M0 28H100"
            stroke="#809086"
            strokeOpacity=".1"
            fill="none"
          />
          <path d="M5 5L45 5M55 33H91" stroke="#101b1e" strokeWidth="2" opacity=".4" />
        </pattern>
        <g id="pine">
          <path
            d="M0-150L-19-103-8-108-35-64-20-69-48-17-9-31-8 0H8L9-31 48-17 20-69 35-64 8-108 19-103Z"
            fill="#10252a"
          />
          <path d="M0-136V0" stroke="#263b3b" strokeWidth="3" />
        </g>
        <g id="torch">
          <path d="M-4 0L-6 49 6 49 4 0M-12-3H12L8 8H-8Z" fill="#2a2c25" stroke="#a38a55" />
          <path d="M0-30Q-20-6-5 0Q12 4 8-15L3-9Z" fill="#e8a051" />
          <path d="M0-19Q-8-5 0-1Q9-2 0-19" fill="#ffe0a0" />
        </g>
        <g id="rune">
          <path d="M0-7L6 0 0 7-6 0ZM0-12V12M-10 0H10" fill="none" stroke="#9dd6c5" opacity=".8" />
        </g>
      </defs>
      <rect width="1000" height="760" fill="url(#sky)" />
      <circle cx="705" cy="118" r="54" fill="#b5c7ba" opacity=".15" />
      <circle cx="720" cy="109" r="50" fill="#23373e" />
      <path
        d="M0 310L94 207 144 245 269 113 353 211 445 169 528 263 619 201 704 266 806 146 925 226 1000 169V550H0Z"
        fill="#162b32"
        opacity=".7"
      />
      <path
        d="M0 369L86 307 143 324 253 256 333 293 415 242 551 337 664 275 790 319 920 242 1000 298V580H0Z"
        fill="#1d3337"
      />
      {Array.from({ length: 24 }, (_, i) => (
        <use
          key={i}
          href="#pine"
          transform={`translate(${i * 48 - 60} ${330 + ((i * 37) % 125)}) scale(${0.5 + ((i * 13) % 10) / 10})`}
          opacity={0.35 + (i % 3) * 0.14}
        />
      ))}
      <path d="M0 482Q415 365 1000 460V760H0Z" fill="url(#floor)" />
      <path d="M0 482Q415 365 1000 460V760H0Z" fill="url(#paving)" />
      <path d="M441 0L271 563 606 513 554 0" fill="url(#beam)" />
      <g opacity=".5">
        <path d="M680 198L680 367H755V199L720 142Z" fill="#223337" />
        <path d="M687 195L720 127 761 197Z" fill="#14272e" />
        <path d="M706 235Q720 207 735 235V286H706Z" fill="#111d24" />
        <path d="M663 367H775V381H663" fill="#3c4845" />
        <path d="M715 145V113M703 124H728" stroke="#495c57" strokeWidth="5" />
      </g>
      <g transform="translate(412 241)">
        <ellipse cx="91" cy="270" rx="173" ry="61" fill="url(#portal)" />
        <path
          d="M-25 254V79Q-25-52 91-91Q208-51 208 79V254H168V77Q164-12 91-47Q14-9 16 77V254Z"
          fill="url(#stone)"
          stroke="#6e8075"
          strokeWidth="2"
        />
        <path
          d="M-14 247V79Q-15-40 91-78Q197-39 197 79V247M6 247V79Q4-18 91-59Q179-20 179 79V247"
          fill="none"
          stroke="#a0a88c"
          strokeOpacity=".34"
          strokeWidth="3"
        />
        <path d="M19 256V80Q20-8 91-40Q166-5 166 80V256Z" fill="#173238" />
        <ellipse className="portal-glow" cx="91" cy="146" rx="106" ry="155" fill="url(#portal)" />
        <path
          className="portal-vein"
          d="M91-27Q37 42 74 79T85 177Q57 212 91 256M115-12Q81 34 117 95T100 192L126 249"
          stroke="#bde8d0"
          strokeWidth="2"
          fill="none"
          opacity=".5"
        />
        <path
          d="M-39 258H28V277H-39ZM155 258H223V277H155ZM-20 83H12M-22 125H12M-22 170H12M-22 211H12M172 83H202M172 125H205M172 170H205M172 211H205"
          fill="#3d514c"
          stroke="#83907a"
          strokeOpacity=".4"
        />
        {[
          [-6, 63],
          [-6, 111],
          [-6, 160],
          [-6, 211],
          [188, 63],
          [188, 111],
          [188, 160],
          [188, 211],
          [91, -66],
          [39, -26],
          [143, -26],
        ].map(([x, y], i) => (
          <use key={i} href="#rune" x={x} y={y} />
        ))}
        <path d="M70-90L91-119 114-91 103-69 80-69Z" fill="#374e4d" stroke="#869783" />
        <path d="M91-109L101-90 91-78 81-90Z" fill="#98c6b0" />
        <path
          d="M-65 282H247L230 299H-49ZM-86 305H265L282 322H-101Z"
          fill="#42534d"
          stroke="#6b7a68"
        />
        <path d="M-112 328H290L315 348H-135Z" fill="#34443f" stroke="#576654" />
      </g>
      <g transform="translate(118 330)">
        <path d="M-85 119L0 70 126 106V219L41 267-85 215Z" fill="#2b3534" stroke="#58645a" />
        <path d="M-110 124L-17 13 18-2 148 101 39 161Z" fill="#17292e" stroke="#647570" />
        <path
          d="M-101 122L-17 30 38 148 132 103M-17 30L120 105M-55 76L79 129"
          fill="none"
          stroke="#3f5555"
          strokeWidth="3"
        />
        <path d="M-9 167Q15 133 39 166V230L-9 247Z" fill="#101a1c" />
        <path d="M-72 155L-34 171V209L-72 193Z" fill="#ac6a3d" opacity=".5" />
        <path d="M71 161L104 144V174L71 193Z" fill="#b79057" opacity=".4" />
        <path d="M-2 30V-38L23-43V27" fill="#394440" stroke="#637165" />
        <path d="M-3-43H29V-30H-3Z" fill="#35423e" />
        <path
          d="M22-44Q-13-93 15-122"
          stroke="#78918a"
          strokeWidth="19"
          opacity=".1"
          fill="none"
          filter="url(#mist)"
        />
      </g>
      <g transform="translate(807 383)">
        <path d="M-67 89L0 51 106 94V199L42 235-67 188Z" fill="#293432" stroke="#57665b" />
        <path d="M-89 88L-11-18 124 81 44 128Z" fill="#282d37" stroke="#63706c" />
        <path d="M-11-18L43 128M-74 89L43 128 110 83" fill="none" stroke="#978b75" />
        <path d="M-29 118L11 137V190L-29 174Z" fill="#191d23" />
        <path d="M-44 89L-40 170M72 111L75 195" stroke="#5b5a49" strokeWidth="6" />
        <path d="M-44 92Q12 129 73 111L75 152Q10 169-43 130Z" fill="#504459" stroke="#8b7889" />
        <path
          d="M-35 129L-28 135-23 130-16 142-9 135-2 148 5 140 12 153 19 144 26 154 33 145 40 153 47 145 54 150 61 143 70 147"
          fill="none"
          stroke="#b09870"
        />
      </g>
      <g transform="translate(318 539)">
        <ellipse cy="35" rx="60" ry="22" fill="#101d20" />
        <path d="M-24 0L-15 31 24 32 30 2 8-9Z" fill="#464c43" stroke="#727564" />
        <path d="M-33-7L-34-20 30-23 43-11 20-2H-19Z" fill="#7c8175" stroke="#a6a68c" />
        <circle cy="-17" r="72" fill="url(#lamp)" opacity=".65" />
      </g>
      <g transform="translate(661 580)">
        <ellipse cy="39" rx="59" ry="19" fill="#112024" />
        <path d="M-31-9L0-28 32-9 30 24 0 43-30 23Z" fill="#465252" stroke="#919783" />
        <path d="M0-17L20-5 0 9-20-5Z" fill="#8c7dc3" />
        <path d="M0 9V32M-23-2L-23 17M23-2V17" stroke="#b5a376" />
        <ellipse cy="-2" rx="58" ry="47" fill="url(#portal)" opacity=".25" />
      </g>
      {[
        { x: 361, y: 462 },
        { x: 650, y: 469 },
        { x: 175, y: 555 },
        { x: 824, y: 611 },
      ].map(({ x, y }, i) => (
        <g key={i}>
          <circle cx={x} cy={y - 10} r="86" fill="url(#lamp)" />
          <use href="#torch" x={x} y={y} />
        </g>
      ))}
      <g opacity=".12" filter="url(#mist)" className="scene-mist">
        <ellipse cx="324" cy="357" rx="273" ry="27" fill="#b4d0bd" />
        <ellipse cx="638" cy="560" rx="308" ry="26" fill="#b4d0bd" />
        <ellipse cx="488" cy="681" rx="361" ry="36" fill="#94acaa" />
      </g>
      {Array.from({ length: 22 }, (_, i) => (
        <circle
          className="mote"
          key={i}
          cx={115 + ((i * 37) % 780)}
          cy={170 + ((i * 59) % 440)}
          r={i % 3 === 0 ? 2 : 1}
          fill={i % 2 ? '#c7c2a1' : '#9fc7b5'}
          style={{ animationDelay: `${i * 0.21}s` }}
        />
      ))}
      <path
        d="M0 0V760H93L66 715 78 618 48 508 79 455 44 356 55 291 28 214 38 119 29 0M1000 0V760H933L948 649 926 582 953 498 940 376 964 290 950 221 978 125 969 0"
        fill="#0c171c"
        opacity=".85"
      />
      <path
        d="M0 0L106 61 164 66 91 81 48 61M1000 105L879 147 834 190 887 165 961 159M0 355L103 306 156 246 120 315 44 387"
        fill="#0c171c"
      />
    </svg>
  );
}
