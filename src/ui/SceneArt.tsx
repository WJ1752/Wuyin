import type { ClassId } from '../core/types';
import { CHARACTER_ART } from '../render/CharacterTextures';

export function HeroArt({
  classId = 'ranger',
  small = false,
}: {
  classId?: ClassId;
  small?: boolean;
}) {
  return (
    <img
      src={CHARACTER_ART[classId].src}
      className={small ? 'hero-art small' : 'hero-art'}
      alt="职业角色立绘"
      style={{ objectFit: 'contain', objectPosition: 'center bottom', imageRendering: 'pixelated' }}
      decoding="async"
      draggable={false}
    />
  );
}

function Pine({
  x,
  y,
  size = 1,
  distant = false,
}: {
  x: number;
  y: number;
  size?: number;
  distant?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <path d="M-2-12H3V5H-2Z" fill={distant ? '#243c3d' : '#785b3e'} />
      <path
        d="M-1-44H2V-39H5V-34H8V-30H6V-28H11V-24H14V-20H11V-18H17V-14H20V-10H5V-7H-5V-10H-19V-14H-16V-18H-11V-20H-13V-24H-10V-28H-6V-30H-8V-34H-5V-39H-1Z"
        fill={distant ? '#20383c' : '#183c32'}
      />
      {!distant && (
        <>
          <path
            d="M-1-39H2V-34H5V-30H1V-27H-4V-24H-9V-21H3V-18H-6V-14H-14V-12H-4V-10H4V-14H10V-16H4V-20H8V-23H2V-28H5V-30H1Z"
            fill="#396447"
          />
          <path
            d="M-2-35H0V-31H-3V-28H-6V-25H-9V-23H-5V-26H-2ZM-8-17H-5V-14H-12V-12H-15V-14H-8Z"
            fill="#607c4e"
          />
        </>
      )}
    </g>
  );
}

function Torch({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-3 1H4V16H-3ZM-5-2H6V3H-5Z" fill="#1b252d" />
      <path d="M-1 3H1V14H-1Z" fill="#b48b50" />
      <path d="M-2-14H1V-9H4V-5H6V-1H3V1H-3V-1H-5V-6H-3V-10H-2Z" fill="#db8550" />
      <path d="M-1-9H1V-5H3V-1H-2V-4H-1Z" fill="#ffe4a1" />
      <rect x="-2" y="-19" width="2" height="2" fill="#e5b375" />
    </g>
  );
}

