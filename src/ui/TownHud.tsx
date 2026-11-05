import { CLASSES } from '../data/classes';
import { SKILLS } from '../data/skillTrees';
import { STAGES } from '../data/stages';
import {
  availableSkillPoints,
  getProgressionMilestones,
  skillLearningStatus,
} from '../data/progression';
import { formatBigNumber } from '../core/format';
import { CHARACTER_ART } from '../render/CharacterTextures';
import { MAX_INVENTORY, useGameStore } from '../state/gameStore';
import { useCloudStore } from '../state/cloudStore';
import {
  ArrowRight,
  BookOpen,
  Coins,
  ChevronLeft,
  ChevronRight,
  Compass,
  Crown,
  Diamond,
  FlaskConical,
  Gem,
  Hammer,
  Hexagon,
  Package,
  PawPrint,
  Settings,
  Shield,
  Swords,
  Volume2,
  VolumeX,
} from './PixelIcons';

const SERVICES = [
  { id: 'character', label: '装备', icon: Shield },
  { id: 'skills', label: '技能', icon: BookOpen },
  { id: 'stash', label: '仓库', icon: Package },
  { id: 'forge', label: '锻造', icon: Hammer },
  { id: 'cube', label: '魔盒', icon: Hexagon },
  { id: 'gamble', label: '秘藏', icon: Diamond },
  { id: 'pets', label: '伙伴', icon: PawPrint },
  { id: 'leaderboard', label: '榜单', icon: Crown },
];

