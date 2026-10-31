import type { AssetVisual, ItemVisualIdentity } from '../data/visuals';
import { getItemVisual, SKILL_VISUALS } from '../data/visuals';
import { PET_ART } from '../data/petVisuals';

/** One renderer keeps the archive, paper doll, inventory and action bar in sync. */
export function AssetIcon({ visual, size = 32 }: { visual: AssetVisual; size?: number }) {
  return (
    <svg
      className="asset-icon"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill={visual.color}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      data-visual={visual.key}
    >
      {visual.layers.map((layer, index) => (
        <path
          key={index}
          d={layer.path}
          transform={layer.transform}
          fill={layer.fill ?? visual.color}
        />
      ))}
    </svg>
  );
}

export function ItemIcon({ item, size = 32 }: { item: ItemVisualIdentity; size?: number }) {
  return <AssetIcon visual={getItemVisual(item)} size={size} />;
}

export function SkillIcon({ skillId, size = 32 }: { skillId: string; size?: number }) {
  const visual = SKILL_VISUALS[skillId];
  return visual ? <AssetIcon visual={visual} size={size} /> : null;
}

/** Detailed companion portraits reuse the exact transparent sprite shown in battle. */
export function PetIcon({ petId, size = 84 }: { petId: string; size?: number }) {
  const art = PET_ART[petId];
  return art ? (
    <img
      className="asset-icon pet-art"
      src={art.src}
      width={size}
      height={size}
      alt=""
      draggable={false}
    />
  ) : null;
}
