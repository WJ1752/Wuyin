import type { SaveData } from '../core/types';
import { skillLearningStatus } from '../data/progression';
import { SKILLS } from '../data/skillTrees';
import { SETS } from '../data/sets';
import { emptySlotItems } from '../state/gameStore';
import { Check, ChevronRight } from './PixelIcons';
import './player-experience.css';

export function onboardingTasks(save: SaveData) {
  const movement = SKILLS.find(
    (skill) => skill.classId === save.classId && skill.kind === 'movement',
  );
  const equipped = Object.values(save.equipment).filter(Boolean).length;
  const clearedStage = save.progression?.clearedStage ?? 0;
  return [
    {
      id: 'clear',
      title: '完成第一场秘境',
      detail: '点敌集火，拖动移动。躲开预警，收集紫色进度球后击败首领。',
      done: clearedStage > 0 || save.clears > 0,
      canPrepare: false,
      panel: 'expedition',
      action: '开始远征',
    },
    {
      id: 'equip',
      title: '穿上带回的装备',
      detail: equipped ? `已穿戴 ${equipped} 个部位。` : '远征归来后，在装备页穿戴带回的战利品。',
      done: equipped > 0,
      canPrepare: !equipped && emptySlotItems(save).length > 0,
      panel: 'character',
      action: '整理装备',
    },
    {
      id: 'movement',
      title: `学习${movement?.name ?? '位移技能'}`,
      detail:
        save.level < 3
          ? '先升至 Lv.3，再到技能之书学习位移；手动保留它躲避危险。'
          : '在技能之书学习位移；战斗中使用位移键或点击技能躲避。',
      done: !!movement && (save.skills[movement.id] ?? 0) > 0,
      canPrepare: !!movement && skillLearningStatus(save, movement).canLearn,
      panel: 'skills',
      action: '学习技能',
    },
    {
      id: 'build',
      title: '选定想玩的流派',
      detail: '在行者旅程选择目标套装；选择不会消耗资源，之后仍可更换。',
      done: SETS.some(
        (set) => set.classId === save.classId && set.id === save.progression?.targetSetId,
      ),
      canPrepare: clearedStage >= 16 && clearedStage < 31,
      panel: 'journey',
      action: '选择流派',
    },
  ];
}

export function OnboardingChecklist({
  save,
  onNavigate,
}: {
  save: SaveData;
  onNavigate: (panel: string) => void;
}) {
  const tasks = onboardingTasks(save);
  return (
    <section className="onboarding-checklist" aria-label="实操任务进度">
      <div className="section-heading">
        <h3>你的开荒第一步</h3>
        <span>
          {tasks.filter((task) => task.done).length} / {tasks.length}
        </span>
      </div>
      <p className="muted">按实际角色进度自动勾选，可自由跳过或更改顺序。</p>
      <ol>
        {tasks.map((task, index) => (
          <li key={task.id} className={task.done ? 'complete' : ''}>
            <span className="onboarding-marker" aria-label={task.done ? '已完成' : '待完成'}>
              {task.done ? <Check size={16} /> : index + 1}
            </span>
            <div>
              <strong>{task.title}</strong>
              <p>{task.detail}</p>
            </div>
            {!task.done && (
              <button className="ghost-button" onClick={() => onNavigate(task.panel)}>
                {task.action} <ChevronRight size={14} />
              </button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
