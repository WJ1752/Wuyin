import { useState } from 'react';
import { formatBigNumber } from '../core/format';
import { emptySlotItems, skillPoints, useGameStore } from '../state/gameStore';
import { getCharacterArt } from '../data/characterArt';
import { CLASSES } from '../data/classes';
import { getNextCampaignChapter } from '../data/campaign';
import { onboardingTasks } from './OnboardingChecklist';
import {
  BookOpen,
  ChevronRight,
  Coins,
  Compass,
  Diamond,
  Gem,
  Package,
  Shield,
  Swords,
  X,
} from './PixelIcons';
import './mobile-camp-home.css';

const ACTIONS = [
  { id: 'character', label: '装备', icon: Shield },
  { id: 'skills', label: '技能', icon: BookOpen },
  { id: 'expedition', label: '出征', icon: Swords },
  { id: 'journey', label: '旅程', icon: Compass },
  { id: 'services', label: '服务', icon: Package },
] as const;

type MobileCampProps = {
  onNavigate: (panel: string) => void;
  onGuide: () => void;
};

export function MobileCamp({ onNavigate, onGuide }: MobileCampProps) {
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const save = useGameStore((state) => state.save);
  const accounts = useGameStore((state) => state.accounts);
  const activeAccountId = useGameStore((state) => state.activeAccountId);
  const labBackup = useGameStore((state) => state.labBackup);
  const leaveLab = useGameStore((state) => state.leaveLab);
  const selectStage = useGameStore((state) => state.selectStage);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const cloudTransition = useGameStore((state) => state.cloudTransition);
  const account = accounts.find((entry) => entry.id === activeAccountId);
  const character = account?.characters.find((entry) => entry.id === account.activeCharacterId);
  const hero = CLASSES.find((entry) => entry.id === save.classId) ?? CLASSES[0];
  const clearedStage = save.progression?.clearedStage ?? 0;
  const prep =
    !labBackup && !save.tutorialSeen
      ? onboardingTasks(save).find((task) => !task.done && task.canPrepare)
      : undefined;
  const chapter = !labBackup ? getNextCampaignChapter(clearedStage) : undefined;
  const nextFloor = chapter ? Math.min(chapter.stage, save.highestStage) : undefined;
  const pending = !labBackup ? (save.pendingLoot?.length ?? 0) : 0;
  const emptySlots = emptySlotItems(save).length;
  const points = skillPoints(save);

  return (
    <div className="camp-floating-hud" aria-label="营地快捷操作">
      <header className="camp-hud-topbar">
        <button className="camp-hud-traveler" onClick={() => onNavigate('accounts')}>
          <img src={getCharacterArt(save.classId, save.equipment).src} alt="" />
          <span>
            <strong>{character?.name ?? hero.name}</strong>
            <small>
              {hero.name} · Lv.{save.level}
            </small>
          </span>
        </button>
        <div className="camp-hud-top-actions">
          <div className="camp-hud-resource-anchor">
            <button
              className="camp-hud-button"
              aria-label={resourcesOpen ? '收起资源' : '查看资源'}
              aria-expanded={resourcesOpen}
              onClick={() => setResourcesOpen((open) => !open)}
            >
              {resourcesOpen ? <X size={22} /> : <Package size={22} />}
            </button>
            {resourcesOpen && (
              <div className="camp-hud-resource-popover" role="status" aria-label="持有资源">
                <span>
                  <Coins size={18} />
                  <b>{formatBigNumber(save.gold)}</b>
                  <small>金币</small>
                </span>
                <span>
                  <Diamond size={18} />
                  <b>{formatBigNumber(save.shards)}</b>
                  <small>碎片</small>
                </span>
                <span>
                  <Gem size={18} />
                  <b>{formatBigNumber(save.crystals)}</b>
                  <small>结晶</small>
                </span>
              </div>
            )}
          </div>
          <button
            className="camp-hud-button camp-hud-guide"
            onClick={onGuide}
            aria-label="冒险指南"
          >
            <BookOpen size={22} />
          </button>
        </div>
        {labBackup && (
          <button className="camp-hud-lab-exit" onClick={leaveLab} aria-label="结束流派演武">
            返回开荒
          </button>
        )}
      </header>

      {(pending > 0 || prep || chapter) && (
        <aside className="camp-hud-objective" aria-label="下一步">
          <button
            className="camp-hud-objective-action"
            disabled={cloudTransition}
            onClick={() => {
              if (pending) onNavigate('character');
              else if (prep) onNavigate(prep.panel);
              else if (nextFloor !== undefined) {
                selectStage(nextFloor);
                onNavigate('expedition');
              }
            }}
          >
            {pending ? (
              <Package size={20} />
            ) : prep ? (
              <BookOpen size={20} />
            ) : (
              <Compass size={20} />
            )}
            <span>
              <strong>
                {pending ? `${pending} 件战利品待领取` : (prep?.title ?? chapter?.title)}
              </strong>
              <small>
                {pending
                  ? '领取后可再次远征'
                  : (prep?.action ??
                    (clearedStage === 0 ? '首场远征 · 第 1 层' : `主线 · 出征第 ${nextFloor} 层`))}
              </small>
            </span>
            <ChevronRight size={16} />
          </button>
          {!pending && prep && (
            <button
              className="camp-hud-objective-dismiss"
              aria-label="隐藏营地实操提醒"
              disabled={cloudTransition}
              onClick={() => updateSettings({ tutorialSeen: true })}
            >
              <X size={16} />
            </button>
          )}
        </aside>
      )}

      <nav className="camp-hud-bottom" aria-label="营地操作">
        {ACTIONS.map(({ id, label, icon: Icon }) => {
          const depart = id === 'expedition';
          const count = id === 'character' ? pending || emptySlots : id === 'skills' ? points : 0;
          return (
            <button
              key={id}
              className={depart ? 'camp-hud-depart' : undefined}
              onClick={() => onNavigate(id)}
              aria-label={depart ? undefined : label}
              title={
                count
                  ? `${label} · ${id === 'skills' ? `${count} 点可分配` : `${count} 件可处理`}`
                  : undefined
              }
            >
              <Icon size={depart ? 23 : 22} />
              <span>
                {depart && <small>第 {save.selectedStage} 层</small>}
                {label}
              </span>
              {count > 0 && (
                <i className="camp-action-count" aria-hidden="true">
                  {count}
                </i>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
