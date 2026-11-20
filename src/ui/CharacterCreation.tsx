import { useState, type CSSProperties } from 'react';
import type { ClassId } from '../core/types';
import { CLASSES } from '../data/classes';
import { SKILLS } from '../data/skillTrees';
import { useGameStore } from '../state/gameStore';
import { HeroArt } from './SceneArt';
import { ArrowRight, BookOpen, Compass, Hexagon, PawPrint, Swords } from './PixelIcons';
import './character-story.css';

const classIcons: Record<ClassId, typeof Swords> = {
  ranger: Compass,
  barbarian: Swords,
  sorcerer: BookOpen,
  necromancer: Hexagon,
  druid: PawPrint,
};

const classPlaystyles: Record<ClassId, string> = {
  ranger: '远程射击 · 走位拉开距离',
  barbarian: '近身重击 · 交战积攒怒气',
  sorcerer: '远程法术 · 用元素控制战场',
  necromancer: '亡魂法术 · 召唤伙伴作战',
  druid: '混合打法 · 利用风暴与毒藤',
};

export function CharacterCreation({
  onAccount,
  onCreated,
}: {
  onAccount?: () => void;
  onCreated?: () => void;
}) {
  const createFirstCharacter = useGameStore((state) => state.createFirstCharacter);
  const [name, setName] = useState('');
  const [classId, setClassId] = useState<ClassId>('ranger');
  const hero = CLASSES.find((entry) => entry.id === classId)!;
  const starter = SKILLS.find((entry) => entry.classId === classId && entry.kind === 'basic');
  return (
    <main className="character-creation" style={{ '--class-accent': hero.color } as CSSProperties}>
      <div className="creation-select">
        <header className="creation-heading">
          <h1>雾隐</h1>
          <p>选择你的行者。营地是首场远征的起点。</p>
        </header>
        <div className="creation-classes" role="group" aria-label="选择职业">
          {CLASSES.map((entry) => {
            const Mark = classIcons[entry.id];
            return (
              <button
                type="button"
                key={entry.id}
                className={`creation-class ${classId === entry.id ? 'selected' : ''}`}
                aria-pressed={classId === entry.id}
                onClick={() => setClassId(entry.id)}
              >
                <Mark size={20} />
                <strong>{entry.name}</strong>
              </button>
            );
          })}
        </div>
      </div>
      <section className="creation-stage" aria-label={hero.name}>
        <div className="creation-portrait" aria-hidden="true">
          <HeroArt classId={hero.id} key={hero.id} />
        </div>
        <div className="creation-intro" aria-live="polite">
          <h2>{hero.title}</h2>
          <b className="creation-role">{classPlaystyles[classId]}</b>
          <p>{hero.lore}</p>
          <dl className="creation-facts">
            <div>
              <dt>武器</dt>
              <dd>{hero.weapon}</dd>
            </div>
            <div>
              <dt>主属性</dt>
              <dd>{hero.mainStat}</dd>
            </div>
            <div>
              <dt>{hero.resource}</dt>
              <dd>{hero.maxResource}</dd>
            </div>
            <div>
              <dt>生命</dt>
              <dd>{hero.hp}</dd>
            </div>
            <div>
              <dt>初始技能</dt>
              <dd>{starter?.name ?? '基础攻击'}</dd>
            </div>
          </dl>
        </div>
      </section>
      <form
        className="creation-register"
        onSubmit={(event) => {
          event.preventDefault();
          if (createFirstCharacter(name, classId)) onCreated?.();
        }}
      >
        <label>
          角色名字
          <input
            autoComplete="off"
            maxLength={24}
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="给这位旅人一个名字"
          />
        </label>
        <button className="gold-button" disabled={!name.trim()}>
          创建角色，进入营地 <ArrowRight size={18} />
        </button>
        {onAccount && (
          <button type="button" className="ghost-button creation-account" onClick={onAccount}>
            账号与云存档
          </button>
        )}
      </form>
    </main>
  );
}
