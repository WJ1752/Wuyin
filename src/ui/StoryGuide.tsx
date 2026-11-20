import { useEffect } from 'react';
import { audio } from '../audio/SynthAudio';
import { CLASSES } from '../data/classes';
import { CAMPAIGN_CHAPTERS, CAMPAIGN_FINALE, type CampaignChapter } from '../data/campaign';
import { useGameStore } from '../state/gameStore';
import { HeroArt } from './SceneArt';
import { useDialog } from './useDialog';
import './character-story.css';

export type PrologueChapter = 'arrival' | 'mentor' | 'first-clear';
const lines: Record<PrologueChapter, { title: string; text: readonly string[] }> = {
  arrival: {
    title: '雾墙之外',
    text: [
      '你在一盏将熄的灯下醒来。石墙外，白雾已经吞没山路，营地的人听不见亲友回家的脚步。',
      '守门人把一枚铜铃交给你。“这是旧路的信号。带上它，去瞭望塔找导师岚。”',
    ],
  },
  mentor: {
    title: '守灯人的约定',
    text: [
      '岚指着铜铃上的刻痕。“沿旧路设有守望灯。只要有一盏灯重新亮起，失散的人就能听见回营的信号。”',
      '从营地选择「出征」，独自进入第 1 层。点敌集火，拖动移动。离开预警范围，收集紫色进度球，再击败守门者。',
    ],
  },
  'first-clear': {
    title: CAMPAIGN_CHAPTERS[0].title,
    text: CAMPAIGN_CHAPTERS[0].report,
  },
};

export const CAMPAIGN_ENDING_ART = 'assets/story/guarded-road.webp';

export function StoryGuide({
  chapter,
  onAdvance,
  onSkip,
}: {
  chapter: PrologueChapter | CampaignChapter;
  onAdvance: () => void;
  onSkip: () => void;
}) {
  const save = useGameStore((state) => state.save);
  const story =
    typeof chapter === 'string' ? lines[chapter] : { title: chapter.title, text: chapter.report };
  const ending = typeof chapter !== 'string' && chapter.stage === CAMPAIGN_FINALE.stage;
  const readingReport = typeof chapter !== 'string' || chapter === 'first-clear';
  const dialog = useDialog(true, onSkip);
  const hero = CLASSES.find((entry) => entry.id === save.classId)!;
  useEffect(() => {
    if (!ending) return;
    audio.setTrack('ending');
    return () => audio.setTrack('town');
  }, [ending]);
  return (
    <div className="story-backdrop">
      <section
        ref={dialog}
        tabIndex={-1}
        className={`story-book pixel-parchment${ending ? ' campaign-ending' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-title"
      >
        <span className="eyebrow">{ending ? '主线结局' : `${hero.name}的远征手记`}</span>
        <h2 id="story-title">{story.title}</h2>
        {ending ? (
          <figure className="story-plate">
            <img
              className="campaign-ending-art"
              src={CAMPAIGN_ENDING_ART}
              alt="黎明时亮起灯火的营地归路"
            />
          </figure>
        ) : (
          <div className="story-art story-art--painted" aria-hidden="true">
            <HeroArt classId={save.classId} />
            <span>{chapter === 'arrival' ? '守望者营地' : '星语导师 · 岚'}</span>
          </div>
        )}
        <div className="story-lines">
          {story.text.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <footer>
          {typeof chapter === 'string' && !readingReport && (
            <button className="ghost-button" data-sound="folio" onClick={onSkip}>
              先进入营地
            </button>
          )}
          <button className="gold-button" data-sound="folio" onClick={onAdvance}>
            {readingReport ? '合上手记' : chapter === 'mentor' ? '进入守望者营地' : '去见导师岚'}
          </button>
        </footer>
      </section>
    </div>
  );
}