export function TownHud({
  onNavigate,
  onGuide,
  onTrain,
  onSolo,
}: {
  onNavigate: (panel: string) => void;
  onGuide: () => void;
  onTrain: () => void;
  onSolo: () => void;
}) {
  const {
    save,
    accounts,
    activeAccountId,
    labBackup,
    cloudTransition,
    selectStage,
    updateSettings,
  } = useGameStore();
  const cloud = useCloudStore();
  const onlineExpedition = cloud.status === 'online' && !labBackup;
  const account = accounts.find((entry) => entry.id === activeAccountId);
  const character = account?.characters.find((entry) => entry.id === account.activeCharacterId);
  const hero = CLASSES.find((entry) => entry.id === save.classId) ?? CLASSES[0];
  const points = availableSkillPoints(save);
  const canLearn = SKILLS.some(
    (skill) => skill.classId === save.classId && skillLearningStatus(save, skill).canLearn,
  );
  const nextMilestone = getProgressionMilestones(save).find((milestone) => !milestone.claimed);
  const rewardReady =
    !!nextMilestone && (save.progression?.clearedStage ?? 0) >= nextMilestone.stage;
  const cloudLabel = {
    guest: '访客 · 本机存档',
    choosing: '选择云端档案',
    online: cloud.dirty ? '等待云端同步' : '云端已同步',
    offline: '离线 · 本机已保留',
    expired: '登录过期 · 重新连接',
    conflict: '存档冲突 · 选择版本',
  }[cloud.status];

  return (
    <div className="hall-hud">
      <header className="traveler-hud">
        <button
          className="traveler-profile"
          onClick={() => onNavigate('accounts')}
          aria-label="账号与角色"
        >
          <span className="traveler-avatar">
            <img src={CHARACTER_ART[save.classId].src} alt="" />
          </span>
          <span className="traveler-identity">
            <small>
              雾隐 <i /> {hero.name}
            </small>
            <strong>{labBackup ? hero.name : (character?.name ?? hero.name)}</strong>
            <span className="traveler-level">
              Lv.{save.level}{' '}
              <span>
                {save.level >= 100 ? '巅峰行者' : `${save.xp} / ${save.level * 180} 经验`}
              </span>
            </span>
            <span className="traveler-xp" aria-hidden="true">
              <i
                style={{
                  width: `${save.level >= 100 ? 100 : Math.min(100, (save.xp / (save.level * 180)) * 100)}%`,
                }}
              />
            </span>
          </span>
        </button>
        <button
          className={`traveler-sync sync-${cloud.status}`}
          onClick={() => onNavigate('accounts')}
        >
          <i />
          {cloudLabel}
          <ArrowRight size={11} />
        </button>
      </header>

      <div className="hall-wallet" aria-label="持有资源">
        <span title="金币">
          <Coins size={16} />
          <b>{formatBigNumber(save.gold)}</b>
          <small>金币</small>
        </span>
        <span title="神秘碎片">
          <Diamond size={16} />
          <b>{formatBigNumber(save.shards)}</b>
          <small>碎片</small>
        </span>
        <span title="奥术结晶">
          <Gem size={16} />
          <b>{formatBigNumber(save.crystals)}</b>
          <small>结晶</small>
        </span>
      </div>

      <nav className="hall-service-rail" aria-label="大厅侧边功能">
        <span className="rail-caption">营地服务</span>
        <div className="rail-services">
          {SERVICES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              aria-label={id === 'skills' && canLearn ? `技能 · ${points} 点可分配` : label}
              title={
                id === 'character' ? `背包 ${save.inventory.length} / ${MAX_INVENTORY}` : label
              }
            >
              <span className="service-seal">
                <Icon size={23} />
              </span>
              <span className="service-label">{label}</span>
              {id === 'skills' && canLearn && <i className="rail-alert">{points}</i>}
            </button>
          ))}
          <button onClick={() => onNavigate('services')}>
            <span className="service-seal">
              <Compass size={23} />
            </span>
            <span className="service-label">全部服务</span>
          </button>
        </div>
      </nav>

      <nav className="hall-utility-rail" aria-label="冒险辅助功能">
        <button
          onClick={() => onNavigate('journey')}
          className={rewardReady ? 'has-reward' : ''}
          title={rewardReady ? '首通奖励可领取' : '掉落与套装旅程'}
        >
          <Compass size={19} />
          <span>旅程</span>
          {rewardReady && <i />}
        </button>
        <button onClick={() => onNavigate('lab')} title="体验十五套成型流派">
          <FlaskConical size={19} />
          <span>演武</span>
        </button>
        <button onClick={onTrain} title="训练走位，不消耗资源">
          <Swords size={19} />
          <span>训练</span>
        </button>
        <button onClick={onGuide} className={!save.tutorialSeen ? 'unread-guide' : ''}>
          <BookOpen size={19} />
          <span>指南</span>
        </button>
        <button
          onClick={() => updateSettings({ muted: !save.muted })}
          aria-label={save.muted ? '开启音效' : '静音'}
          title={save.muted ? '开启音效' : '静音'}
        >
          {save.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          <span>音效</span>
        </button>
        <button onClick={() => onNavigate('settings')} aria-label="游戏设置" title="游戏设置">
          <Settings size={19} />
          <span>设置</span>
        </button>
      </nav>

      <section className="hall-expedition" aria-label="秘境出征">
        <div className="expedition-destination">
          <span>
            源初秘境<small>{STAGES[save.selectedStage - 1]?.name}</small>
          </span>
          <div className="expedition-tier">
            <button
              aria-label="降低秘境层数"
              disabled={cloudTransition || save.selectedStage <= 1}
              onClick={() => selectStage(save.selectedStage - 1)}
            >
              <ChevronLeft size={14} />
            </button>
            <label>
              <span className="sr-only">选择已解锁秘境</span>
              <span>第</span>
              <input
                aria-label="选择已解锁秘境"
                type="number"
                inputMode="numeric"
                min={1}
                max={save.highestStage}
                value={save.selectedStage}
                onChange={(event) => selectStage(Number(event.target.value))}
                disabled={cloudTransition}
              />
              <span>层</span>
            </label>
            <button
              aria-label="提高秘境层数"
              disabled={cloudTransition || save.selectedStage >= save.highestStage}
              onClick={() => selectStage(save.selectedStage + 1)}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <button
          className="hall-depart"
          onClick={onlineExpedition ? () => onNavigate('expedition') : onSolo}
          disabled={cloudTransition}
        >
          <Compass size={25} />
          <span>
            {onlineExpedition ? '启程出征' : '独自远征'}
            <small>
              {onlineExpedition ? '单人 / 1–4 人组队' : `挑战第 ${save.selectedStage} 层`}
            </small>
          </span>
          <ArrowRight size={19} />
        </button>
      </section>

      {labBackup && (
        <div className="hall-lab-status">
          <FlaskConical size={16} />
          <span>流派演武 · 独立体验</span>
          <button onClick={() => useGameStore.getState().leaveLab()}>
            结束体验 <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
