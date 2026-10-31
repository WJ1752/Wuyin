import { useId } from 'react';
import { Pine, Torch } from './SceneArt';

function Crate({ x, y, size = 1 }: { x: number; y: number; size?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <path d="M0 4H32V29H0Z" fill="#654d39" />
      <path d="M0 0H28L32 4H0Z" fill="#a08456" />
      <path d="M2 6H29V25H2Z" fill="#8c6c47" />
      <path d="M3 7H28V9H3ZM3 14H28V16H3ZM3 22H28V24H3Z" fill="#5f4b35" />
      <path d="M1 4H5V28H1ZM26 4H30V28H26ZM3 5H28V8H3ZM3 24H28V27H3Z" fill="#ba9861" />
      <path d="M7 7H11L25 24H21Z" fill="#b18c59" />
      <path d="M1 7H3V9H1ZM27 7H29V9H27ZM1 24H3V26H1ZM27 24H29V26H27Z" fill="#3f4740" />
    </g>
  );
}

function Barrel({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M4 0H21V3H24V26H21V29H4V26H1V3H4Z" fill="#604b36" />
      <path d="M5 2H20V27H5Z" fill="#987649" />
      <path d="M9 3H11V26H9ZM16 3H18V26H16Z" fill="#6d573a" />
      <path d="M2 6H23V10H2ZM2 20H23V24H2Z" fill="#41534c" />
      <path d="M4 7H21V8H4ZM4 21H21V22H4Z" fill="#8c9a7d" />
      <path d="M5 0H20V3H5Z" fill="#b0945e" />
    </g>
  );
}

function Grass({ x, y, color = '#607557' }: { x: number; y: number; color?: string }) {
  return <path d={`M${x} ${y}h3v-7h2v5h3v-11h2v9h3v-5h2v9h-15Z`} fill={color} />;
}

function Window({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0H25V27H0Z" fill="#233330" />
      <path d="M3 3H22V23H3Z" fill="#c79659" />
      <path d="M5 5H11V12H5ZM14 5H20V12H14ZM5 15H11V21H5Z" fill="#f1cc7b" />
      <path d="M0 26H25V30H0Z" fill="#b09563" />
    </g>
  );
}

