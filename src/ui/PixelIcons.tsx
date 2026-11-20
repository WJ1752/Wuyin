import {
  ArrowDown as ArrowDownGlyph,
  ArrowLeft as ArrowLeftGlyph,
  ArrowRight as ArrowRightGlyph,
  ArrowUp as ArrowUpGlyph,
  BookOpen as BookGlyph,
  Check as CheckGlyph,
  ChevronLeft as ChevronLeftGlyph,
  ChevronRight as ChevronRightGlyph,
  CircleDot as CircleDotGlyph,
  Coins as CoinsGlyph,
  Compass as CompassGlyph,
  Crown as CrownGlyph,
  Diamond as DiamondGlyph,
  Dices as DicesGlyph,
  Download as DownloadGlyph,
  FlameKindling as CampfireGlyph,
  FlaskConical as FlaskGlyph,
  Footprints as FootprintsGlyph,
  Gem as GemGlyph,
  Hammer as HammerGlyph,
  Hand as HandGlyph,
  Heart as HeartGlyph,
  Hexagon as HexagonGlyph,
  Lock as LockGlyph,
  Maximize as MaximizeGlyph,
  Minimize as MinimizeGlyph,
  Moon as MoonGlyph,
  Package as PackageGlyph,
  Pause as PauseGlyph,
  PawPrint as PawGlyph,
  Play as PlayGlyph,
  RotateCcw as RotateGlyph,
  Scroll as ScrollGlyph,
  Settings as SettingsGlyph,
  Shield as ShieldGlyph,
  Shirt as ShirtGlyph,
  Skull as SkullGlyph,
  Sparkles as SparklesGlyph,
  Sword as SwordGlyph,
  Swords as SwordsGlyph,
  Upload as UploadGlyph,
  User as UserGlyph,
  Volume2 as VolumeGlyph,
  VolumeX as VolumeMutedGlyph,
  WandSparkles as WandGlyph,
  Wind as WindGlyph,
  X as CloseGlyph,
  Zap as ZapGlyph,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';

function gameIcon(Glyph: LucideIcon, frame?: number) {
  return function GameIcon(props: LucideProps & { title?: string }) {
    const { className, title, size = 24, ...attributes } = props;
    const common = {
      ...attributes,
      className: ['pixel-ui-icon', frame === undefined ? '' : 'pixel-ui-icon-atlas', className]
        .filter(Boolean)
        .join(' '),
      'aria-hidden': title ? undefined : (props['aria-hidden'] ?? true),
      'aria-label': props['aria-label'] ?? title,
      role: title ? 'img' : props.role,
    };
    if (frame !== undefined) {
      const x = (frame % 4) * 24;
      const y = Math.floor(frame / 4) * 24;
      return (
        <svg {...common} width={size} height={size} viewBox={`${x} ${y} 24 24`} focusable="false">
          {title && <title>{title}</title>}
          <image href="./assets/ui/pixel-nav.webp" width="96" height="96" />
        </svg>
      );
    }
    return (
      <Glyph {...common} size={size} strokeWidth={props.strokeWidth ?? 1.7} focusable="false">
        {title && <title>{title}</title>}
      </Glyph>
    );
  };
}

export const ArrowLeft = gameIcon(ArrowLeftGlyph);
export const ArrowRight = gameIcon(ArrowRightGlyph);
export const ArrowUp = gameIcon(ArrowUpGlyph);
export const ArrowDown = gameIcon(ArrowDownGlyph);
export const ChevronLeft = gameIcon(ChevronLeftGlyph);
export const ChevronRight = gameIcon(ChevronRightGlyph);
export const Sword = gameIcon(SwordGlyph);
export const Swords = gameIcon(SwordsGlyph, 0);
export const BookOpen = gameIcon(BookGlyph, 2);
export const Shield = gameIcon(ShieldGlyph, 1);
export const Skull = gameIcon(SkullGlyph);
export const Hammer = gameIcon(HammerGlyph, 4);
export const Gem = gameIcon(GemGlyph, 6);
export const Diamond = gameIcon(DiamondGlyph, 6);
export const Wind = gameIcon(WindGlyph);
export const Zap = gameIcon(ZapGlyph);
export const Sparkles = gameIcon(SparklesGlyph);
export const Footprints = gameIcon(FootprintsGlyph);
export const PawPrint = gameIcon(PawGlyph, 7);
export const Check = gameIcon(CheckGlyph);
export const X = gameIcon(CloseGlyph);
export const Play = gameIcon(PlayGlyph);
export const Pause = gameIcon(PauseGlyph);
export const Heart = gameIcon(HeartGlyph);
export const Crown = gameIcon(CrownGlyph, 9);
export const Coins = gameIcon(CoinsGlyph, 12);
export const FlaskConical = gameIcon(FlaskGlyph, 14);
export const Hexagon = gameIcon(HexagonGlyph, 5);
export const Compass = gameIcon(CompassGlyph, 3);
export const Moon = gameIcon(MoonGlyph);
export const Settings = gameIcon(SettingsGlyph, 10);
export const Volume2 = gameIcon(VolumeGlyph);
export const VolumeX = gameIcon(VolumeMutedGlyph);
export const Maximize = gameIcon(MaximizeGlyph);
export const Minimize = gameIcon(MinimizeGlyph);
export const Shirt = gameIcon(ShirtGlyph);
export const Hand = gameIcon(HandGlyph);
export const CircleDot = gameIcon(CircleDotGlyph);
export const WandSparkles = gameIcon(WandGlyph);
export const Dices = gameIcon(DicesGlyph);
export const Lock = gameIcon(LockGlyph);
export const Package = gameIcon(PackageGlyph, 8);
export const Download = gameIcon(DownloadGlyph);
export const Upload = gameIcon(UploadGlyph);
export const RotateCcw = gameIcon(RotateGlyph);
export const User = gameIcon(UserGlyph, 11);
export const Campfire = gameIcon(CampfireGlyph, 13);
export const Scroll = gameIcon(ScrollGlyph, 15);
