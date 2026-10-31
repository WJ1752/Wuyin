import type { AssetVisual, ItemVisualIdentity } from '../data/visuals';
import { getItemVisual, SKILL_VISUALS } from '../data/visuals';

/** One renderer keeps the archive, paper doll, inventory and action bar in sync. */
export function AssetIcon({ visual, size = 32 }: { visual: AssetVisual; size?: number }) {
  return (
    <svg
      className="asset-icon"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke={visual.color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-visual={visual.key}
    >
      {visual.layers.map((layer, index) => (
        <path
          key={index}
          d={layer.path}
          transform={layer.transform}
          stroke={layer.accent ? '#f7ecce' : undefined}
          strokeWidth={layer.accent ? 3 : undefined}
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
