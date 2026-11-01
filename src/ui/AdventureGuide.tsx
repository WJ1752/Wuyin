import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, Compass, Shield, Swords, X } from './PixelIcons';
import { CLASSES } from '../data/classes';
import { SKILLS } from '../data/skillTrees';
import { useGameStore } from '../state/gameStore';
import { useDialog } from './useDialog';

const CHAPTERS = [
  { title: '从大厅出发', icon: Compass, label: '出发' },
  { title: '学会你的技能', icon: BookOpen, label: '技能' },
  { title: '带回战利品', icon: Shield, label: '装备' },
  { title: '找到自己的流派', icon: Swords, label: '成长' },
];

export function AdventureGuide({
  onClose,
  onNavigate,
  onTrain,
}: {
  onClose: () => void;
  onNavigate: (panel: string) => void;
  onTrain: () => void;
}) {
  const [step, setStep] = useState(0);
  const save = useGameStore((state) => state.save);
  const ref = useDialog(true, onClose);
  const hero = CLASSES.find((entry) => entry.id === save.classId)!;
  const basic = SKILLS.find(
    (skill) => skill.classId === save.classId && skill.kind === 'basic' && save.skills[skill.id],
  );
  const movement = SKILLS.find(
    (skill) => skill.classId === save.classId && skill.kind === 'movement',
  );
  const chapter = CHAPTERS[step];
  const Icon = chapter.icon;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={ref}
        className="modal guide-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        tabIndex={-1}
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">A WATCHER'S HANDBOOK · 新手教程</span>
            <h2 id="guide-title">迷雾中的第一步</h2>
          </div>
          <button
            className="icon-button"
            aria-label="关闭教程，稍后可从冒险指南重看"
            onClick={onClose}
          >
            <X />
          </button>
        </header>
        <nav className="guide-chapters" aria-label="教程章节">
          {CHAPTERS.map((entry, index) => (
            <button
              key={entry.label}
              className={step === index ? 'active' : ''}
              aria-current={step === index ? 'step' : undefined}
              onClick={() => setStep(index)}
            >
              <b>{index < step ? <Check size={14} /> : `0${index + 1}`}</b>
              {entry.label}
            </button>
          ))}
        </nav>
        <div className="modal-body guide-content">
          <div className="guide-heading">
            <Icon size={28} />
            <div>
              <span className="eyebrow">
                第 {step + 1} / 4 步 · {hero.name}
              </span>
              <h3>{chapter.title}</h3>
            </div>
          </div>
          {step === 0 && (
            <>
              <div className="guide-callout">
                在大厅用摇杆或 WASD 走动，点击 NPC 会走近，靠近后点「交互」或按
                E。侧边功能栏可随时打开装备、技能、职业榜和其他服务；点击传送门选择远征。
              </div>
              <p>
                你已掌握{basic?.name ?? '基础技能'}
                。靠近敌人后会自动攻击，把注意力留给躲避红色预警。
              </p>
              <div className="guide-controls">
                <span>
                  <kbd>W A S D</kbd> / 方向键移动
                </span>
                <span>
                  <kbd>1–6</kbd> 施放已学技能
                </span>
                <span>
                  <kbd>Esc</kbd> 暂停 / 继续
                </span>
                <span>触屏：左侧摇杆或拖动战场</span>
              </div>
              <div className="guide-callout">
                {movement && save.skills[movement.id]
                  ? `空格施放「${movement.name}」，默认手动，留给危险时刻。`
                  : '位移在 Lv.3 解锁并学习后，才能用空格施放；现在先用走位躲避。'}
              </div>
              <button className="outline-button full-width" onClick={onTrain}>
                <Swords size={16} /> 去无收益训练场试试走位
              </button>
            </>
          )}
          {step === 1 && (
            <>
              <p>
                每升一级获得 2
                点技能点。从侧边打开「技能之书」学习后，主动技能才会加入战斗栏，被动分支强化其前置技能。
              </p>
              <ol className="guide-milestones">
                <li>
                  <b>Lv.3 / 5</b>
                  <span>学习位移 / 核心输出</span>
                </li>
                <li>
                  <b>Lv.8 / 10 / 15</b>
                  <span>掌控 / 防御 / 终极技能</span>
                </li>
                <li>
                  <b>AUTO / 手动</b>
                  <span>点击技能上方开关，设置会保存；保留基础技能自动施法来回能。</span>
                </li>
              </ol>
              <div className="guide-callout">
                不知道怎么点？使用「推荐加点」。免费洗点可以随时重新选择，分支仍需满足前置条件。
              </div>
              <button className="outline-button full-width" onClick={() => onNavigate('skills')}>
                打开技能之书 <ArrowRight size={16} />
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <p>
                秘境限时 5
                分钟。击败精英后靠近拾取紫色进度球，进度满后击败守关首领即可通关。圣坛需要靠近后点击激活。
              </p>
              <ol className="guide-milestones">
                <li>
                  <b>通关回营</b>
                  <span>在「角色装备」比较、穿戴新掉落，先补齐空槽。</span>
                </li>
                <li>
                  <b>背包整理</b>
                  <span>传奇、套装先保留；其他职业装备可放进账号共享仓库。</span>
                </li>
                <li>
                  <b>稳步推进</b>
                  <span>失败后降低层数，学习技能并强化装备，再挑战。</span>
                </li>
              </ol>
              <div className="guide-callout">
                提前退出不会结算本次战利品。开荒进度自动保存，换设备需要在「账号与角色」登录并完成云同步。
              </div>
              <button className="outline-button full-width" onClick={() => onNavigate('character')}>
                查看角色与背包 <ArrowRight size={16} />
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <p>
                用套装确定核心技能，再搭配传奇、魔盒和伙伴。先凑齐 2 件共鸣，4
                件套会进一步改变玩法。
              </p>
              <ol className="guide-milestones">
                <li>
                  <b>4 / 8 / 16 层</b>
                  <span>逐步开放稀有 / 史诗 / 传奇掉落。</span>
                </li>
                <li>
                  <b>31 层起</b>
                  <span>开放套装掉落；31 / 35 / 40 / 45 层首通旅程可领取缺失部件。</span>
                </li>
                <li>
                  <b>想先试流派？</b>
                  <span>流派实验室有 15 套成型配装，结束体验后恢复原开荒档。</span>
                </li>
              </ol>
              <button className="outline-button full-width" onClick={() => onNavigate('journey')}>
                选择目标套装与旅程奖励 <ArrowRight size={16} />
              </button>
            </>
          )}
        </div>
        <footer className="guide-footer">
          <button className="ghost-button" onClick={step ? () => setStep(step - 1) : onClose}>
            {step ? (
              <>
                <ArrowLeft size={14} /> 上一步
              </>
            ) : (
              '稍后再看'
            )}
          </button>
          <button
            className="gold-button"
            onClick={step === CHAPTERS.length - 1 ? onClose : () => setStep(step + 1)}
          >
            {step === CHAPTERS.length - 1 ? '准备好了，返回营地' : '下一步'}
            <ArrowRight size={16} />
          </button>
        </footer>
      </div>
    </div>
  );
}
