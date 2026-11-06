import { useState } from 'react';
import type { ClassId } from '../core/types';
import { CLASSES } from '../data/classes';
import { SKILLS } from '../data/skillTrees';
import { useGameStore } from '../state/gameStore';
import { HeroArt } from './SceneArt';
import './character-story.css';

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
    <main className="character-creation pixel-parchment">
      <span className="eyebrow">雾隐营地 · 旅人登记</span>
      <h1>先决定你是谁</h1>
      <p>雾墙正在逼近。选择职业并留下名字，营地的故事才会开始。</p>
      <div className="creation-classes" role="radiogroup" aria-label="选择职业">
        {CLASSES.map((entry) => (
          <button
            type="button"
            key={entry.id}
            className={`creation-class ${classId === entry.id ? 'selected' : ''}`}
            aria-pressed={classId === entry.id}
            onClick={() => setClassId(entry.id)}
          >
            <HeroArt classId={entry.id} />
            <strong>{entry.name}</strong>
            <small>{entry.title}</small>
          </button>
        ))}
      </div>
      <section className="creation-intro" style={{ borderColor: `${hero.color}88` }}>
        <div>
          <h2 style={{ color: hero.color }}>
            {hero.name} · {hero.weapon}
          </h2>
          <p>{hero.lore}</p>
          <p>
            主属性：{hero.mainStat} · {hero.resource}上限：{hero.maxResource} · 基础生命：{hero.hp}
          </p>
          <p>初始技能：{starter?.name ?? '基础攻击'}。创建后可在技能之书继续学习。</p>
        </div>
      </section>
      <form
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
          创建角色，进入营地
        </button>
      </form>
      {onAccount && (
        <button className="ghost-button" onClick={onAccount}>
          账号与云存档
        </button>
      )}
      <p className="creation-footnote">
        职业确定后，此角色的成长与背包独立保存；你之后仍可创建其他职业角色。
      </p>
    </main>
  );
}
