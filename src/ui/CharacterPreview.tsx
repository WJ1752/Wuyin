import type { ClassId } from '../core/types';
import type { WornArt } from '../data/characterArt';
import { HeroArt } from './SceneArt';

export function CharacterPreview({ classId, equipment }: { classId: ClassId; equipment: WornArt }) {
  return (
    <div className="character-rig-preview" role="img" aria-label="当前职业造型">
      <HeroArt classId={classId} equipment={equipment} />
    </div>
  );
}
