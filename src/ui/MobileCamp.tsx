import { useState } from 'react';
import { formatBigNumber } from '../core/format';
import { useGameStore } from '../state/gameStore';
import { CHARACTER_ART } from '../render/CharacterTextures';
import { CLASSES } from '../data/classes';
import { BookOpen, Coins, Compass, Diamond, Gem, Package, Shield, Swords, X } from './PixelIcons';
import './mobile-camp-home.css';

const ACTIONS = [
  { id: 'character', label: '装备', icon: Shield },
  { id: 'skills', label: '技能', icon: BookOpen },
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
  const account = accounts.find((entry) => entry.id === activeAccountId);
  const character = account?.characters.find((entry) => entry.id === account.activeCharacterId);
  const hero = CLASSES.find((entry) => entry.id === save.classId) ?? CLASSES[0];

  return (
    <div className="camp-floating-hud" aria-label="营地快捷操作">
      <header className="camp-hud-topbar">
        <button className="camp-hud-traveler" onClick={() => onNavigate('accounts')}>
          <img src={CHARACTER_ART[save.classId].src} alt="" />
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

      <nav className="camp-hud-bottom" aria-label="营地操作">
        <button onClick={() => onNavigate(ACTIONS[0].id)}>
          <Shield size={22} />
          <span>装备</span>
        </button>
        <button onClick={() => onNavigate(ACTIONS[1].id)}>
          <BookOpen size={22} />
          <span>技能</span>
        </button>
        <button className="camp-hud-depart" onClick={() => onNavigate('expedition')}>
          <Swords size={23} />
          <span>
            <small>第 {save.selectedStage} 层</small>出征
          </span>
        </button>
        <button onClick={() => onNavigate(ACTIONS[2].id)}>
          <Compass size={22} />
          <span>旅程</span>
        </button>
        <button onClick={() => onNavigate(ACTIONS[3].id)}>
          <Package size={22} />
          <span>服务</span>
        </button>
      </nav>
    </div>
  );
}