/** 250×190 authored pixel composition; all terrain, architecture and lighting use solid clusters. */
export function TownScene() {
  return (
    <svg
      className="town-scene"
      viewBox="0 0 250 190"
      preserveAspectRatio="xMidYMid slice"
      shapeRendering="crispEdges"
      aria-label="像素暮林中的守望者营地，青绿色符文门、铁匠铺与温暖篝火"
      role="img"
    >
      <defs>
        <pattern id="pixel-paving" width="24" height="14" patternUnits="userSpaceOnUse">
          <rect width="24" height="14" fill="#33453e" />
          <path d="M0 0H24V1H0ZM0 7H24V8H0ZM11 0H12V7H11ZM0 7H1V14H0Z" fill="#263a36" />
          <path d="M2 2H9V3H2ZM14 9H21V10H14Z" fill="#4b5c4c" />
        </pattern>
      </defs>
      <rect width="250" height="190" fill="#172c38" />
      <path d="M0 35H250V67H0Z" fill="#203943" />
      <path d="M0 58H250V92H0Z" fill="#2d4548" />
      <path
        d="M176 17H187V19H192V23H195V34H192V38H188V40H176V37H172V33H170V23H173V20H176Z"
        fill="#a3bfa7"
      />
      <path d="M182 17H187V19H192V23H195V34H190V32H186V29H183V25H182Z" fill="#203943" />
      {[
        [24, 24],
        [53, 15],
        [88, 30],
        [139, 18],
        [214, 32],
        [233, 12],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="1" height="1" fill="#8aa7a2" />
      ))}
      <path
        d="M0 66H8V60H17V54H25V59H32V65H39V57H47V50H54V44H62V37H68V43H74V50H82V57H91V61H101V68H113V62H123V54H134V59H141V65H153V60H164V53H176V57H184V63H193V55H202V45H210V38H216V45H224V51H232V57H242V52H250V112H0Z"
        fill="#1e353d"
      />
      {Array.from({ length: 18 }, (_, i) => (
        <Pine
          key={i}
          x={i * 16 - 9}
          y={89 + ((i * 11) % 16)}
          size={0.75 + (i % 3) * 0.25}
          distant
        />
      ))}
      <path d="M0 111H33V107H67V104H93V102H155V105H194V109H226V114H250V190H0Z" fill="#263e35" />
      <path
        d="M86 109H161V117H178V128H198V139H226V151H250V190H0V164H30V151H51V137H71V123H86Z"
        fill="#22332f"
      />
      <path
        d="M91 111H156V120H174V131H194V142H220V155H250V190H0V169H32V156H55V142H75V128H91Z"
        fill="url(#pixel-paving)"
      />
      {/* Distant watchtower and cloth flag. */}
      <path d="M188 61H204V97H188Z" fill="#273d40" />
      <path d="M185 62H207V57H203V52H199V47H193V52H189V57H185Z" fill="#182d36" />
      <path d="M194 69H199V80H194Z" fill="#ad9c68" />
      <path d="M196 37H197V48H196ZM197 37H209V43H197Z" fill="#6d7a63" />
      {/* The shrine is built from individually lit stone blocks, with a stepped portal. */}
      <path
        d="M91 124V65H95V54H101V46H110V40H119V37H133V40H143V46H151V54H156V65H160V124Z"
        fill="#122c2e"
      />
      <path
        d="M94 123V65H98V55H104V48H112V43H121V40H131V43H140V48H148V55H153V65H157V123H145V68H141V58H134V53H119V53H112V58H106V68H106V123Z"
        fill="#546b59"
      />
      <path
        d="M96 122V65H100V56H106V49H114V44H122V42H128V45H116V49H108V55H103V64H100V122Z"
        fill="#8c9b73"
      />
      <path d="M148 64H153V122H148ZM142 55H147V64H142Z" fill="#354b42" />
      <path d="M109 120V69H113V61H119V56H132V60H139V69H143V120Z" fill="#244c48" />
      <path d="M115 120V73H119V66H132V73H137V120Z" fill="#356b5c" />
      <path d="M121 119V91H118V82H121V74H125V70H129V82H125V95H129V109H126V119Z" fill="#89c7a1" />
      <path d="M124 117V105H127V94H124V83H126V76H128V88H127V102H130V114H127V119Z" fill="#d2f0ba" />
      {Array.from({ length: 5 }, (_, i) => (
        <g key={i}>
          <rect x="95" y={70 + i * 10} width="9" height="1" fill="#2a413a" />
          <rect x="147" y={70 + i * 10} width="9" height="1" fill="#2a413a" />
          <path
            d={`M98 ${73 + i * 10}h3v2h-1v3h-2ZM150 ${73 + i * 10}h3v2h-1v3h-2Z`}
            fill="#b7d09a"
          />
        </g>
      ))}
      <path d="M121 31H131V35H135V40H131V44H121V40H117V35H121Z" fill="#213936" />
      <path d="M124 31H128V34H131V38H128V41H124V38H121V34H124Z" fill="#b2d49e" />
      <path d="M87 122H163V128H87ZM83 130H167V136H83ZM78 138H173V144H78Z" fill="#20342f" />
      <path d="M87 121H163V124H87ZM83 129H167V132H83ZM78 137H173V140H78Z" fill="#718066" />
      {/* Left timber smithy. */}
      <path d="M15 104H61V147H15Z" fill="#1b2d2d" />
      <path d="M19 107H57V143H19Z" fill="#6c6247" />
      <path d="M23 108H53V141H23Z" fill="#89734c" />
      <path d="M18 113H58V116H18ZM18 129H58V132H18ZM36 104H40V145H36Z" fill="#3b3d31" />
      <path
        d="M9 108V103H13V97H18V91H23V85H28V79H34V74H42V79H47V85H52V91H57V97H63V103H68V108Z"
        fill="#182d30"
      />
      <path
        d="M14 101H19V95H24V89H29V83H35V79H41V83H46V89H51V95H56V101H61V104H14Z"
        fill="#3e5b50"
      />
      <path d="M19 99H57V101H19ZM24 93H51V95H24ZM29 87H46V89H29ZM35 81H41V83H35Z" fill="#758364" />
      <path d="M46 76V63H54V89H50V83Z" fill="#6c7865" />
      <path d="M45 61H55V65H45Z" fill="#a2a084" />
      <path d="M47 55H52V57H47ZM49 48H56V50H49ZM46 41H52V43H46Z" fill="#687b73" />
      <path d="M26 122H34V142H26Z" fill="#233532" />
      <path d="M44 119H53V130H44Z" fill="#312e28" />
      <path d="M46 121H51V128H46Z" fill="#e8b96f" />
      {/* Right merchant's violet awning and hanging sign. */}
      <path d="M189 121H229V164H189Z" fill="#263532" />
      <path d="M193 125H225V160H193Z" fill="#6c6148" />
      <path
        d="M182 125V119H188V112H194V105H201V98H211V104H217V111H224V118H231V125Z"
        fill="#262d38"
      />
      <path d="M188 121H225V124H188V117H194V110H201V103H209V108H216V115H222V121Z" fill="#65546f" />
      <path d="M187 134H229V148H187Z" fill="#342d43" />
      <path d="M187 133H229V141H187Z" fill="#9c788f" />
      {[188, 198, 208, 218].map((x) => (
        <path key={x} d={`M${x} 134h5v11h-5Z`} fill="#c3aa8c" />
      ))}
      <path d="M188 147H191V166H188ZM226 147H229V166H226Z" fill="#b19566" />
      <path d="M197 149H221V163H197Z" fill="#2c3331" />
      <path d="M200 153H207V159H200ZM211 150H217V159H211Z" fill="#b28c55" />
      <path d="M201 153H207V155H201ZM212 150H217V152H212Z" fill="#e5c985" />
      {/* Smith's anvil, campfire and the waypoint chest. */}
      <path d="M65 148H78V156H65ZM60 142H84V147H60V140H66V137H79V140H87V143H84Z" fill="#1a292c" />
      <path d="M61 140H84V143H61Z" fill="#a3b4a2" />
      <path d="M67 149H77V153H67Z" fill="#677d71" />
      <path d="M84 169H108V174H84V167H88V164H104V167H108V169Z" fill="#1b2c2a" />
      <path d="M87 168H106V171H87ZM91 173H103V176H91Z" fill="#9c8258" />
      <path d="M93 148H96V156H99V151H102V159H105V167H99V170H92V167H89V159H92Z" fill="#c87743" />
      <path d="M95 157H98V162H101V167H94V163H92V161H95Z" fill="#ffe09a" />
      <path d="M160 153H177V171H160Z" fill="#213632" />
      <path d="M162 154H175V167H162Z" fill="#8c7048" />
      <path d="M161 158H177V161H161ZM165 153H168V170H165ZM172 153H174V170H172Z" fill="#d3ad69" />
      <rect x="167" y="158" width="5" height="5" fill="#2e4c44" />
      <Torch x={88} y={119} />
      <Torch x={163} y={120} />
      <Torch x={44} y={154} />
      <Torch x={220} y={171} />
      {Array.from({ length: 24 }, (_, i) => (
        <g key={i} transform={`translate(${9 + ((i * 31) % 235)} ${126 + ((i * 17) % 61)})`}>
          <path d="M0 3H2V0H3V5H0ZM4 2H6V5H4Z" fill={i % 2 ? '#6c8051' : '#476b48'} />
        </g>
      ))}
      <Pine x={8} y={133} size={1.5} />
      <Pine x={244} y={144} size={1.6} />
      <Pine x={-2} y={194} size={1.4} />
      <Pine x={248} y={201} size={1.4} />
      {[
        [106, 69],
        [138, 91],
        [117, 105],
        [131, 54],
        [85, 158],
        [185, 138],
        [207, 81],
      ].map(([x, y], i) => (
        <rect
          key={i}
          className="mote"
          x={x}
          y={y}
          width="1"
          height="1"
          fill="#d7dba4"
          style={{ animationDelay: `${i * 0.4}s` }}
        />
      ))}
    </svg>
  );
}
