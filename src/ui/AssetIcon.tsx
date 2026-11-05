import type { AssetVisual, ItemVisualIdentity } from '../data/visuals';
import { getItemVisual, SKILL_VISUALS } from '../data/visuals';
import { PET_ART } from '../data/petVisuals';
import { useState } from 'react';
import { SKILL_ART } from '../data/skillArt';

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
  const art = SKILL_ART[skillId];
  const [failed, setFailed] = useState('');
  if (art && failed !== art.src)
    return (
      <span
        className="asset-icon skill-illustration"
        data-visual={skillId}
        aria-hidden="true"
        style={{ width: size, height: size }}
      >
        <img
          src={art.src}
          alt=""
          draggable={false}
          onError={() => setFailed(art.src)}
          style={{ left: `${-art.column * 100}%`, top: `${-art.row * 100}%` }}
        />
      </span>
    );
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