function Fence({ x, y, width }: { x: number; y: number; width: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M0 9H${width}V14H0ZM0 23H${width}V28H0Z`} fill="#6e5c43" />
      <path d={`M0 9H${width}V11H0ZM0 23H${width}V25H0Z`} fill="#a28b5b" />
      {Array.from({ length: Math.floor(width / 24) + 1 }, (_, i) => (
        <g key={i} transform={`translate(${i * 24} 0)`}>
          <path d="M0 3H2V0H6V3H8V36H0Z" fill="#8d7650" />
          <path d="M1 5H3V34H1Z" fill="#c0a174" />
        </g>
      ))}
    </g>
  );
}

/** Authored town architecture uses the same normalized ground plane as the hall actors. */
export function HallScene() {
  const id = useId().replace(/:/g, '');
  const paving = `${id}-paving`,
    roof = `${id}-roof`,
    wall = `${id}-wall`;
  return (
    <svg
      className="town-scene hall-scene"
      viewBox="0 0 640 600"
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      role="img"
      aria-label="雾隐暮林营地：黑松遗迹、星语藏书屋、遗物祭坛、记录站、铁匠熔炉、秘藏摊、共享仓库与伙伴兽栏，围绕篝火和石路广场"
    >
      <defs>
        <pattern id={paving} width="36" height="24" patternUnits="userSpaceOnUse">
          <rect width="36" height="24" fill="#3b5147" />
          <path d="M0 0H36V2H0ZM0 12H36V14H0ZM17 0H19V12H17ZM0 12H2V24H0Z" fill="#263f3c" />
          <path d="M3 3H15V5H3ZM22 16H33V18H22ZM8 21H14V22H8Z" fill="#546850" />
          <path d="M22 5H27V7H22ZM4 16H9V18H4Z" fill="#334b40" />
        </pattern>
        <pattern id={roof} width="20" height="14" patternUnits="userSpaceOnUse">
          <rect width="20" height="14" fill="#2d5455" />
          <path d="M0 0H20V3H0ZM0 7H20V9H0ZM9 0H11V7H9ZM0 7H2V14H0Z" fill="#152e36" />
          <path d="M2 3H7V4H2ZM12 10H18V11H12Z" fill="#527569" />
        </pattern>
        <pattern id={wall} width="22" height="12" patternUnits="userSpaceOnUse">
          <rect width="22" height="12" fill="#6d7359" />
          <path d="M0 0H22V2H0ZM10 0H12V12H10Z" fill="#394b40" />
          <path d="M2 3H8V5H2ZM14 3H19V4H14Z" fill="#929777" />
        </pattern>
      </defs>
      {/* Far silhouettes, broken watchtowers and strips of low forest mist. */}
      <rect width="640" height="600" fill="#162c32" />
      <rect width="640" height="112" fill="#152634" />
      <path
        d="M0 68H26V58H54V65H83V45H98V55H127V66H161V56H192V65H222V47H244V64H279V73H320V65H349V53H374V67H406V55H431V44H455V64H493V56H519V70H557V51H577V65H609V58H640V151H0Z"
        fill="#213843"
      />
      <path d="M39 45H48V24H63V45H72V88H39ZM562 50H571V29H588V50H596V96H562Z" fill="#263f45" />
      <path
        d="M43 25H47V21H53V26H59V21H64V32H43ZM567 30H573V25H578V31H584V26H589V37H567Z"
        fill="#51645b"
      />
      <path d="M51 49H58V66H51ZM576 53H582V71H576Z" fill="#102833" />
      <path
        d="M510 15H527V18H533V23H537V35H533V40H527V43H511V39H505V34H502V23H506V18H510Z"
        fill="#a5bc9b"
      />
      <path d="M519 15H527V18H533V23H537V35H531V31H526V25H522V21H519Z" fill="#1b303b" />
      {[
        [20, 20],
        [83, 16],
        [125, 30],
        [174, 10],
        [215, 33],
        [385, 20],
        [432, 8],
        [475, 30],
        [578, 12],
        [617, 28],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y}h3v3h-3Z`} fill={i % 3 === 0 ? '#b8c4a2' : '#6f8b8b'} />
      ))}
      {Array.from({ length: 26 }, (_, i) => (
        <Pine
          key={`far${i}`}
          x={i * 27 - 6}
          y={118 + ((i * 13) % 20)}
          size={1.7 + (i % 4) * 0.2}
          distant
        />
      ))}
      <path
        d="M0 105H94V109H167V106H241V111H407V107H523V112H640V120H535V117H426V121H224V116H102V120H0Z"
        fill="#58736a"
        opacity=".26"
      />
      <path
        d="M22 141H165V144H240V149H409V144H557V148H630V153H522V150H362V155H191V150H22Z"
        fill="#7b9481"
        opacity=".16"
      />
      <path
        d="M0 160H44V153H84V166H149V158H203V167H251V155H292V165H370V157H424V166H479V159H542V167H594V157H640V600H0Z"
        fill="#213c35"
      />
      {/* The old rift gate is a small landmark above town, rather than the town itself. */}
      <path d="M267 174V103H273V87H284V72H302V65H334V72H351V87H362V104H368V174Z" fill="#102b32" />
      <path
        d="M274 172V104H280V90H290V79H306V73H331V80H345V91H355V106H361V172H347V107H341V96H330V89H307V96H295V108H290V172Z"
        fill="#65795f"
      />
      <path
        d="M277 170V105H283V92H294V83H309V77H330V82H310V89H297V99H289V112H285V170Z"
        fill="#a1aa7b"
      />
      <path d="M297 169V113H303V103H312V97H326V104H336V116H341V169Z" fill="#28514e" />
      <path
        d="M309 167V145H314V134H310V121H316V109H322V122H319V138H326V153H320V168Z"
        fill="#81b99a"
      />
      <path
        d="M315 162V150H320V140H316V125H320V115H323V130H322V144H327V157H323V167Z"
        fill="#c5e2b2"
      />
      <path
        d="M282 116H287V121H282ZM282 135H287V140H282ZM351 116H356V121H351ZM351 136H356V141H351Z"
        fill="#d6ca83"
      />
      <path d="M267 173H369V180H267ZM257 182H378V188H257ZM246 190H389V197H246Z" fill="#708269" />
      <path d="M267 180H369V183H267ZM257 188H378V191H257ZM246 197H389V201H246Z" fill="#203c39" />
      <Torch x={252} y={151} />
      <Torch x={383} y={151} />
      {/* Wide, uninterrupted walking lanes connect each workshop to the central square. */}
      <path
        d="M277 199H361V252H385V276H434V302H640V421H535V450H489V491H529V600H109V496H154V453H111V422H0V303H201V275H250V250H277Z"
        fill="#122c2d"
      />
      <path
        d="M282 201H356V258H381V281H432V309H640V413H530V444H482V496H521V600H117V502H161V446H116V414H0V311H207V282H255V257H282Z"
        fill={`url(#${paving})`}
      />
      <path
        d="M242 299H397V315H433V337H450V406H424V427H391V442H243V429H215V411H195V340H215V317H242Z"
        fill="#56705a"
      />
      <path
        d="M247 305H391V321H425V343H442V401H417V421H386V435H249V422H222V405H203V346H222V323H247Z"
        fill={`url(#${paving})`}
      />
      <path
        d="M257 322H381V325H257ZM222 350H225V394H222ZM413 350H416V394H413ZM260 416H379V419H260Z"
        fill="#9caa76"
        opacity=".55"
      />
      <path
        d="M270 244H276V264H270ZM363 245H369V267H363ZM309 277H312V291H326V294H309ZM388 373H403V376H398V388H395V376H388ZM232 399H243V403H249V413H246V405H232ZM165 354H181V357H173V365H170V357H165ZM486 355H501V358H495V367H492V358H486Z"
        fill="#243b35"
      />
      {/* Star-language study: steep blue tile roof, lit reading window and outdoor books. */}
      <g>
        <path d="M77 182H205V255H77Z" fill="#182e30" />
        <path d="M83 181H199V245H83Z" fill={`url(#${wall})`} />
        <path d="M83 184H91V245H83ZM191 184H199V245H191ZM90 216H192V221H90Z" fill="#4d493c" />
        <path
          d="M66 185V174H76V161H88V148H105V135H126V124H157V135H177V148H193V161H207V174H218V185Z"
          fill="#122d34"
        />
        <path
          d="M72 177H81V165H93V152H111V140H130V130H153V141H172V154H189V167H201V177H211V182H72Z"
          fill={`url(#${roof})`}
        />
        <path d="M72 180H211V187H72ZM126 126H157V130H126Z" fill="#9c9d70" />
        <path d="M170 136V114H184V149H179V142H174V136Z" fill="#71765b" />
        <path d="M167 112H187V118H167ZM173 106H181V109H173ZM178 99H188V102H178Z" fill="#658176" />
        <Window x={94} y={190} />
        <path d="M133 192H159V245H133Z" fill="#263b36" />
        <path d="M138 197H154V242H138Z" fill="#69705a" />
        <path d="M149 217H152V220H149Z" fill="#e4bd6e" />
        <path d="M171 193H185V235H171Z" fill="#263e39" />
        <path d="M173 195H177V233H173ZM179 195H183V233H179Z" fill="#b7956d" />
        <path d="M75 246H205V255H75ZM70 257H212V263H70Z" fill="#8b8d69" />
        <path d="M192 216H222V246H192Z" fill="#6b533f" />
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`M${196 + i * 5} ${220 + (i % 2) * 3}h3v22h-3Z`}
            fill={['#b39169', '#7ba59a', '#ac7e7c'][i % 3]}
          />
        ))}
        <Torch x={67} y={225} />
      </g>
      {/* Open-air relic shrine, copper braces and a hovering crystalline cube. */}
      <g>
        <path d="M267 240H361V252H267ZM276 230H352V242H276Z" fill="#7f8c6d" />
        <path d="M277 233H351V237H277ZM267 248H361V254H267Z" fill="#2a4b43" />
        <path d="M284 208H345V232H284Z" fill="#3a5650" />
        <path d="M290 211H339V228H290Z" fill="#587a63" />
        <path d="M300 215H305V222H300ZM312 214H317V223H312ZM324 215H329V222H324Z" fill="#c7c58b" />
        <path d="M313 164L335 176V199L314 211L292 198V176Z" fill="#173943" />
        <path d="M314 169L330 178L314 188L297 178Z" fill="#b6ddc2" />
        <path d="M297 182L311 191V205L297 196Z" fill="#63aa9c" />
        <path d="M316 191L330 182V196L316 205Z" fill="#3e786f" />
        <path
          d="M312 153H316V158H312ZM277 181H282V185H277ZM347 186H352V190H347ZM287 160H291V164H287ZM338 158H342V162H338Z"
          fill="#95cdb3"
        />
        <path d="M274 206H278V217H274ZM350 206H354V217H350Z" fill="#ccb87b" />
      </g>
      {/* Record keeper's pavilion: parchment canopy, hanging pennants and a map board. */}
      <g>
        <path d="M427 190H560V252H427Z" fill="#1c3436" />
        <path d="M433 184H439V252H433ZM548 184H554V252H548Z" fill="#a28a5b" />
        <path d="M425 174L447 146H536L563 174V190H425Z" fill="#293f3e" />
        <path d="M430 173L450 151H531L554 173V182H430Z" fill="#a28b5f" />
        <path d="M444 158H538V161H444ZM437 169H548V172H437Z" fill="#c2aa77" />
        <path d="M425 183H562V191H425Z" fill="#705d43" />
        <path d="M455 192H532V237H455Z" fill="#aa8c5e" />
        <path d="M460 197H527V232H460Z" fill="#d0c093" />
        <path
          d="M466 202H481V206H488V215H498V210H509V220H521V223H505V217H497V221H483V213H475V207H466Z"
          fill="#778a72"
        />
        <path d="M469 218H477V220H469ZM492 202H505V204H492ZM511 226H520V228H511Z" fill="#9a8a67" />
        <path
          d="M435 191H445V208L440 213L435 208ZM543 191H553V208L548 213L543 208Z"
          fill="#8c6575"
        />
        <path d="M438 194H441V203H438ZM546 194H549V203H546Z" fill="#d8bb7f" />
        <Crate x={539} y={231} size={0.7} />
        <Torch x={420} y={228} />
      </g>
      {/* Ember smithy: stone chimney, hot furnace, weathered roof and tool rack. */}
      <g>
        <path d="M0 310H127V396H0Z" fill="#243733" />
        <path d="M0 314H72V382H0Z" fill={`url(#${wall})`} />
        <path d="M16 319H55V374H16Z" fill="#283c36" />
        <path d="M22 327H49V370H22Z" fill="#a45c39" />
        <path d="M28 334H44V370H28Z" fill="#e6a452" />
        <path d="M33 347H40V370H33Z" fill="#ffe0a0" />
        <path d="M16 371H55V378H16ZM7 382H66V388H7Z" fill="#9c8e69" />
        <path d="M15 313V278H55V313Z" fill="#6b705b" />
        <path d="M11 274H59V282H11Z" fill="#95957a" />
        <path
          d="M24 265H48V269H24ZM31 256H55V260H31ZM24 248H42V251H24Z"
          fill="#708478"
          opacity=".65"
        />
        <path d="M59 309L73 285H125L148 309V320H59Z" fill="#203b3b" />
        <path d="M66 307L78 290H121L137 307V313H66Z" fill={`url(#${roof})`} />
        <path d="M62 316H145V322H62Z" fill="#9a9165" />
        <path d="M74 323H80V387H74ZM130 323H136V387H130Z" fill="#826c48" />
        <path d="M86 329H124V334H86ZM91 334H95V351H91ZM111 334H115V351H111Z" fill="#b6ad80" />
        <path d="M87 348H101V355H87ZM107 346H119V352H107Z" fill="#5d756f" />
        <path d="M78 370H123V378H113L107 383H94L88 378H78ZM90 383H111V392H90Z" fill="#607976" />
        <path d="M80 370H123V373H80Z" fill="#a4b39b" />
        <path d="M0 395H140V402H0Z" fill="#6e7960" />
        <Barrel x={145} y={370} />
        <path d="M53 384H58V387H53ZM60 378H63V381H60ZM44 391H48V394H44Z" fill="#edbc6f" />
      </g>
      {/* Mia's secret stall: striped canvas, hanging charms and packed display shelves. */}
      <g>
        <path d="M494 315H637V389H494Z" fill="#243638" />
        <path d="M493 311L509 287H621L640 311V325H493Z" fill="#303a3e" />
        <path d="M500 308L514 292H617L632 308V318H500Z" fill="#7c6174" />
        {[0, 1, 2, 3].map((i) => (
          <path key={i} d={`M${511 + i * 30} 295h12l6 15v10h-18Z`} fill="#b29983" />
        ))}
        <path d="M493 319H638V327H493Z" fill="#bb9c72" />
        <path d="M501 327H507V394H501ZM626 327H632V394H626Z" fill="#a08256" />
        <path d="M518 336H615V367H518Z" fill="#4b4a40" />
        <path d="M520 337H613V340H520ZM520 356H613V360H520Z" fill="#b49465" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i} transform={`translate(${524 + i * 15} 341)`}>
            <path d="M3 0H8V3H10V12H0V3H3Z" fill={['#98b5a4', '#c29c71', '#b7a0c5'][i % 3]} />
            <path d="M3 0H8V2H3Z" fill="#e2cc91" />
          </g>
        ))}
        <path d="M512 370H620V394H512Z" fill="#715a44" />
        <path d="M510 368H622V374H510Z" fill="#c4a46f" />
        <path d="M520 378H612V380H520ZM520 387H612V389H520Z" fill="#9b7c52" />
        <path
          d="M526 326V333H531V340H537V333H541V326ZM593 326V333H598V341H604V333H608V326Z"
          fill="#d8bd7e"
        />
        <Crate x={633} y={372} size={0.9} />
        <Barrel x={472} y={376} />
        <Torch x={491} y={364} />
      </g>
      {/* Low storage depot leaves the foreground and actors' feet unobstructed. */}
      <g>
        <path d="M87 491H228V544H87Z" fill="#263a33" />
        <path d="M94 492H102V540H94ZM216 492H224V540H216Z" fill="#89714d" />
        <path d="M88 480H225L236 493H78Z" fill="#67745c" />
        <path d="M90 484H223V487H90Z" fill="#a2a276" />
        <Crate x={108} y={494} />
        <Crate x={145} y={494} />
        <Crate x={180} y={506} size={1.1} />
        <Crate x={127} y={469} size={0.8} />
        <Barrel x={76} y={517} />
        <Barrel x={228} y={518} />
        <path d="M108 533H216V540H108ZM101 544H225V550H101Z" fill="#9c9067" />
        <path d="M107 491V467H119V464H131V467H143V481H134V477H117V491Z" fill="#b1975e" />
        <path d="M117 469H130V475H117Z" fill="#233b36" />
      </g>
      {/* Animal keep: warm straw shelter, irregular fence and a tiny resting fox. */}
      <g>
        <path d="M395 486H566V547H395Z" fill="#4d6044" />
        <path d="M404 493H556V541H404Z" fill="#65714a" />
        <path d="M486 478H548V522H486Z" fill="#786344" />
        <path d="M477 479L489 456H541L556 479Z" fill="#a49b67" />
        <path d="M485 472H548V475H485ZM490 463H540V466H490Z" fill="#c7b77a" />
        <path d="M505 493H529V522H505Z" fill="#26392e" />
        <path d="M408 516H435V524H430V530H413V526H405V520H408Z" fill="#b88758" />
        <path d="M410 510H416V518H410ZM429 510H435V519H429Z" fill="#b88758" />
        <path d="M413 519H431V523H413Z" fill="#e0c58a" />
        <path d="M402 526H413V529H398V520H402Z" fill="#d4a96c" />
        <Fence x={395} y={483} width={72} />
        <Fence x={530} y={485} width={38} />
        <Fence x={396} y={536} width={168} />
        <path d="M450 509H457V512H450ZM481 531H490V534H481ZM544 522H552V525H544Z" fill="#c0b477" />
        <path d="M557 509H575V532H557Z" fill="#574e3c" />
        <path d="M559 511H573V517H559Z" fill="#8ba58b" />
      </g>
      {/* Central hearth and worn compass inlay mark the clear meeting space. */}
      <path d="M298 355H337V360H346V370H338V376H299V372H290V361H298Z" fill="#182d2f" />
      <path
        d="M300 354H310V359H300ZM325 354H336V359H325ZM291 362H298V370H291ZM339 362H346V370H339ZM301 372H312V377H301ZM324 372H335V377H324Z"
        fill="#99a07b"
      />
      <path d="M303 363H336V369H303ZM308 358H314V374H308ZM327 358H333V374H327Z" fill="#77583b" />
      <path d="M309 363V351H313V341H317V326H321V340H326V346H330V356H333V365Z" fill="#c77443" />
      <path d="M314 363V352H318V342H322V353H326V365Z" fill="#f2be69" />
      <path d="M318 361V353H322V364H318Z" fill="#ffe8ad" />
      <path d="M315 318H319V322H315ZM326 332H329V335H326ZM308 339H311V342H308Z" fill="#e5aa65" />
      <path d="M308 467H326V470H332V480H326V484H309V481H302V471H308Z" fill="#758a69" />
      <path d="M316 457H320V469L326 476H319V490H315V477H309L316 469Z" fill="#b3b082" />
      {/* Edge trees, moss, path cracks and discarded stones retain an organic forest boundary. */}
      <Pine x={16} y={246} size={2.2} />
      <Pine x={616} y={248} size={2.1} />
      <Pine x={36} y={468} size={1.7} />
      <Pine x={605} y={472} size={1.9} />
      <Pine x={19} y={588} size={2.2} />
      <Pine x={621} y={593} size={2.4} />
      {[
        [53, 275],
        [201, 274],
        [250, 210],
        [386, 215],
        [454, 281],
        [599, 278],
        [68, 436],
        [179, 440],
        [484, 446],
        [583, 438],
        [56, 552],
        [259, 558],
        [373, 558],
        [583, 563],
        [235, 487],
        [371, 478],
        [275, 292],
        [386, 293],
      ].map(([x, y], i) => (
        <Grass key={i} x={x} y={y} color={i % 3 === 0 ? '#78905d' : '#536f50'} />
      ))}
      {[
        [61, 447],
        [201, 458],
        [420, 281],
        [388, 454],
        [254, 522],
        [579, 455],
        [570, 570],
        [40, 568],
        [263, 278],
        [368, 271],
      ].map(([x, y], i) => (
        <g key={i}>
          <path d={`M${x} ${y}h12v4h5v6h-20v-6h3Z`} fill="#526c59" />
          <path d={`M${x + 2} ${y + 1}h8v2h-8Z`} fill="#8d9b74" />
        </g>
      ))}
      <path
        d="M127 422H135V428H142V431H132V426H127ZM524 422H515V428H508V431H518V426H524ZM167 575H176V579H183V586H180V581H167ZM438 567H449V570H444V580H441V570H438Z"
        fill="#223d35"
      />
      <Torch x={191} y={309} />
      <Torch x={448} y={310} />
      <Torch x={270} y={525} />
      <Torch x={371} y={526} />
    </svg>
  );
}
