import type { ClassId } from '../core/types';
import { HeroArt } from './SceneArt';

/** The equipment panel keeps the full class artwork independent of worn gear. */
export function CharacterPreview({ classId }: { classId: ClassId }) {
  return (
    <div className="character-rig-preview" role="img" aria-label="当前职业造型">
      <HeroArt classId={classId} />
    </div>
  );
}
