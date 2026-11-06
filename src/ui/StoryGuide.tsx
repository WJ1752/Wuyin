import { useState } from 'react';
import { CLASSES } from '../data/classes';
import { useGameStore } from '../state/gameStore';
import { HeroArt } from './SceneArt';
import { useDialog } from './useDialog';
import { ArrowLeft } from './PixelIcons';
import './character-story.css';

type Chapter = 'arrival' | 'mentor' | 'first-clear' | 'complete';
const lines: Record<Chapter, { title: string; pages: string[][] }> = {
  arrival: {
    title: '雾墙之外',
    pages: [
      [
        '你在一盏将熄的灯下醒来。石墙外，白雾像潮水一样吞没山路。',
        '胸前的旧徽记刻着一个名字——你的名字。除此之外，记忆只剩断裂的回声。',
      ],
      [
        '营地守门人把一枚铜铃交给你。“雾里有东西正在寻找出口。若你听见铃声，就回来。”',
        '远处的瞭望塔亮起微光。有人在那里等你。',
      ],
    ],
  },
  mentor: {
    title: '守灯人的约定',
    pages: [
      [
        '导师岚把地图压在桌上，指向雾中一条狭窄裂隙。“先探明路，再谈拯救世界。”',
        '她教你辨认敌人的红色预警，也提醒你：每一场远征都要留一条回营的路。',
      ],
      [
        '“把找到的装备带回来，告诉我你看见了什么。营地需要事实，不需要英雄传说。”',
        '第一道雾门已经打开。出征时躲开地面预警、收集秘境进度并击败守门者；带着战利品回营，我们再一起辨认雾中的路。',
      ],
    ],
  },
  'first-clear': {
    title: '第一次远征',
    pages: [
      [
        '岚把一枚旧罗盘塞进你手里。“沿着灯火走。击退守门者，雾就会暂时退开。”',
        '战斗中留意地面的预警，收集秘境进度，击败首领后再回营报告。',
      ],
      [
        '归来时，铜铃在你掌心微微发热。岚接过罗盘，看见刻度上新出现的一道细线。',
        '“你带回来的不只是战利品。雾的另一边，确实有一条路。”——之后的故事，将随着你的远征继续。',
      ],
    ],
  },
  complete: {
    title: '营火未冷',
    pages: [
      [
        '营地的灯火比出发时更亮了。岚将地图摊开，新的道路正从你带回的记录中显现。',
        '“下一次，我们会走得更远。先休息，整理装备，再决定要追寻哪条线索。”',
      ],
    ],
  },
};

export function StoryGuide({
  chapter,
  onAdvance,
  onSkip,
  onClose,
}: {
  chapter: Chapter;
  onAdvance: () => void;
  onSkip: () => void;
  onClose?: () => void;
}) {
  const save = useGameStore((state) => state.save);
  const [page, setPage] = useState(0);
  const story = lines[chapter];
  const pages =
    chapter === 'first-clear'
      ? save.clears > 0
        ? story.pages.slice(1)
        : story.pages.slice(0, 1)
      : story.pages;
  const dialog = useDialog(true, onSkip);
  const hero = CLASSES.find((entry) => entry.id === save.classId)!;
  const finalPage = page === pages.length - 1;
  const finish = chapter === 'complete' ? (onClose ?? onAdvance) : onAdvance;
  return (
    <div className="story-backdrop">
      <section
        ref={dialog}
        tabIndex={-1}
        className="story-book pixel-parchment"
        role="dialog"
        aria-modal="true"
        aria-labelledby="story-title"
      >
        <span className="eyebrow">雾隐手记 · {hero.name}的旅程</span>
        <h2 id="story-title">{story.title}</h2>
        <div className="story-art" aria-hidden="true">
          <HeroArt classId={save.classId} />
          <span>{chapter === 'arrival' ? '守望者营地' : '星语导师 · 岚'}</span>
        </div>
        <div className="story-lines">
          {pages[page].map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div className="story-page-count">
          {page + 1} / {pages.length}
        </div>
        <footer>
          <button className="ghost-button" onClick={onSkip}>
            跳过剧情
          </button>
          {page > 0 && (
            <button
              className="icon-button story-previous"
              aria-label="上一页"
              onClick={() => setPage((value) => value - 1)}
              disabled={page === 0}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <button
            className="gold-button"
            onClick={() => (finalPage ? finish() : setPage((value) => value + 1))}
          >
            {finalPage ? (chapter === 'complete' ? '合上手记' : '继续旅程') : '下一页'}
          </button>
        </footer>
      </section>
    </div>
  );
}
