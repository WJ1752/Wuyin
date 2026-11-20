import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  ReactNode,
} from 'react';
import {
  X,
  Sword,
  Shield,
  Crown,
  Shirt,
  Footprints,
  Gem,
  Hand,
  CircleDot,
  Sparkles,
  ArrowUp,
  ArrowLeft,
  Check,
  FlaskConical,
  WandSparkles,
  BookOpen,
  Hammer,
  Dices,
  PawPrint,
  Settings,
  Download,
  Upload,
  RotateCcw,
  Lock,
  Volume2,
  Package,
  ChevronRight,
  Compass,
} from './PixelIcons';
import type { ClassId, Item, LeaderboardResponse, RunRecord, Slot, Stats } from '../core/types';
import { RARITY_COLORS, RARITY_NAMES, SLOTS, SLOT_NAMES } from '../core/types';
import { CLASSES } from '../data/classes';
import { equipmentName } from '../data/equipment';
import { CURRENT_TRIAL_RULESET } from '../data/stages';
import type { CampaignChapter } from '../data/campaign';
import { SKILLS } from '../data/skillTrees';
import { SETS } from '../data/sets';
import { LEGENDARIES } from '../data/legendaries';
import { AFFIXES, GEMS, PETS } from '../data/affixes';
import {
  bulkSalvageable,
  craftRecipe,
  computeStats,
  emptySlotItems,
  itemClass,
  cubeSlot,
  MAX_INVENTORY,
  MAX_STASH,
  skillPoints,
  useGameStore,
} from '../state/gameStore';
import { AccountPanel } from './AccountPanel';
import { formatBigNumber } from '../core/format';
import './systems.css';
import './mobile-camp.css';
import { CharacterPreview } from './CharacterPreview';
import { ItemIcon, PetIcon, SkillIcon } from './AssetIcon';
import { JourneyPanel, LootChances } from './JourneyPanel';
import { CampWallet } from './TownHud';
import {
  campRates,
  HUNT_LIMIT,
  nextSkillPointLevel,
  skillPointBudget,
  isSkillAutoEnabled,
  skillLearningStatus,
  skillUnlockLevel,
} from '../data/progression';
import { BUILD_GUIDES } from '../data/buildGuides';
import { useDialog } from './useDialog';
import { apiRequest } from '../state/cloudStore';
import { PlayerSettings } from './PlayerSettings';
import { FeedbackForm } from './CloudAccountPanel';
import { BackpackOrganizer, useBackpackSelection } from './BackpackOrganizer';

const icons: Record<Slot, typeof Sword> = {
  weapon: Sword,
  offhand: Shield,
  head: Crown,
  chest: Shirt,
  hands: Hand,
  legs: CircleDot,
  feet: Footprints,
  jewelry: Gem,
};
const TITLES: Record<string, [string, typeof Sword]> = {
  services: ['营地服务', Compass],
  accounts: ['旅人名册', BookOpen],
  stash: ['账号共享仓库', Package],
  character: ['行者档案', Sword],
  skills: ['命运之树', BookOpen],
  journey: ['行者旅程', BookOpen],
  cube: ['魔盒共鸣', WandSparkles],
  gamble: ['米娅的秘藏', Dices],
  forge: ['余烬铁砧', Hammer],
  pets: ['守望契约', PawPrint],
  leaderboard: ['职业远征榜', Crown],
  settings: ['远征设置', Settings],
  lab: ['秘境演武场', FlaskConical],
};
const SYSTEM_GROUPS = [
  {
    label: '行者',
    icon: Sword,
    panels: ['character', 'skills', 'stash', 'accounts'],
  },
  { label: '秘器', icon: WandSparkles, panels: ['forge', 'cube', 'gamble'] },
  {
    label: '征途',
    icon: Compass,
    panels: ['journey', 'pets', 'leaderboard', 'lab'],
  },
  { label: '营地', icon: Settings, panels: ['services', 'settings'] },
];
const SYSTEM_LINKS: Record<string, string> = {
  character: '角色装备',
  skills: '技能之书',
  stash: '共享仓库',
  accounts: '账号角色',
  forge: '铁匠工坊',
  cube: '魔盒共鸣',
  gamble: '米娅秘藏',
  journey: '行者旅程',
  pets: '契约伙伴',
  leaderboard: '职业榜单',
  lab: '流派演武',
  services: '营地服务',
  settings: '游戏设置',
};
export function EquipmentIcon({ slot, size = 24 }: { slot: Slot; size?: number }) {
  const Icon = icons[slot];
  return <Icon size={size} strokeWidth={1.5} />;
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="system-empty">
      <Package size={34} />
      <p>{children}</p>
    </div>
  );
}
function costLabel(value: number) {
  return formatBigNumber(value);
}
function affixLabel(id: string, value: number) {
  const d = AFFIXES.find((a) => a.id === id);
  return `${d?.name ?? id} +${d?.unit === '%' ? (value * 100).toFixed(1) : Math.round(value)}${d?.unit ?? ''}`;
}
function SalvageButton({ item, onSalvaged }: { item: Item; onSalvaged?: () => void }) {
  const salvage = useGameStore((state) => state.salvage);
  const keep = useGameStore((state) => state.save.keepRareAffix);
  const [confirm, setConfirm] = useState(false);
  const precious = ['legendary', 'set', 'primal'].includes(item.rarity);
  const needsConfirmation = !bulkSalvageable(item, keep);
  useEffect(() => setConfirm(false), [item.id, item.locked]);
  if (item.locked)
    return (
      <p className="muted salvage-action">
        <Lock size={14} /> 已锁定，解锁后可分解
      </p>
    );
  return (
    <div className="salvage-action">
      {confirm && <p className="negative">将永久分解「{item.name}」，宝石无损返还。</p>}
      <div className="button-row">
        <button
          className={confirm ? 'danger-button' : 'ghost-button'}
          data-sound={confirm || !needsConfirmation ? 'forge' : undefined}
          onClick={() => {
            if (needsConfirmation && !confirm) setConfirm(true);
            else {
              salvage(item.id);
              onSalvaged?.();
            }
          }}
        >
          {confirm ? '确认分解' : `分解 · ${precious ? '12 结晶 / 2 魂' : '4 结晶'}`}
        </button>
        {confirm && (
          <button className="ghost-button" onClick={() => setConfirm(false)}>
            保留装备
          </button>
        )}
      </div>
    </div>
  );
}
function ExtractButton({ item }: { item: Item }) {
  const { save, extract } = useGameStore();
  const [confirm, setConfirm] = useState(false);
  const collected = save.extracted.includes(item.legendaryId!);
  const affordable = save.crystals >= 15 && save.souls >= 1;
  return (
    <div>
      {confirm && <p className="negative">将消耗这件装备，永久解锁其满值共鸣；宝石返还。</p>}
      <div className="button-row">
        <button
          className="gold-button"
          disabled={!!item.locked || collected || !affordable}
          data-sound={confirm ? 'arcane' : undefined}
          onClick={() => (confirm ? extract(item.id) : setConfirm(true))}
        >
          {item.locked
            ? '已锁定，解锁后可萃取'
            : collected
              ? '已收录'
              : !affordable
                ? '材料不足 · 15 结晶 + 1 魂'
                : confirm
                  ? '确认消耗装备并萃取'
                  : '萃取 · 15 结晶 + 1 魂'}
        </button>
        {confirm && (
          <button className="ghost-button" onClick={() => setConfirm(false)}>
            保留装备
          </button>
        )}
      </div>
    </div>
  );
}
function ItemTile({
  item,
  onClick,
  selected = false,
  marked,
  hint,
  hintKind,
  tabIndex,
}: {
  item: Item;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  selected?: boolean;
  marked?: boolean;
  hint?: string;
  hintKind?: 'empty-slot' | 'class';
  tabIndex?: number;
}) {
  const className = `item-card rarity-${item.rarity}${selected ? ' selected' : ''}`;
  const style = { '--rarity': RARITY_COLORS[item.rarity] } as CSSProperties;
  const content = (
    <>
      <span className="item-tile-art">
        <ItemIcon item={item} size={42} />
        {item.gem && <i style={{ color: GEMS.find((g) => g.id === item.gem!.id)?.color }}>◆</i>}
        {item.locked && (
          <span className="pack-lock-mark" aria-label="已锁定">
            <Lock size={12} />
          </span>
        )}
        {marked !== undefined && (
          <span className="pack-mark-box" aria-hidden="true">
            {marked && <Check size={14} />}
          </span>
        )}
      </span>
      <span className="item-tile-name">{equipmentName(item)}</span>
      <span className="item-tile-meta">
        {RARITY_NAMES[item.rarity]} · {item.level} 级
      </span>
      {hint && (
        <small className="pack-item-hint" data-kind={hintKind}>
          {hint}
        </small>
      )}
    </>
  );
  return onClick ? (
    <button
      className={className}
      style={style}
      onClick={onClick}
      aria-pressed={marked ?? selected}
      data-marked={marked}
      tabIndex={tabIndex}
      data-item-id={item.id}
    >
      {content}
    </button>
  ) : (
    <details className="readonly-item">
      <summary className={className} style={style}>
        {content}
      </summary>
      <ItemDetails item={item} />
    </details>
  );
}
function ItemDetails({
  item,
  compare,
  children,
  overview,
}: {
  item: Item;
  compare?: Item;
  children?: ReactNode;
  overview?: ReactNode;
}) {
  const l = LEGENDARIES.find((l) => l.id === item.legendaryId);
  const set = SETS.find((t) => t.id === item.setId);
  const equipment = useGameStore((state) => state.save.equipment);
  const setCount = set
    ? Object.values(equipment).filter((part) => part?.setId === set.id).length
    : 0;
  return (
    <article
      className={`item-detail rarity-${item.rarity}`}
      style={{ '--rarity': RARITY_COLORS[item.rarity] } as CSSProperties}
    >
      <span className="eyebrow">
        {RARITY_NAMES[item.rarity]} / {SLOT_NAMES[item.slot]}
      </span>
      <p className="item-class-label">
        {CLASSES.find((hero) => hero.id === itemClass(item))?.name ?? '全职业'}适用
      </p>
      <div className="item-detail-heading">
        <ItemIcon item={item} size={54} />
        <h3>{equipmentName(item)}</h3>
      </div>
      {overview}
      {item.rarity === 'rare' && (
        <p className="muted">
          铁匠底材 · {item.affixes.length}/4 词条
          {item.affixes.length < 4 && ' · 可保留原词条追加刻印'}
        </p>
      )}
      <div className="item-base-stats">
        {(
          [
            ['attack', '攻击'],
            ['armor', '护甲'],
          ] as const
        ).map(([key, label]) => {
          const difference = item[key] - (compare?.[key] ?? 0);
          return item[key] > 0 || difference < 0 ? (
            <strong key={key}>
              {item[key]} <small>{label}</small>
              {compare && difference !== 0 && (
                <span className={difference > 0 ? 'positive' : 'negative'}>
                  {difference > 0 ? '+' : '−'}
                  {Math.abs(difference)}
                </span>
              )}
            </strong>
          ) : null;
        })}
      </div>
      <ul className="affix-list">
        {item.affixes.map((a) => {
          const difference = a.value - (compare?.affixes.find((v) => v.id === a.id)?.value ?? 0);
          const unit = AFFIXES.find((v) => v.id === a.id)?.unit;
          return (
            <li key={a.id}>
              {affixLabel(a.id, a.value)}
              {compare && difference !== 0 && (
                <small className={difference > 0 ? 'positive' : 'negative'}>
                  {' '}
                  {difference > 0 ? '↑' : '↓'}{' '}
                  {unit === '%'
                    ? `${(Math.abs(difference) * 100).toFixed(1)}%`
                    : Math.round(Math.abs(difference))}
                </small>
              )}
            </li>
          );
        })}
        {compare?.affixes
          .filter((a) => !item.affixes.some((v) => v.id === a.id))
          .map((a) => (
            <li className="negative" key={`lost-${a.id}`}>
              失去 {affixLabel(a.id, a.value)}
            </li>
          ))}
      </ul>
      {item.gem && (
        <p className="positive">
          ◆ {GEMS.find((g) => g.id === item.gem!.id)?.name} · {item.gem.level} 阶
        </p>
      )}
      {l && (
        <>
          <p className="legendary-power">✧ {l.description}</p>
          <small className="muted">
            特效强度 {item.power.toFixed(2)} / 满值 {l.max}
          </small>
          <p className="item-lore">“{l.lore}”</p>
        </>
      )}
      {set && (
        <>
          <p className="set-power">
            已穿戴 {setCount} 件 ·{' '}
            {setCount >= 4
              ? '流派已成型'
              : `再穿戴 ${setCount < 2 ? 2 - setCount : 4 - setCount} 件解锁共鸣`}
          </p>
          <p className={setCount >= 2 ? 'set-power' : 'muted'}>
            [2] {setCount >= 2 ? '已激活 · ' : ''}
            {set.two}
          </p>
          <p className={setCount >= 4 ? 'set-power' : 'muted'}>
            [4] {setCount >= 4 ? '已激活 · ' : ''}
            {set.four}
          </p>
          <p className="item-lore">“{set.lore}”</p>
        </>
      )}
      {children}
    </article>
  );
}

type EquipmentSelection = {
  selected: string;
  selectItem: (id: string, trigger?: HTMLButtonElement) => void;
  closeItem: () => void;
};

function PendingLoot() {
  const {
    save,
    accounts,
    activeAccountId,
    claimPendingLoot,
    labBackup,
    cloudTransition,
    inCombat,
  } = useGameStore();
  const count = save.pendingLoot?.length ?? 0;
  if (!count || labBackup) return null;
  const stash = accounts.find((account) => account.id === activeAccountId)?.stash ?? [];
  const inventorySpace = Math.max(0, MAX_INVENTORY - save.inventory.length);
  const stashSpace = Math.max(0, MAX_STASH - stash.length);
  const available = Math.min(count, inventorySpace + stashSpace);
  return (
    <section className="pending-loot" aria-label="保留战利品">
      <Package size={26} />
      <div>
        <h3>{count} 件保留战利品</h3>
        <p>背包和仓库腾出空间后可领取，领完即可开始下一次远征。</p>
        <small>
          背包空余 {inventorySpace} · 仓库空余 {stashSpace}
        </small>
      </div>
      <button
        className="gold-button"
        data-sound="equip"
        onClick={claimPendingLoot}
        disabled={!available || inCombat || cloudTransition}
      >
        {available > 0 ? `领取保留战利品 · ${available} 件` : '请先腾出空间'}
      </button>
    </section>
  );
}

function EquipmentInspector({
  item,
  compare,
  caption,
  onClose,
  children,
}: {
  item?: Item;
  compare?: Item;
  caption?: string;
  onClose: () => void;
  children?: ReactNode;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const setItemLocked = useGameStore((state) => state.setItemLocked);
  const lockAvailable = useGameStore(
    (state) => !state.inCombat && !state.labBackup && !state.cloudTransition,
  );
  const id = item?.id;
  useEffect(() => {
    if (!id) return;
    const close = closeButton.current;
    close?.focus({ preventScroll: true });
    if (window.matchMedia('(max-width: 1080px)').matches)
      close?.closest('.modal-body')?.scrollTo({ top: 0 });
  }, [id]);

  return (
    <aside className="equipment-inspector" aria-label="装备详情">
      <header className="equipment-inspector-heading">
        <h3>{item ? '装备详情' : '装备鉴览'}</h3>
        {item && lockAvailable && (
          <button
            className="pack-item-lock ghost-button"
            aria-label={item.locked ? '解锁装备' : '锁定装备'}
            aria-pressed={!!item.locked}
            title="锁定可防止分解、萃取和用作刻印素材"
            onClick={() => setItemLocked(item.id, !item.locked)}
          >
            <Lock size={15} />
            {item.locked ? '已锁定' : '锁定'}
          </button>
        )}
        {item && (
          <button
            ref={closeButton}
            className="icon-button"
            onClick={onClose}
            aria-label="关闭装备详情"
          >
            <X size={18} />
          </button>
        )}
      </header>
      {item ? (
        <>
          <div className="equipment-inspector-body" key={item.id}>
            {caption && (
              <p className="equipment-status" role="status">
                {caption}
              </p>
            )}
            {compare && <p className="equipment-reference">对比 · {equipmentName(compare)}</p>}
            <ItemDetails item={item} compare={compare} overview={<SwapSummary item={item} />} />
            {compare && (
              <details className="equipment-comparison">
                <summary>
                  <ItemIcon item={compare} size={30} />
                  <span>
                    <small>当前穿戴 · {SLOT_NAMES[compare.slot]}</small>
                    <strong style={{ color: RARITY_COLORS[compare.rarity] }}>
                      {equipmentName(compare)}
                    </strong>
                  </span>
                  <ChevronRight size={15} />
                </summary>
                <ItemDetails item={compare} />
              </details>
            )}
          </div>
          <div className="equipment-inspector-actions">{children}</div>
        </>
      ) : (
        <div className="equipment-inspector-empty">
          <Shield size={38} />
          <p>选择一件装备，查看属性变化和可用操作。</p>
        </div>
      )}
    </aside>
  );
}

const statNames: Record<keyof Stats, string> = {
  hp: '最大生命',
  attack: '基础攻击',
  armor: '护甲',
  mainStat: '主属性',
  critChance: '暴击几率',
  critDamage: '暴击伤害',
  attackSpeed: '攻击速度',
  moveSpeed: '移动速度',
  cooldown: '冷却缩减',
  elementDamage: '元素增伤',
  eliteDamage: '精英增伤',
  regen: '每秒回血',
  resourceRegen: '每秒回能',
  areaDamage: '范围伤害',
  damageReduction: '伤害减免',
  dodge: '闪避几率',
  pickupRadius: '拾取半径',
  lifeOnHit: '击中回复',
  thorns: '荆棘伤害',
  penetration: '护甲穿透',
  bonusDamage: '技能增伤',
  independent: '独立倍率',
  maxResource: '资源上限',
  luck: '掉宝加成',
};
const percentStats = [
  'critChance',
  'critDamage',
  'cooldown',
  'elementDamage',
  'eliteDamage',
  'areaDamage',
  'damageReduction',
  'dodge',
  'penetration',
  'bonusDamage',
  'luck',
];
function SwapSummary({ item }: { item: Item }) {
  const save = useGameStore((state) => state.save);
  const old = save.equipment[item.slot];
  if (old?.id === item.id || (itemClass(item) && itemClass(item) !== save.classId)) return null;
  const equipment = { ...save.equipment, [item.slot]: item };
  const before = computeStats(save);
  const after = computeStats({ ...save, equipment });
  const changes = (Object.keys(statNames) as (keyof Stats)[]).flatMap((key) => {
    const from = before[key];
    const to = after[key];
    if (typeof from !== 'number' || typeof to !== 'number') return [];
    const percentage = percentStats.includes(key);
    const format = (value: number) =>
      Number(
        (value * (percentage ? 100 : 1)).toFixed(key === 'attackSpeed' ? 2 : percentage ? 1 : 0),
      );
    const difference = Number((format(to) - format(from)).toFixed(2));
    if (!difference) return [];
    return [
      {
        label: key === 'attack' ? '攻击' : statNames[key],
        value: `${format(from)}${percentage ? '%' : ''} → ${format(to)}${percentage ? '%' : ''}`,
        gain: difference > 0,
      },
    ];
  });
  const affectedSets = SETS.filter((set) => set.id === old?.setId || set.id === item.setId);
  const bonuses = affectedSets.flatMap((set) => {
    const pieces = Object.values(save.equipment).filter((part) => part?.setId === set.id).length;
    const next = pieces + Number(item.setId === set.id) - Number(old?.setId === set.id);
    return [2, 4]
      .filter((n) => pieces >= n !== next >= n)
      .map((n) => ({
        label: `${set.name} · ${n} 件`,
        value: next >= n ? '激活' : '失去',
        gain: next >= n,
      }));
  });
  const rows = [...bonuses, ...changes];
  const rowView = (row: (typeof rows)[number]) => (
    <div key={row.label}>
      <span>{row.label}</span>
      <b className={row.gain ? 'positive' : 'negative'}>{row.value}</b>
    </div>
  );
  return (
    <section className="pack-swap-summary" aria-label="穿戴后属性">
      <strong>穿戴后</strong>
      {rows.length ? rows.slice(0, 3).map(rowView) : <span>面板属性相同</span>}
      {rows.length > 3 && (
        <details>
          <summary>其余 {rows.length - 3} 项变化</summary>
          {rows.slice(3).map(rowView)}
        </details>
      )}
    </section>
  );
}
const backpackRarities = Object.keys(RARITY_NAMES) as Item['rarity'][];
const affixNames = new Map(AFFIXES.map((affix) => [affix.id, affix.name]));
const professionNames = new Map(CLASSES.map((hero) => [hero.id, hero.name]));
const BACKPACK_PAGE_SIZE = 24;

function BackpackPages({
  page,
  count,
  position,
  onPage,
}: {
  page: number;
  count: number;
  position: '顶部' | '底部';
  onPage: (page: number) => void;
}) {
  if (count < 2) return null;
  return (
    <nav className="pack-pagination" aria-label={`行囊${position}分页`}>
      <button
        className="ghost-button"
        aria-label="上一页"
        title="上一页"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        <ArrowLeft size={17} />
      </button>
      <select
        className="system-select"
        aria-label="跳转到背包页"
        value={page}
        onChange={(event) => onPage(Number(event.target.value))}
      >
        {Array.from({ length: count }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            第 {i + 1} / {count} 页
          </option>
        ))}
      </select>
      <button
        className="ghost-button"
        aria-label="下一页"
        title="下一页"
        disabled={page === count}
        onClick={() => onPage(page + 1)}
      >
        <ChevronRight size={17} />
      </button>
    </nav>
  );
}

function navigatePackGrid(event: ReactKeyboardEvent<HTMLDivElement>) {
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  const cards = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-item-id]'),
  );
  const index = cards.indexOf(event.target as HTMLButtonElement);
  if (index === -1) return;
  const columns = getComputedStyle(event.currentTarget).gridTemplateColumns.split(' ').length;
  const destinations: Record<string, number> = {
    ArrowLeft: index - 1,
    ArrowRight: index + 1,
    ArrowUp: index - columns,
    ArrowDown: index + columns,
    Home: 0,
    End: cards.length - 1,
  };
  const next = destinations[event.key];
  if (next === undefined) return;
  event.preventDefault();
  cards[Math.max(0, Math.min(next, cards.length - 1))].focus();
}

function CharacterPanel({ selected, selectItem, closeItem }: EquipmentSelection) {
  const store = useGameStore();
  const { save } = store;
  const [rarity, setRarity] = useState('all');
  const [slotFilter, setSlotFilter] = useState<Slot | 'all'>('all');
  const [ownership, setOwnership] = useState('all');
  const [lockedOnly, setLockedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [focusedId, setFocusedId] = useState('');
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const packRef = useRef<HTMLElement>(null);
  const mobileReturn = useRef<{ top: number; itemId: string; position: number } | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [dossierOpen, setDossierOpen] = useState(
    () => !window.matchMedia('(max-width: 960px)').matches,
  );
  const item = [...save.inventory, ...Object.values(save.equipment)].find(
    (i) => i?.id === selected,
  );
  const equipped = item && save.equipment[item.slot]?.id === item.id;
  const usable = !item || !itemClass(item) || itemClass(item) === save.classId;
  const stash = store.accounts.find((account) => account.id === store.activeAccountId)?.stash ?? [];
  const emptyPicks = useMemo(() => emptySlotItems(save), [save]);
  const words = search.trim().toLocaleLowerCase();
  const filterCount = [
    slotFilter !== 'all',
    rarity !== 'all',
    ownership !== 'all',
    lockedOnly,
  ].filter(Boolean).length;
  const visibleItems = useMemo(() => {
    const terms = words.split(/\s+/).filter(Boolean);
    const matches = save.inventory
      .filter((entry) => {
        if (slotFilter !== 'all' && entry.slot !== slotFilter) return false;
        if (
          rarity !== 'all' &&
          entry.rarity !== rarity &&
          !(rarity === 'set' && entry.setId) &&
          !(rarity === 'legendary' && entry.legendaryId)
        )
          return false;
        if (lockedOnly && !entry.locked) return false;
        const profession = itemClass(entry);
        const wearable = !profession || profession === save.classId;
        if ((ownership === 'usable' && !wearable) || (ownership === 'other' && wearable))
          return false;
        if (!terms.length) return true;
        const description = [
          equipmentName(entry),
          SLOT_NAMES[entry.slot],
          RARITY_NAMES[entry.rarity],
          profession ? professionNames.get(profession) : '通用',
          ...entry.affixes.map(({ id }) => affixNames.get(id)),
        ]
          .join(' ')
          .toLocaleLowerCase();
        return terms.every((term) => description.includes(term));
      })
      .reverse();
    if (sort === 'rarity') {
      matches.sort(
        (a, b) =>
          backpackRarities.indexOf(b.rarity) - backpackRarities.indexOf(a.rarity) ||
          b.level - a.level,
      );
    } else if (sort === 'level' || sort === 'attack' || sort === 'armor') {
      matches.sort((a, b) => b[sort] - a[sort]);
    }
    return matches;
  }, [save.inventory, save.classId, words, rarity, slotFilter, ownership, lockedOnly, sort]);
  const batch = useBackpackSelection(visibleItems);
  const pageCount = Math.max(1, Math.ceil(visibleItems.length / BACKPACK_PAGE_SIZE));
  const currentPage = Math.min(pageCount, page);
  const pageItems = visibleItems.slice(
    (currentPage - 1) * BACKPACK_PAGE_SIZE,
    currentPage * BACKPACK_PAGE_SIZE,
  );
  const tabStop = pageItems.some((entry) => entry.id === focusedId) ? focusedId : pageItems[0]?.id;
  const hasFilters = !!(words || filterCount);
  function changePage(next: number, fromBottom = false) {
    setPage(next);
    if (item && !equipped) selectItem('');
    if (fromBottom)
      requestAnimationFrame(() => {
        packRef.current?.querySelector<HTMLButtonElement>('.pack-grid [data-item-id]')?.focus();
      });
  }
  const resetFilters = () => {
    changePage(1);
    setRarity('all');
    setSlotFilter('all');
    setOwnership('all');
    setLockedOnly(false);
    setSearch('');
  };
  function browseSlot(slot: Slot) {
    resetFilters();
    setSlotFilter(slot);
    setOwnership('usable');
    setFiltersOpen(true);
    selectItem('');
    if (window.matchMedia('(max-width: 960px)').matches) setDossierOpen(false);
    requestAnimationFrame(() => packRef.current?.focus());
  }
  function openItem(id: string, button: HTMLButtonElement) {
    if (window.matchMedia('(max-width: 1080px)').matches) {
      mobileReturn.current = {
        top: button.closest('.modal-body')?.scrollTop ?? 0,
        itemId: id,
        position: pageItems.findIndex((entry) => entry.id === id),
      };
    }
    selectItem(id, button);
  }
  function afterItemRemoved() {
    if (!item || useGameStore.getState().save.inventory.some((entry) => entry.id === item.id))
      return;
    const index = visibleItems.findIndex((entry) => entry.id === item.id);
    const next = index >= 0 ? (visibleItems[index + 1] ?? visibleItems[index - 1]) : undefined;
    const nextCard = () =>
      next &&
      packRef.current?.querySelector<HTMLButtonElement>(`[data-item-id="${CSS.escape(next.id)}"]`);
    if (next && !window.matchMedia('(max-width: 1080px)').matches) {
      selectItem(next.id, nextCard() ?? undefined);
    } else {
      closeItem();
      requestAnimationFrame(() => (nextCard() || packRef.current)?.focus());
    }
  }
  useEffect(() => {
    const origin = mobileReturn.current;
    if (selected || !origin) return;
    mobileReturn.current = null;
    const frame = requestAnimationFrame(() => {
      const pack = packRef.current;
      const body = pack?.closest('.modal-body');
      if (!pack || !body) return;
      body.scrollTop = origin.top;
      if (origin.position < 0) return;
      const cards = Array.from(
        pack.querySelectorAll<HTMLButtonElement>('.pack-grid [data-item-id]'),
      );
      const same = cards.find((card) => card.dataset.itemId === origin.itemId);
      (same ?? cards[Math.min(origin.position, cards.length - 1)] ?? pack).focus({
        preventScroll: true,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [selected]);
  const hero = CLASSES.find((c) => c.id === save.classId)!;
  const stats = useMemo(() => computeStats(save), [save]);
  useEffect(() => {
    if (!item || equipped) return;
    const index = visibleItems.findIndex((entry) => entry.id === item.id);
    if (index < 0) selectItem('');
    else setPage(Math.floor(index / BACKPACK_PAGE_SIZE) + 1);
  }, [item, equipped, visibleItems, selectItem]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 960px)');
    const sync = () => setDossierOpen(!media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return (
    <>
      <PendingLoot />
      <div className="equipment-workspace" data-inspecting={!!item}>
        <div className="system-columns equipment-browser">
          <section>
            <div className="mobile-character-summary">
              <CharacterPreview classId={save.classId} equipment={save.equipment} />
              <div>
                <strong>
                  {hero.name} · Lv. {save.level}
                </strong>
                <span>
                  {hero.mainStat} · {hero.title}
                </span>
                <small>
                  攻击 {formatBigNumber(stats.attack)} · 护甲 {formatBigNumber(stats.armor)} · 生命{' '}
                  {formatBigNumber(stats.hp)}
                </small>
              </div>
            </div>
            <details className="mobile-character-dossier" open={dossierOpen}>
              <summary
                onClick={(event) => {
                  event.preventDefault();
                  setDossierOpen((value) => !value);
                }}
              >
                {dossierOpen ? '收起穿戴' : '查看穿戴'}
              </summary>
              <div
                className="character-dossier"
                style={{ '--class-color': hero.color } as CSSProperties}
              >
                <div className="dossier-top">
                  <span className="eyebrow">已穿戴</span>
                  <span>Lv. {save.level}</span>
                </div>
                <div className="paperdoll-slots">
                  {SLOTS.map((slot) => (
                    <button
                      key={slot}
                      className={`paperdoll-slot ${save.equipment[slot] ? 'occupied' : ''}`}
                      style={{
                        color: save.equipment[slot]
                          ? RARITY_COLORS[save.equipment[slot]!.rarity]
                          : undefined,
                      }}
                      onClick={(event) => {
                        const worn = save.equipment[slot];
                        if (worn) openItem(worn.id, event.currentTarget);
                        else browseSlot(slot);
                      }}
                      aria-pressed={!!selected && save.equipment[slot]?.id === selected}
                      data-item-id={save.equipment[slot]?.id}
                      title={
                        save.equipment[slot]
                          ? equipmentName(save.equipment[slot]!)
                          : `查找可穿戴的${SLOT_NAMES[slot]}`
                      }
                    >
                      {save.equipment[slot] ? (
                        <ItemIcon item={save.equipment[slot]!} size={34} />
                      ) : (
                        <EquipmentIcon slot={slot} />
                      )}
                      <small>{SLOT_NAMES[slot]}</small>
                      {save.forge[slot] > 0 && <b>+{save.forge[slot]}</b>}
                    </button>
                  ))}
                </div>
                <div className="dossier-emblem">
                  <CharacterPreview classId={save.classId} equipment={save.equipment} />
                  <span className="sigil-ring" />
                </div>
                <h3>
                  {hero.name} <small>{hero.mainStat}</small>
                </h3>
                <p className="muted">{hero.title}</p>
                <div className="dossier-numbers">
                  <span>
                    <Sword size={15} />
                    {formatBigNumber(stats.attack)}
                    <small>攻击</small>
                  </span>
                  <span>
                    <Shield size={15} />
                    {formatBigNumber(stats.armor)}
                    <small>护甲</small>
                  </span>
                  <span>
                    <CircleDot size={15} />
                    {formatBigNumber(stats.hp)}
                    <small>生命</small>
                  </span>
                </div>
              </div>
              <button
                className="ghost-button wide"
                aria-expanded={showStats}
                onClick={() => setShowStats(!showStats)}
              >
                {showStats ? '收起' : '查看'}完整属性面板 <ChevronRight size={14} />
              </button>
              {showStats && (
                <div className="stats-grid">
                  {Object.entries(stats).map(([key, value]) => (
                    <div className="stat" key={key}>
                      <span>{statNames[key as keyof Stats]}</span>
                      <b>
                        {Array.isArray(value)
                          ? `×${value.reduce((n, v) => n * (1 + v), 1).toFixed(2)}`
                          : percentStats.includes(key)
                            ? `${(value * 100).toFixed(1)}%`
                            : typeof value === 'number'
                              ? value.toFixed(key === 'attackSpeed' ? 2 : 0)
                              : value}
                      </b>
                    </div>
                  ))}
                </div>
              )}
            </details>
          </section>
          <section className="pack-inventory" ref={packRef} tabIndex={-1} aria-label="行囊">
            <div className="section-heading pack-heading">
              <h3>行囊</h3>
              <span
                className="pack-capacity"
                title={`空余 ${MAX_INVENTORY - save.inventory.length} 格`}
              >
                {save.inventory.length} / {MAX_INVENTORY}
              </span>
              <button
                type="button"
                className="pack-organize-toggle outline-button"
                aria-pressed={batch.active}
                disabled={!save.inventory.length && !batch.active}
                onClick={() => {
                  if (!batch.active && item) selectItem('');
                  batch.toggleMode();
                }}
              >
                {batch.active ? '完成整理' : '批量整理'}
              </button>
            </div>
            <div className="pack-tools" onChangeCapture={() => changePage(1)}>
              <input
                className="pack-search"
                type="search"
                aria-label="搜索背包装备"
                placeholder="搜索名称、词条或职业"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button
                type="button"
                className="pack-filter-toggle outline-button"
                aria-controls="pack-filters"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                筛选{filterCount > 0 ? ` · ${filterCount}` : ''}
              </button>
              <select
                className="system-select pack-sort"
                aria-label="背包装备排序"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="recent">最近入包</option>
                <option value="rarity">品质优先</option>
                <option value="level">等级优先</option>
                <option value="attack">基础攻击优先</option>
                <option value="armor">基础护甲优先</option>
              </select>
            </div>
            {filtersOpen && (
              <div className="pack-filters" id="pack-filters" onChangeCapture={() => changePage(1)}>
                <label>
                  <span>部位</span>
                  <select
                    className="system-select"
                    aria-label="筛选装备部位"
                    value={slotFilter}
                    onChange={(event) => setSlotFilter(event.target.value as Slot | 'all')}
                  >
                    <option value="all">全部部位</option>
                    {SLOTS.map((slot) => (
                      <option key={slot} value={slot}>
                        {SLOT_NAMES[slot]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>品质</span>
                  <select
                    className="system-select"
                    aria-label="筛选装备品质"
                    value={rarity}
                    onChange={(event) => setRarity(event.target.value)}
                  >
                    <option value="all">全部品质</option>
                    {backpackRarities.map((value) => (
                      <option key={value} value={value}>
                        {RARITY_NAMES[value]}
                        {value === 'legendary' || value === 'set' ? '（含太古）' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>职业</span>
                  <select
                    className="system-select"
                    aria-label="筛选适用职业"
                    value={ownership}
                    onChange={(event) => setOwnership(event.target.value)}
                  >
                    <option value="all">全部装备</option>
                    <option value="usable">本职业可用</option>
                    <option value="other">其他职业专属</option>
                  </select>
                </label>
                <label className="pack-lock-filter">
                  <input
                    type="checkbox"
                    checked={lockedOnly}
                    onChange={(event) => setLockedOnly(event.target.checked)}
                  />
                  仅已锁定
                </label>
              </div>
            )}
            <div className="pack-list-heading">
              <span role="status">
                {hasFilters ? '符合条件' : '全部装备'} · {visibleItems.length} 件
              </span>
              {hasFilters && (
                <button className="ghost-button pack-reset" onClick={resetFilters}>
                  清空筛选
                </button>
              )}
              {!batch.active && emptyPicks.length > 0 && (
                <button
                  className="ghost-button pack-fill"
                  data-sound="equip"
                  title="同部位优先穿戴基础攻击与护甲之和最高的一件"
                  onClick={store.equipEmptySlots}
                >
                  <Shirt size={15} /> 补齐 {emptyPicks.length} 个空位
                </button>
              )}
              <BackpackPages
                page={currentPage}
                count={pageCount}
                position="顶部"
                onPage={changePage}
              />
            </div>
            <BackpackOrganizer batch={batch} />
            <div
              className="item-grid pack-grid"
              role="group"
              aria-label="行囊物品"
              onKeyDown={navigatePackGrid}
              onFocusCapture={(event) => {
                const id = event.target instanceof HTMLButtonElement && event.target.dataset.itemId;
                if (id) setFocusedId(id);
              }}
            >
              {pageItems.map((entry) => {
                const profession = itemClass(entry);
                const otherClass = profession && profession !== save.classId;
                return (
                  <ItemTile
                    key={entry.id}
                    item={entry}
                    tabIndex={entry.id === tabStop ? 0 : -1}
                    selected={!batch.active && entry.id === selected}
                    marked={batch.active ? batch.has(entry.id) : undefined}
                    hintKind={otherClass ? 'class' : 'empty-slot'}
                    hint={
                      otherClass
                        ? `${professionNames.get(profession)}专属`
                        : !save.equipment[entry.slot]
                          ? '可补位'
                          : undefined
                    }
                    onClick={(event) =>
                      batch.active
                        ? batch.toggleItem(entry.id)
                        : openItem(entry.id, event.currentTarget)
                    }
                  />
                );
              })}
            </div>
            <BackpackPages
              page={currentPage}
              count={pageCount}
              position="底部"
              onPage={(next) => changePage(next, true)}
            />
            {!visibleItems.length && (
              <div className="system-empty pack-empty">
                <Package size={32} />
                <p>
                  {save.inventory.length
                    ? '没有符合条件的装备'
                    : '行囊空了。下一场远征的掉落会放在这里。'}
                </p>
              </div>
            )}
            {save.inventory.length >= MAX_INVENTORY - 10 && (
              <p className="muted system-hint">
                背包空间紧张。远征溢出的传奇、套装、太古和受保护的稀有底材先入共享仓库，仓库满后保留待领。可批量分解的溢出装备转为材料。
              </p>
            )}
          </section>
        </div>
        <EquipmentInspector
          item={item}
          compare={item && !equipped ? save.equipment[item.slot] : undefined}
          caption={equipped ? '当前穿戴' : usable ? '行囊装备' : '其他职业专属'}
          onClose={closeItem}
        >
          {item && (
            <>
              <div className="button-row">
                <button
                  className="gold-button"
                  data-sound="equip"
                  disabled={!usable || (equipped && save.inventory.length >= MAX_INVENTORY)}
                  onClick={() => (equipped ? store.unequip(item.slot) : store.equip(item.id))}
                >
                  {equipped ? <Check size={16} /> : <Sword size={16} />}
                  {!usable
                    ? '其他职业专属'
                    : equipped
                      ? save.inventory.length >= MAX_INVENTORY
                        ? '背包已满'
                        : '卸下装备'
                      : '穿戴装备'}
                </button>
                {!equipped && (
                  <button
                    className="outline-button"
                    disabled={!!store.labBackup || stash.length >= MAX_STASH}
                    onClick={() => {
                      store.depositItem(item.id);
                      afterItemRemoved();
                    }}
                  >
                    {store.labBackup
                      ? '演武期间不可存入'
                      : stash.length >= MAX_STASH
                        ? '共享仓库已满'
                        : '存入共享仓库'}
                  </button>
                )}
              </div>
              {!equipped && (
                <SalvageButton key={item.id} item={item} onSalvaged={afterItemRemoved} />
              )}
            </>
          )}
        </EquipmentInspector>
      </div>
    </>
  );
}

function StashPanel({ selected, selectItem, closeItem }: EquipmentSelection) {
  const store = useGameStore();
  const account = store.accounts.find((entry) => entry.id === store.activeAccountId)!;
  const [filter, setFilter] = useState('all');
  const locked = !!store.labBackup || store.inCombat || store.cloudTransition;
  const inStash = account.stash.some((item) => item.id === selected);
  const item = [...account.stash, ...store.save.inventory].find((entry) => entry.id === selected);
  const filterItems = (items: Item[]) =>
    items.filter(
      (entry) =>
        filter === 'all' ||
        (filter === 'usable'
          ? !itemClass(entry) || itemClass(entry) === store.save.classId
          : itemClass(entry) === filter),
    );
  return (
    <>
      <PendingLoot />
      <div className="equipment-workspace" data-inspecting={!!item}>
        <div className="equipment-browser">
          <p className="muted">
            {account.name}的共享仓库。存取保留装备、词条、宝石和洗练进度；角色背包不会随切换而共用。
          </p>
          {locked && <p className="positive">演武与远征期间不能存取仓库，请先返回开荒营地。</p>}
          <label className="stash-filter">
            装备职业
            <select
              className="system-select"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="all">全部装备</option>
              <option value="usable">当前角色可用</option>
              {CLASSES.map((hero) => (
                <option key={hero.id} value={hero.id}>
                  {hero.name}专属
                </option>
              ))}
            </select>
          </label>
          <div className="system-columns stash-columns">
            <section>
              <div className="section-heading">
                <h3>角色背包</h3>
                <span>
                  {store.save.inventory.length} / {MAX_INVENTORY}
                </span>
              </div>
              <div className="item-grid">
                {filterItems(store.save.inventory).map((entry) => (
                  <ItemTile
                    key={entry.id}
                    item={entry}
                    selected={selected === entry.id}
                    onClick={(event) => selectItem(entry.id, event.currentTarget)}
                  />
                ))}
              </div>
              {!filterItems(store.save.inventory).length && (
                <Empty>暂无符合筛选条件的背包装备。</Empty>
              )}
            </section>
            <section>
              <div className="section-heading">
                <h3>账号共享仓库</h3>
                <span>
                  {account.stash.length} / {MAX_STASH}
                </span>
              </div>
              <div className="item-grid">
                {filterItems(account.stash).map((entry) => (
                  <ItemTile
                    key={entry.id}
                    item={entry}
                    selected={selected === entry.id}
                    onClick={(event) => selectItem(entry.id, event.currentTarget)}
                  />
                ))}
              </div>
              {!filterItems(account.stash).length && (
                <Empty>把异职业装备或备用装备存入这里，供同账号角色领取。</Empty>
              )}
            </section>
          </div>
        </div>
        <EquipmentInspector
          item={item}
          compare={item ? store.save.equipment[item.slot] : undefined}
          caption={inStash ? '存于共享仓库' : '存于角色行囊'}
          onClose={closeItem}
        >
          {item && (
            <button
              className="gold-button"
              data-sound="equip"
              disabled={
                locked ||
                (inStash
                  ? store.save.inventory.length >= MAX_INVENTORY
                  : account.stash.length >= MAX_STASH)
              }
              onClick={() => {
                if (inStash) store.withdrawItem(item.id);
                else store.depositItem(item.id);
              }}
            >
              {locked
                ? '当前状态不可存取'
                : inStash
                  ? store.save.inventory.length >= MAX_INVENTORY
                    ? '角色背包已满'
                    : '取出到当前角色背包'
                  : account.stash.length >= MAX_STASH
                    ? '共享仓库已满'
                    : '存入账号共享仓库'}
            </button>
          )}
        </EquipmentInspector>
      </div>
    </>
  );
}

function SkillsPanel({ selected: inspected, selectItem, closeItem }: EquipmentSelection) {
  const store = useGameStore();
  const { save } = store;
  const nodes = SKILLS.filter((n) => n.classId === save.classId);
  const points = skillPoints(save);
  const learnable = nodes.filter((n) => skillLearningStatus(save, n).canLearn);
  const next = learnable.find((n) => n.kind === 'movement' && !save.skills[n.id]) ?? learnable[0];
  const [recommended, setRecommended] = useState('');
  const selected =
    inspected ||
    SETS.find((entry) => entry.id === recommended)?.skillId ||
    next?.id ||
    nodes[0]?.id;
  const description = useRef<HTMLButtonElement>(null);
  const node = nodes.find((n) => n.id === selected);
  const status = node ? skillLearningStatus(save, node) : undefined;
  useEffect(() => {
    if (inspected && window.matchMedia('(max-width: 960px)').matches) {
      description.current?.focus({ preventScroll: true });
      description.current?.closest('.modal-body')?.scrollTo({ top: 0 });
    }
  }, [inspected]);
  const recommend = (setId: string) => {
    const build = SETS.find((entry) => entry.id === setId && entry.classId === save.classId);
    if (!build) return;
    store.recommendSkills(build.id);
    setRecommended(build.id);
  };
  return (
    <>
      <div className="mobile-skill-toolbar">
        <div className="skill-overview">
          <div>
            <h3>战斗技能</h3>
            <p>
              {nodes.filter((skill) => skill.kind !== 'passive' && !!save.skills[skill.id]).length}{' '}
              项主动已掌握 · {points} 点可分配
            </p>
          </div>
          {next && (
            <button
              className="outline-button"
              onClick={(event) => selectItem(next.id, event.currentTarget)}
            >
              <SkillIcon skillId={next.id} size={24} />
              {next.kind === 'movement' && !save.skills[next.id] ? '学习位移' : '可提升'} ·{' '}
              {next.name}
            </button>
          )}
        </div>
        <div className="system-toolbar">
          <span className="skill-points">
            <Sparkles size={17} />
            可用技能点 <b>{points}</b>
          </span>
          <button
            className="ghost-button"
            onClick={() => {
              store.resetSkills();
              setRecommended('');
            }}
          >
            <RotateCcw size={14} />
            免费洗点
          </button>
        </div>
        <div className="panel-tabs">
          {SETS.filter((t) => t.classId === save.classId).map((t) => (
            <button
              key={t.id}
              className={recommended === t.id ? 'active' : ''}
              aria-pressed={recommended === t.id}
              onClick={() => recommend(t.id)}
            >
              {t.name} · 推荐加点
            </button>
          ))}
        </div>
        <select
          className="mobile-build-recommend"
          aria-label="流派推荐加点"
          value={recommended}
          onChange={(event) => recommend(event.target.value)}
        >
          <option value="">选择推荐加点（可选）</option>
          {SETS.filter((entry) => entry.classId === save.classId).map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
        <p className="muted system-hint">
          已分配 {skillPointBudget(save.level) - points} / {skillPointBudget(save.level)} 点，
          满级总预算 {skillPointBudget(100)} 点。
          {nextSkillPointLevel(save.level)
            ? `下一点在 Lv.${nextSkillPointLevel(save.level)} 获得。`
            : '已获得全部技能点。'}
          核心强化、辅助分支与备用技能需要取舍；选择流派可推荐加点，仍可免费洗点调整。
        </p>
      </div>
      {node && status && (
        <div
          className={`card skill-description mobile-skill-detail ${inspected ? 'mobile-open' : ''}`}
          aria-label="技能说明"
        >
          <button
            ref={description}
            className="mobile-skill-close ghost-button"
            onClick={closeItem}
            aria-label="关闭技能说明"
          >
            <ArrowLeft size={18} /> 返回技能树
          </button>
          <div>
            <span className="eyebrow">
              {node.kind === 'passive' ? '被动常驻' : '主动技能'} · 等级 {save.skills[node.id] ?? 0}{' '}
              / 5
            </span>
            <div className="item-detail-heading">
              <SkillIcon skillId={node.id} size={42} />
              <h3>{node.name}</h3>
            </div>
            <p>{node.description}</p>
            {node.kind !== 'passive' && (
              <dl className="skill-quick-stats">
                <div>
                  <dt>伤害倍率</dt>
                  <dd>×{node.multiplier}</dd>
                </div>
                <div>
                  <dt>资源消耗</dt>
                  <dd>{node.cost}</dd>
                </div>
                <div>
                  <dt>冷却</dt>
                  <dd>{node.cooldown} 秒</dd>
                </div>
              </dl>
            )}
            {node.parent && (
              <small className="muted">
                前置 · {SKILLS.find((n) => n.id === node.parent)?.name}
              </small>
            )}
          </div>
          <div className="skill-actions">
            <button
              className="gold-button"
              data-sound="upgrade"
              onClick={() => {
                store.allocateSkill(node.id);
                setRecommended('');
              }}
              disabled={!status.canLearn}
            >
              {status.canLearn
                ? `${save.skills[node.id] ? '提升节点' : '学习技能'} · 1 点`
                : status.reason}
              <ArrowUp size={15} />
            </button>
            {node.kind !== 'passive' && !!save.skills[node.id] && (
              <button
                className="ghost-button"
                aria-pressed={isSkillAutoEnabled(save.autoSkills, node)}
                onClick={() => store.toggleAuto(node.id)}
              >
                {isSkillAutoEnabled(save.autoSkills, node)
                  ? '自动施放 · 点击改为手动'
                  : '手动施放 · 点击改为自动'}
              </button>
            )}
          </div>
        </div>
      )}
      <div className="skill-tree mobile-skill-tree">
        <details className="skill-learning-rules">
          <summary>技能学习规则</summary>
          <p className="muted system-hint">
            初始掌握 1 个基础技能；Lv.2–15 每级获得 2 点，之后逐步获得进阶点，满级共{' '}
            {skillPointBudget(100)} 点。 位移 Lv.3 → 核心 Lv.5 → 掌控 Lv.8 → 防御 Lv.10 → 终极
            Lv.15。分支需前置 2 级，每个技能每隔 3 级可再提升一阶。
            <br />
            技能说明以 1 级为基准。每提升 1 级，主动伤害与护盾强度、被动数值收益提高 10%，最高 5
            级（+40%）；穿透、分裂等结构性效果保持，衍生伤害随节点等级提高。
            <br />
            推荐加点会免费重新分配当前等级可用点数，并设置流派的自动施法顺序；可随时手动调整。
          </p>
        </details>
        {[1, 2, 3, 4, 5].map((tier) => (
          <section className="skill-tier" key={tier}>
            <div className="skill-tier-label">
              <span>0{tier}</span>
              <small>{['基础', '核心', '掌控', '终极', '终极被动'][tier - 1]}</small>
            </div>
            <div className="skill-tier-nodes">
              {nodes
                .filter((n) => n.tier === tier)
                .map((n) => (
                  <button
                    key={n.id}
                    className={`skill-node ${save.skills[n.id] ? 'unlocked' : ''} ${save.level < skillUnlockLevel(n) ? 'locked' : ''} ${selected === n.id ? 'selected' : ''}`}
                    aria-pressed={selected === n.id}
                    onClick={(event) => selectItem(n.id, event.currentTarget)}
                    data-item-id={n.id}
                  >
                    <span className="skill-symbol">
                      <SkillIcon skillId={n.id} size={36} />
                    </span>
                    <strong>{n.name}</strong>
                    <small>
                      {n.kind === 'passive' ? '被动' : '主动'} · {save.skills[n.id] ?? 0} / 5
                    </small>
                    <small>
                      {save.level < skillUnlockLevel(n)
                        ? `Lv.${skillUnlockLevel(n)} 解锁`
                        : skillLearningStatus(save, n).canLearn
                          ? '可学习 / 升级'
                          : skillLearningStatus(save, n).reason}
                    </small>
                    {n.parent && (
                      <span className="skill-parent">
                        ↳ {SKILLS.find((p) => p.id === n.parent)?.name}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

function CubePanel() {
  const store = useGameStore();
  const { save } = store;
  const [tab, setTab] = useState<'archive' | 'extract'>('archive');
  return (
    <>
      <p className="muted system-hint">
        萃取将消耗装备、15 奥术结晶与 1
        遗忘之魂，永久收录其传奇特效。共鸣始终按满值生效，同名穿戴与共鸣仅取最高值。
      </p>
      <p className="system-wallet">
        萃取材料 · 奥术结晶 <b>{save.crystals} / 15</b> · 遗忘之魂 <b>{save.souls} / 1</b>
      </p>
      <div className="cube-slots">
        {(['weapon', 'armor', 'jewelry'] as const).map((slot) => {
          const def = LEGENDARIES.find((l) => l.id === save.cube[slot]);
          const duplicate =
            def && Object.values(save.equipment).some((i) => i?.legendaryId === def.id);
          return (
            <div className={`cube-slot ${def ? 'filled' : ''}`} key={slot}>
              <span className="cube-orbit">
                {def ? (
                  <ItemIcon item={{ slot: def.slot, legendaryId: def.id }} size={42} />
                ) : (
                  <EquipmentIcon slot={slot === 'armor' ? 'chest' : slot} size={32} />
                )}
              </span>
              <small>{slot === 'weapon' ? '武器' : slot === 'armor' ? '防具' : '首饰'}共鸣</small>
              <h3>{def?.name ?? '尚未唤醒'}</h3>
              {def && <p>{def.description}</p>}
              {duplicate && <span className="duplicate-warning">同名装备已穿戴 · 不重复叠加</span>}
              {def && (
                <button className="ghost-button" onClick={() => store.clearCube(slot)}>
                  解除共鸣
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="panel-tabs">
        <button className={tab === 'archive' ? 'active' : ''} onClick={() => setTab('archive')}>
          共鸣图鉴 {save.extracted.length} / 45
        </button>
        <button className={tab === 'extract' ? 'active' : ''} onClick={() => setTab('extract')}>
          传奇萃取
        </button>
      </div>
      {tab === 'archive' ? (
        <div className="relic-grid">
          {LEGENDARIES.filter((l) => !l.classId || l.classId === save.classId).map((l) => (
            <article
              key={l.id}
              className={`relic-card ${save.extracted.includes(l.id) ? 'unlocked' : 'locked'}`}
            >
              <div className="relic-heading">
                <ItemIcon item={{ slot: l.slot, legendaryId: l.id }} size={36} />
                <h4>{l.name}</h4>
                {!save.extracted.includes(l.id) && <Lock size={14} />}
              </div>
              <p>{l.description}</p>
              <small className="muted">
                {cubeSlot(l.slot) === 'weapon'
                  ? '武器'
                  : cubeSlot(l.slot) === 'armor'
                    ? '防具'
                    : '首饰'}
                槽 · 满值 {l.max}
              </small>
              <button
                className="ghost-button wide"
                disabled={!save.extracted.includes(l.id) || Object.values(save.cube).includes(l.id)}
                data-sound="arcane"
                onClick={() => store.equipCube(l.id)}
              >
                {Object.values(save.cube).includes(l.id) ? '已装配' : '装配共鸣'}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="relic-grid">
          {save.inventory
            .filter((i) => i.legendaryId)
            .map((i) => (
              <ItemDetails key={i.id} item={i}>
                <ExtractButton item={i} />
              </ItemDetails>
            ))}
          {!save.inventory.some((i) => i.legendaryId) && (
            <Empty>行囊中暂无可萃取的传奇散件。</Empty>
          )}
        </div>
      )}
    </>
  );
}

function GamblePanel() {
  const store = useGameStore();
  const [slot, setSlot] = useState<Slot>(
    () =>
      LEGENDARIES.find((l) => l.id === store.save.progression?.hunt?.legendaryId)?.slot ?? 'weapon',
  );
  const [selectedId, setSelectedId] = useState('');
  const selected = [
    ...store.save.inventory,
    ...Object.values(store.save.equipment),
    ...store.lastGamble,
  ].find((item) => item?.id === selectedId);
  const owned = store.save.inventory.some((item) => item.id === selectedId);
  const equipped = selected && store.save.equipment[selected.slot]?.id === selectedId;
  const spaces = MAX_INVENTORY - store.save.inventory.length;
  return (
    <>
      <div className="mia-quote">
        <span className="mia-sigil">✧</span>
        <div>
          <h3>“命运从不明码标价，亲爱的。”</h3>
          <p>把碎片交给我。也许下一张牌，就能改写你的传说。</p>
        </div>
      </div>
      <div className="slot-selector">
        {SLOTS.map((s) => (
          <button key={s} className={slot === s ? 'active' : ''} onClick={() => setSlot(s)}>
            <EquipmentIcon slot={s} />
            <span>{SLOT_NAMES[s]}</span>
          </button>
        ))}
      </div>
      {(store.save.progression?.clearedStage ?? 0) >= 16 && (
        <label>
          追踪传奇
          <select
            className="system-select"
            value={store.save.progression?.hunt?.legendaryId ?? ''}
            onChange={(e) => {
              const target = LEGENDARIES.find((l) => l.id === e.target.value);
              store.trackLegendary(e.target.value);
              if (target) setSlot(target.slot);
            }}
          >
            <option value="">自由寻宝</option>
            {LEGENDARIES.filter((l) => !l.classId || l.classId === store.save.classId).map((l) => (
              <option key={l.id} value={l.id}>
                {SLOT_NAMES[l.slot]} · {l.name}
              </option>
            ))}
          </select>
          {store.save.progression?.hunt && (
            <small>
              对应部位秘藏进度 {store.save.progression.hunt.misses}/{HUNT_LIMIT} · 第 {HUNT_LIMIT}{' '}
              抽必出，更换目标重置进度。
            </small>
          )}
        </label>
      )}
      <div className="gamble-actions">
        <span>
          持有 <b>{costLabel(store.save.shards)}</b> 神秘碎片
        </span>
        <button
          className="ghost-button"
          data-sound="gamble"
          onClick={() => store.gamble(slot, 1)}
          disabled={store.save.shards < 50 || spaces < 1}
          title={
            spaces < 1
              ? '背包已满，请先整理装备'
              : store.save.shards < 50
                ? '需要 50 神秘碎片'
                : '获得 1 件指定部位装备'
          }
        >
          揭开一张 · 50
        </button>
        <button
          className="gold-button"
          data-sound="gamble"
          onClick={() => store.gamble(slot, 10)}
          disabled={store.save.shards < 500 || spaces < 10}
          title={
            spaces < 10
              ? '需要至少 10 格背包空间'
              : store.save.shards < 500
                ? '需要 500 神秘碎片'
                : '获得 10 件指定部位装备'
          }
        >
          <Dices size={16} />
          十连秘藏 · 500
        </button>
      </div>
      <p className={spaces < 10 ? 'negative system-hint' : 'muted system-hint'}>
        背包剩余 {spaces} 格 · 单抽需 1 格，十连需 10 格。
        {store.save.autoSalvage
          ? store.save.keepRareAffix
            ? `自动分解已开启，保留带「${AFFIXES.find((a) => a.id === store.save.keepRareAffix)?.name}」的稀有底材。`
            : '自动分解已开启，稀有底材也会转为材料。'
          : ''}
      </p>
      <p className="muted system-hint">
        秘藏跟随已通关难度成长；低层不会提前产出传奇、套装或太古。指定部位若没有对应传奇，则转为该阶段可产出的装备。装备留在行囊中。
      </p>
      <LootChances
        stage={Math.max(1, store.save.progression?.clearedStage ?? store.save.highestStage - 1)}
        source="gamble"
      />
      {store.lastGamble.length > 0 ? (
        <div className="gamble-results item-grid" key={store.lastGamble[0].id}>
          {store.lastGamble.map((item, index) => (
            <div key={item.id} style={{ animationDelay: `${index * 0.09}s` }}>
              <ItemTile
                item={item}
                selected={selectedId === item.id}
                onClick={() => setSelectedId(item.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="unopened-cards">
          {[0, 1, 2, 3, 4].map((n) => (
            <div key={n}>
              <Sparkles size={29} />
              <span>?</span>
            </div>
          ))}
        </div>
      )}
      {selected && (
        <ItemDetails
          item={selected}
          compare={equipped ? undefined : store.save.equipment[selected.slot]}
        >
          {owned ? (
            <button
              className="gold-button"
              data-sound="equip"
              onClick={() => store.equip(selected.id)}
            >
              直接穿戴装备
            </button>
          ) : (
            <p className="muted">
              {equipped ? '已穿戴这件装备。' : '这件装备已离开背包；自动分解的结果已兑换材料。'}
            </p>
          )}
        </ItemDetails>
      )}
    </>
  );
}

function RareAffixFilter() {
  const keep = useGameStore((state) => state.save.keepRareAffix);
  const update = useGameStore((state) => state.updateSettings);
  return (
    <label>
      分解时保留的稀有词条
      <select
        className="system-select"
        value={keep ?? ''}
        onChange={(e) => update({ keepRareAffix: e.target.value || undefined })}
      >
        <option value="">不限词条，按原规则分解</option>
        {AFFIXES.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <small>
        自动与批量分解都会保留带此词条的稀有底材。远征时背包已满，受保护的底材会转入共享仓库或保留待领。
      </small>
    </label>
  );
}
function RareCraftPanel() {
  const { save, craftRare } = useGameStore();
  const [baseId, setBase] = useState('');
  const [donorId, setDonor] = useState('');
  const [affixId, setAffix] = useState('');
  const bases = [...Object.values(save.equipment), ...save.inventory].filter(
    (i): i is Item =>
      !!i &&
      i.rarity === 'rare' &&
      i.affixes.length >= 2 &&
      i.affixes.length < 4 &&
      (!itemClass(i) || itemClass(i) === save.classId),
  );
  const base = bases.find((i) => i.id === baseId);
  const donors = base
    ? save.inventory.filter((i) => i.affixes.some((a) => craftRecipe(base, i, a.id)))
    : [];
  const donor = donors.find((i) => i.id === donorId);
  const recipe = base && donor && craftRecipe(base, donor, affixId);
  const options = (items: Item[]) =>
    items.map((i) => (
      <option key={i.id} value={i.id}>
        {i.name} Lv.{i.level} · {i.affixes.map((a) => affixLabel(a.id, a.value)).join(' / ')}
      </option>
    ));
  return (
    <div className="system-columns">
      <section>
        <h3>选择稀有底材</h3>
        <RareAffixFilter />
        <p>保留已有词条，为稀有装备追加至四条。加工过的底材会在一键分解时保留。</p>
        <p className="muted">主副手按职业打造，通用护甲与首饰可跨职业使用。</p>
        <select
          className="system-select"
          aria-label="稀有底材"
          value={base?.id ?? ''}
          onChange={(e) => {
            setBase(e.target.value);
            setDonor('');
            setAffix('');
          }}
        >
          <option value="">
            {bases.length ? '选择要加工的装备' : '行囊或身上需要一件稀有装备'}
          </option>
          {options(bases)}
        </select>
        {base && <ItemDetails item={base} />}
      </section>
      {base && (
        <section>
          <h3>选取素材词条</h3>
          <p>消耗一件行囊里的稀有或史诗散件，刻入一种新属性。素材数值越高，刻印越强。</p>
          <select
            className="system-select"
            aria-label="刻印素材"
            value={donor?.id ?? ''}
            onChange={(e) => {
              setDonor(e.target.value);
              setAffix('');
            }}
          >
            <option value="">
              {donors.length ? '选择消耗的装备' : '需要一件带有不同词条的素材'}
            </option>
            {options(donors)}
          </select>
          {donor && (
            <select
              className="system-select"
              aria-label="刻印词条"
              value={affixId}
              onChange={(e) => setAffix(e.target.value)}
            >
              <option value="">选择要追加的词条</option>
              {donor.affixes.map((a) => {
                const r = craftRecipe(base, donor, a.id);
                return (
                  r && (
                    <option key={a.id} value={a.id}>
                      {affixLabel(a.id, r.value)}
                    </option>
                  )
                );
              })}
            </select>
          )}
          {recipe && donor && (
            <div className="operation-review">
              <p>
                消耗「{donor.name}」，向「{base.name}」追加 {affixLabel(affixId, recipe.value)}
                。素材上的宝石会返还。
              </p>
              <button
                className="gold-button"
                disabled={save.gold < recipe.gold || save.crystals < recipe.crystals}
                onClick={() => {
                  craftRare(base.id, donor.id, affixId);
                  setDonor('');
                  setAffix('');
                }}
              >
                确认刻印 · {recipe.gold} 金 + {recipe.crystals} 结晶
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function CampWorkshop() {
  const { save, setCampFocus } = useGameStore();
  const rates = campRates(save);
  return (
    <section>
      <h3>离线备料</h3>
      <p>
        单人三次通关的最高共同层数为 {rates.stableStage} 层，每十层提升产率。离线最多累计八小时。
      </p>
      <select
        className="system-select"
        aria-label="离线备料方向"
        value={save.progression?.campFocus ?? 'crystals'}
        onChange={(e) => setCampFocus(e.target.value === 'shards' ? 'shards' : 'crystals')}
      >
        <option value="crystals">备结晶 · 铁匠加工</option>
        <option value="shards">备碎片 · 部位秘藏</option>
      </select>
      <p>
        每小时 {rates.gold} 金币 · {rates.crystals} 结晶 · {rates.shards} 碎片
      </p>
    </section>
  );
}
function ForgePanel() {
  const store = useGameStore();
  const { save } = store;
  const [tab, setTab] = useState('forge');
  const [slot, setSlot] = useState<Slot>('weapon');
  const [id, setId] = useState('');
  const [reforgeIndex, setReforgeIndex] = useState<number | null>(null);
  const items = [...Object.values(save.equipment).filter((i): i is Item => !!i), ...save.inventory];
  const item = items.find((i) => i.id === id);
  return (
    <>
      <div className="system-wallet">
        <span>
          金币 <b>{costLabel(save.gold)}</b>
        </span>
        <span>
          奥术结晶 <b>{save.crystals}</b>
        </span>
        <span>
          遗忘之魂 <b>{save.souls}</b>
        </span>
      </div>
      <div className="panel-tabs">
        {[
          ['forge', '神铸强化'],
          ['craft', '稀有刻印'],
          ['camp', '离线备料'],
          ['reforge', '词条洗练'],
          ['salvage', '装备分解'],
          ['gems', '宝石工坊'],
        ].map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'forge' && (
        <>
          <p className="muted system-hint">
            神铸绑定槽位，换装继承。每级提升该槽装备基础攻击与护甲 4%，最高 +50。
          </p>
          <div className="forge-grid">
            {SLOTS.map((s) => (
              <article className="forge-slot card" key={s}>
                <EquipmentIcon slot={s} size={30} />
                <div>
                  <h3>
                    {SLOT_NAMES[s]} <em>+{save.forge[s]}</em>
                  </h3>
                  <small>
                    {save.equipment[s]?.name ?? '暂无装备'} · 白字 +{save.forge[s] * 4}%
                  </small>
                  <div className="mini-progress">
                    <i style={{ width: `${save.forge[s] * 2}%` }} />
                  </div>
                </div>
                <button
                  className="gold-button"
                  data-sound="forge"
                  onClick={() => store.upgradeForge(s)}
                  disabled={
                    save.forge[s] >= 50 ||
                    save.gold < 100 + save.forge[s] * 80 ||
                    save.crystals < 5 + save.forge[s] * 2
                  }
                  title={
                    save.forge[s] >= 50
                      ? '该槽位已强化到上限'
                      : save.gold < 100 + save.forge[s] * 80 ||
                          save.crystals < 5 + save.forge[s] * 2
                        ? '金币或奥术结晶不足'
                        : '强化槽位，之后更换装备依然继承'
                  }
                >
                  {save.forge[s] >= 50 ? '已满级' : '神铸'}
                  <small>
                    {100 + save.forge[s] * 80} 金 / {5 + save.forge[s] * 2} 结晶
                  </small>
                </button>
              </article>
            ))}
          </div>
        </>
      )}
      {tab === 'craft' && <RareCraftPanel />}
      {tab === 'camp' && <CampWorkshop />}
      {tab === 'reforge' && (
        <div className="system-columns">
          <section>
            <p className="muted system-hint">
              首次洗练锁定词条位置，其余词条保持不变。太古装备的新词条仍为上限的 130%。
            </p>
            <select
              aria-label="选择要洗练的装备"
              className="system-select"
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                setReforgeIndex(null);
              }}
            >
              <option value="">选择一件装备</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {save.equipment[i.slot]?.id === i.id ? '已穿戴' : '背包'} · {SLOT_NAMES[i.slot]} ·{' '}
                  {i.name} Lv.{i.level}
                </option>
              ))}
            </select>
            {item && <ItemDetails item={item} />}
          </section>
          <section>
            {item ? (
              <>
                <h3>选择要洗练的词条</h3>
                {item.affixes.map((a, index) => (
                  <div className="reforge-row" key={index}>
                    <span>
                      {affixLabel(a.id, a.value)}
                      {item.reforged === index && <small>已锁定洗练位置</small>}
                    </span>
                    <button
                      className="ghost-button"
                      disabled={
                        (item.reforged !== undefined && item.reforged !== index) ||
                        save.gold < 200 ||
                        save.crystals < 8
                      }
                      data-sound="forge"
                      onClick={() =>
                        item.reforged === undefined
                          ? setReforgeIndex(index)
                          : store.reforge(item.id, index)
                      }
                    >
                      <RotateCcw size={14} />
                      {item.reforged !== undefined && item.reforged !== index
                        ? '位置已锁定'
                        : save.gold < 200 || save.crystals < 8
                          ? '材料不足'
                          : '重铸'}
                    </button>
                  </div>
                ))}
                {reforgeIndex !== null && item.reforged === undefined && (
                  <div className="operation-review">
                    <p>
                      首次洗练后，仅第 {reforgeIndex + 1}{' '}
                      条词条可以反复重铸，无法改选其他位置。将随机替换「
                      {affixLabel(item.affixes[reforgeIndex].id, item.affixes[reforgeIndex].value)}
                      」。
                    </p>
                    <div className="button-row">
                      <button
                        className="gold-button"
                        data-sound="forge"
                        disabled={save.gold < 200 || save.crystals < 8}
                        onClick={() => {
                          store.reforge(item.id, reforgeIndex);
                          setReforgeIndex(null);
                        }}
                      >
                        锁定此位置并洗练 · 200 金 + 8 结晶
                      </button>
                      <button className="ghost-button" onClick={() => setReforgeIndex(null)}>
                        重新选择
                      </button>
                    </div>
                  </div>
                )}
                <p className="muted system-hint">
                  每次消耗 200 金币 + 8 奥术结晶。按词条权重随机重铸并立即应用。
                </p>
              </>
            ) : (
              <Empty>选择装备，唤醒沉睡的潜能。</Empty>
            )}
          </section>
        </div>
      )}
      {tab === 'salvage' && (
        <>
          <div className="system-toolbar">
            <span className="muted">镶嵌宝石会无损返还。</span>
            <button
              className="gold-button"
              data-sound="forge"
              disabled={!save.inventory.some((item) => bulkSalvageable(item, save.keepRareAffix))}
              onClick={store.salvageLow}
            >
              分解史诗及以下（保留刻印和筛选底材） ·{' '}
              {save.inventory.filter((item) => bulkSalvageable(item, save.keepRareAffix)).length} 件
            </button>
          </div>
          <div className="relic-grid">
            {save.inventory.map((i) => (
              <div key={i.id} className="salvage-card">
                <ItemTile item={i} />
                <SalvageButton item={i} />
              </div>
            ))}
          </div>
          {!save.inventory.length && <Empty>背包里没有待分解装备。</Empty>}
        </>
      )}
      {tab === 'gems' && (
        <>
          <div className="system-toolbar">
            <label>
              镶嵌部位{' '}
              <select
                className="system-select"
                value={slot}
                onChange={(e) => setSlot(e.target.value as Slot)}
              >
                {SLOTS.map((s) => (
                  <option key={s} value={s}>
                    {SLOT_NAMES[s]} {save.equipment[s] ? '' : '（空）'}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="ghost-button"
              onClick={() => store.removeGem(slot)}
              disabled={!save.equipment[slot]?.gem}
            >
              无损拆卸
            </button>
          </div>
          <p className="muted system-hint">
            同色同阶宝石三合一。每件装备可镶嵌一颗，替换自动返还原宝石。
          </p>
          <p className="positive system-hint">
            {SLOT_NAMES[slot]}：{save.equipment[slot]?.name ?? '请先穿戴装备'} ·{' '}
            {save.equipment[slot]?.gem
              ? `已镶嵌 ${save.equipment[slot]!.gem!.level} 阶${GEMS.find((gem) => gem.id === save.equipment[slot]!.gem!.id)?.name}`
              : '尚未镶嵌'}
          </p>
          <div className="gem-grid">
            {GEMS.map((g) => (
              <article
                className="gem-card"
                key={g.id}
                style={{ '--gem': g.color } as CSSProperties}
              >
                <div className="gem-heading">
                  <Gem size={30} />
                  <h3>{g.name}</h3>
                  <button
                    className="ghost-button"
                    data-sound="upgrade"
                    disabled={!save.gems[g.id]?.slice(0, 9).some((count) => count >= 3)}
                    onClick={() => store.combineGems(g.id)}
                  >
                    一键合成
                  </button>
                </div>
                <p>{g.description}</p>
                <div className="gem-levels">
                  {save.gems[g.id]?.map((count, index) => (
                    <button
                      key={index}
                      disabled={!count || !save.equipment[slot]}
                      data-sound="equip"
                      onClick={() => store.socketGem(slot, g.id, index + 1)}
                      title={`镶嵌 ${index + 1} 阶${g.name}`}
                    >
                      <b>{['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ'][index]}</b>
                      <small>×{count}</small>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function recordSet(record: RunRecord) {
  const counts = new Map<string, number>();
  for (const item of Object.values(record.build.equipment))
    if (item?.setId) counts.set(item.setId, (counts.get(item.setId) ?? 0) + 1);
  const strongest = [...counts].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1])[0];
  return SETS.find((set) => set.id === strongest?.[0]);
}
function LeaderboardPanel({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate?: (panel: string) => void;
}) {
  const store = useGameStore();
  const account = store.accounts.find((entry) => entry.id === store.activeAccountId)!;
  const [source, setSource] = useState<'local' | 'cloud' | 'verified'>('local');
  const [ruleset, setRuleset] = useState(CURRENT_TRIAL_RULESET);
  const [classId, setClassId] = useState<ClassId>((store.labBackup ?? store.save).classId);
  const [buildId, setBuildId] = useState('all');
  const [reload, setReload] = useState(0);
  const [online, setOnline] = useState<{
    data: LeaderboardResponse | null;
    loading: boolean;
    error: string;
  }>({ data: null, loading: false, error: '' });
  const hero = CLASSES.find((entry) => entry.id === classId)!;
  useEffect(() => {
    if (source === 'local') return;
    let active = true;
    setOnline({ data: null, loading: true, error: '' });
    void apiRequest<LeaderboardResponse>(
      `/leaderboard${source === 'verified' ? '/verified' : ''}?classId=${classId}${source === 'verified' ? `&ruleset=${ruleset}` : ''}`,
    )
      .then((data) => {
        if (data.classId !== classId || data.source !== source || !Array.isArray(data.entries))
          throw new Error('在线榜暂不可用，请稍后再试。');
        if (active) setOnline({ data, loading: false, error: '' });
      })
      .catch((error: unknown) => {
        if (active)
          setOnline({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : '在线榜暂不可用。',
          });
      });
    return () => {
      active = false;
    };
  }, [source, classId, ruleset, reload]);
  const localRecords = account.characters
    .flatMap((character) => {
      const save =
        character.id === account.activeCharacterId
          ? (store.labBackup ?? store.save)
          : character.save;
      return (save.runRecords ?? []).map((record) => ({ record, character }));
    })
    .filter(({ record }) => record.build.classId === classId)
    .sort(
      (a, b) =>
        b.record.stage - a.record.stage ||
        a.record.seconds - b.record.seconds ||
        a.record.date - b.record.date,
    )
    .slice(0, 20)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  const matchesBuild = (setId?: string) =>
    buildId === 'all' || (buildId === 'custom' ? !setId : buildId === setId);
  const visibleLocal = localRecords.filter(({ record }) => matchesBuild(recordSet(record)?.id));
  const cloudData =
    online.data?.classId === classId &&
    online.data.source === source &&
    (source !== 'verified' || online.data.ruleset === ruleset)
      ? online.data
      : null;
  const visibleOnline = (cloudData?.entries ?? []).filter((entry) =>
    matchesBuild(SETS.find((set) => set.name === entry.setName)?.id),
  );
  const buildLabel = (setId?: string) => {
    const set = SETS.find((entry) => entry.id === setId);
    if (!set) return '自定义配装 · 未形成两件套共鸣';
    return `${BUILD_GUIDES[set.id]?.style ?? set.name} · 核心：${SKILLS.find((skill) => skill.id === set.skillId)?.name ?? '自定义'}`;
  };
  return (
    <section className="class-leaderboard">
      <div className="section-heading">
        <h3 style={{ color: hero.color }}>
          {hero.name} ·{' '}
          {source === 'local' ? '本机职业榜' : source === 'verified' ? '验证挑战榜' : '社区职业榜'}
        </h3>
        <span>按层数降序 · 同层按用时升序</span>
      </div>
      <div className="leaderboard-sources" role="group" aria-label="榜单来源">
        <button
          className={source === 'local' ? 'gold-button' : 'ghost-button'}
          aria-pressed={source === 'local'}
          onClick={() => setSource('local')}
        >
          本机战绩
        </button>
        <button
          className={source === 'cloud' ? 'gold-button' : 'ghost-button'}
          aria-pressed={source === 'cloud'}
          onClick={() => setSource('cloud')}
        >
          社区职业榜
        </button>
        <button
          className={source === 'verified' ? 'gold-button' : 'ghost-button'}
          aria-pressed={source === 'verified'}
          onClick={() => setSource('verified')}
        >
          验证挑战榜
        </button>
        {source !== 'local' && (
          <button
            className="ghost-button"
            disabled={online.loading}
            onClick={() => setReload((value) => value + 1)}
          >
            <RotateCcw size={14} />
            {online.loading ? '正在读取…' : '刷新榜单'}
          </button>
        )}
      </div>
      {source === 'verified' && (
        <div className="operation-review">
          <label>
            试炼规则{' '}
            <select
              value={ruleset}
              onChange={(event) => {
                setRuleset(Number(event.target.value));
                setBuildId('all');
              }}
            >
              <option value={CURRENT_TRIAL_RULESET}>当前 · 第 {CURRENT_TRIAL_RULESET} 版</option>
              <option value={1}>历史 · 初版</option>
            </select>
          </label>
          <p>
            {ruleset === CURRENT_TRIAL_RULESET
              ? '使用统一配装挑战第 150 层，服务器按本版规则记录成绩。'
              : '初版试炼已结束。这里保留当时的成绩与配装名称。'}
          </p>
          <button
            className="gold-button"
            disabled={!onNavigate || !!store.labBackup}
            onClick={() => onNavigate?.('trial')}
          >
            {store.labBackup ? '结束流派演武后可验证' : '参加守望者验证试炼'}
          </button>
        </div>
      )}
      <div className="panel-tabs leaderboard-classes" aria-label="职业独立榜单">
        {CLASSES.map((entry) => (
          <button
            key={entry.id}
            className={classId === entry.id ? 'active' : ''}
            aria-pressed={classId === entry.id}
            onClick={() => {
              setClassId(entry.id);
              setBuildId('all');
            }}
          >
            {entry.name}
          </button>
        ))}
      </div>
      {(source !== 'verified' || ruleset === CURRENT_TRIAL_RULESET) && (
        <label className="stash-filter">
          流派筛选
          <select
            className="system-select"
            value={buildId}
            onChange={(event) => setBuildId(event.target.value)}
          >
            <option value="all">全部流派</option>
            {SETS.filter((set) => set.classId === classId).map((set) => (
              <option key={set.id} value={set.id}>
                {set.name} · {BUILD_GUIDES[set.id]?.style}
              </option>
            ))}
            <option value="custom">自定义配装</option>
          </select>
        </label>
      )}
      <div className="leaderboard-meta">
        <span>
          {source !== 'local' && cloudData
            ? `共 ${cloudData.total} ${source === 'verified' ? '条验证成绩' : '位行者'} · ${new Date(cloudData.updatedAt).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Hong_Kong' })} 更新`
            : '每职业前 20 条'}
        </span>
        <details>
          <summary>排行规则</summary>
          <p>
            {source === 'local'
              ? `汇总「${account.name}」各角色的正式通关战绩，保留历史配装体验。`
              : source === 'verified'
                ? '验证挑战使用统一配装与服务器战斗结算，普通远征和上传云档均不计入。'
                : '社区榜按已同步云档记录，每账号每职业保留最佳成绩；客户端结算，仅供交流配装。'}
            层数较高者优先，同层用时较短者优先。流派筛选在该职业前 20 条内进行。
          </p>
        </details>
      </div>
      {source !== 'local' ? (
        <div className="run-leaderboard" aria-busy={online.loading}>
          {online.loading && <Empty>正在读取{hero.name}职业榜…</Empty>}
          {online.error && (
            <div className="operation-review" role="alert">
              <p>{online.error}</p>
              <div className="button-row">
                <button className="ghost-button" onClick={() => setReload((value) => value + 1)}>
                  重新加载
                </button>
                <button className="gold-button" onClick={() => setSource('local')}>
                  查看本机战绩
                </button>
              </div>
            </div>
          )}
          {!online.loading && !online.error && cloudData && !visibleOnline.length && (
            <Empty>
              {buildId === 'all'
                ? source === 'verified'
                  ? ruleset === CURRENT_TRIAL_RULESET
                    ? `尚无${hero.name}验证战绩，参加服务器验证挑战后即可参与。`
                    : `初版未收录${hero.name}的成绩。`
                  : `尚无${hero.name}社区战绩，完成正式远征并同步云档后即可参与。`
                : '当前职业前 20 名中暂无此流派战绩。'}
            </Empty>
          )}
          {visibleOnline.map((entry) => (
            <article className="run-record card" key={`${entry.rank}-${entry.name}`}>
              <div className="run-record-heading">
                <span className="run-rank">{String(entry.rank).padStart(2, '0')}</span>
                <div>
                  <h3>
                    {entry.name}
                    <small>
                      {hero.name} Lv.{entry.level}
                    </small>
                  </h3>
                  <p className="leaderboard-result">
                    第 {entry.stage} 层 · {entry.seconds.toFixed(1)} 秒 · 击败 {entry.kills} 个敌人
                  </p>
                  <p className="muted">
                    {entry.setName ?? '自定义配装'}
                    {(source !== 'verified' || ruleset === CURRENT_TRIAL_RULESET) &&
                      ` · ${buildLabel(SETS.find((set) => set.name === entry.setName)?.id)}`}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="run-leaderboard">
          {visibleLocal.map(({ record, character, rank }) => {
            const set = recordSet(record);
            const switching = character.id !== account.activeCharacterId;
            return (
              <article className="run-record card" key={`${character.id}-${record.id}`}>
                <div className="run-record-heading">
                  <span className="run-rank">{String(rank).padStart(2, '0')}</span>
                  <div>
                    <h3>
                      第 {record.stage} 层
                      <small>
                        {record.seconds.toFixed(1)} 秒 · {hero.name} Lv.{record.build.level}
                      </small>
                    </h3>
                    <p className="muted">
                      {character.name} · {set?.name ?? '自定义配装'} ·{' '}
                      {new Date(record.date).toLocaleString('zh-CN', {
                        timeZone: 'Asia/Hong_Kong',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </p>
                    <p className="leaderboard-build">{buildLabel(set?.id)}</p>
                  </div>
                  <button
                    className="gold-button"
                    data-sound="equip"
                    disabled={
                      store.cloudTransition || store.inCombat || (switching && !!store.labBackup)
                    }
                    onClick={() => {
                      if (switching) store.switchCharacter(character.id);
                      const current = useGameStore.getState();
                      if (
                        current.accounts.find((entry) => entry.id === current.activeAccountId)
                          ?.activeCharacterId !== character.id
                      )
                        return;
                      current.activateRecord(record.id);
                      if (useGameStore.getState().labBackup) onClose();
                    }}
                  >
                    {switching
                      ? store.labBackup
                        ? '结束演武后可体验'
                        : '切换角色并体验'
                      : '体验此配装'}
                    <ChevronRight size={14} />
                  </button>
                </div>
                <details>
                  <summary>查看当时装备与共鸣</summary>
                  <div className="item-grid">
                    {Object.values(record.build.equipment)
                      .filter((item): item is Item => !!item)
                      .map((item) => (
                        <ItemTile key={item.id} item={item} />
                      ))}
                  </div>
                  <p className="muted system-hint">
                    共鸣：
                    {Object.values(record.build.cube)
                      .map((id) => LEGENDARIES.find((legendary) => legendary.id === id)?.name)
                      .filter(Boolean)
                      .join(' · ') || '未装配'}{' '}
                    · 伙伴：{PETS.find((pet) => pet.id === record.build.petId)?.name ?? '未出战'}
                  </p>
                </details>
              </article>
            );
          })}
          {!visibleLocal.length && (
            <>
              <Empty>
                {buildId === 'all'
                  ? `当前账号尚无${hero.name}正式通关记录。演武和训练不会计入。`
                  : '当前职业前 20 次战绩中暂无此流派。'}
              </Empty>
              {onNavigate && (
                <button className="ghost-button" onClick={() => onNavigate('accounts')}>
                  管理角色，开始职业远征
                  <ChevronRight size={14} />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function ServicesPanel({ onNavigate }: { onNavigate?: (panel: string) => void }) {
  const descriptions: Record<string, string> = {
    accounts: '创建角色、切换职业角色、管理云存档',
    stash: '同账号角色之间存取备用装备',
    character: '穿戴装备、整理背包、查看属性',
    skills: '学习技能、推荐加点、切换自动施法',
    journey: '追寻套装、查看掉落与首通奖励',
    cube: '萃取传奇、装配三槽满值共鸣',
    gamble: '指定装备部位，使用碎片寻宝',
    forge: '槽位强化、词条洗练、分解与宝石',
    pets: '契约伙伴、切换出战、领取守望功绩',
    leaderboard: '查看五职业独立的在线与本机战绩',
    settings: '调整音量、画面方向与存档备份',
    lab: '免费体验十五套成型流派与操作循环',
  };
  return (
    <div className="services-overview">
      <CampWallet />
      {SYSTEM_GROUPS.map((group) => (
        <section className="service-district" key={group.label}>
          <h3>{group.label}</h3>
          <div className="services-grid">
            {group.panels
              .filter((id) => id !== 'services')
              .map((id) => {
                const [title, Icon] = TITLES[id];
                return (
                  <button
                    className="service-card"
                    key={id}
                    onClick={() => onNavigate?.(id)}
                    disabled={!onNavigate}
                  >
                    <Icon size={27} />
                    <strong>{SYSTEM_LINKS[id] ?? title}</strong>
                    <span>{descriptions[id]}</span>
                    <ChevronRight size={16} />
                  </button>
                );
              })}
          </div>
        </section>
      ))}
      <section className="service-district">
        <h3>训练与组队</h3>
        <div className="services-grid">
          <button className="service-card" onClick={() => onNavigate?.('guide')}>
            <BookOpen size={27} />
            <strong>冒险指南</strong>
            <ChevronRight size={16} />
          </button>
          <button className="service-card" onClick={() => onNavigate?.('training')}>
            <Sword size={27} />
            <strong>训练场</strong>
            <ChevronRight size={16} />
          </button>
          <button className="service-card" onClick={() => onNavigate?.('coop')}>
            <Compass size={27} />
            <strong>好友组队</strong>
            <ChevronRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}

function PetsPanel({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate?: (panel: string) => void;
}) {
  const store = useGameStore();
  const { save } = store;
  const goals = [
    {
      name: '雾中的第一道光',
      description: '累计击败 100 个敌人',
      value: save.kills,
      target: 100,
      reward: '500 金币',
    },
    {
      name: '归来的远征者',
      description: '完成 5 次秘境',
      value: save.clears,
      target: 5,
      reward: '250 神秘碎片',
    },
    {
      name: '跨越黑暗',
      description: '解锁第 15 层秘境',
      value: save.highestStage,
      target: 15,
      reward: '50 奥术结晶',
    },
  ];
  return (
    <>
      <div className="relic-grid pet-grid">
        {PETS.map((p) => {
          const lv = save.petLevels[p.id] ?? 0;
          return (
            <article
              className={`pet-card ${save.petId === p.id ? 'active' : ''}`}
              key={p.id}
              style={{ '--pet': p.color } as CSSProperties}
            >
              <div className="pet-portrait">
                <PetIcon petId={p.id} size={112} />
              </div>
              <span className="eyebrow">
                {save.petId === p.id
                  ? 'ACTIVE COMPANION'
                  : lv
                    ? 'BOUND COMPANION'
                    : 'UNBOUND SPIRIT'}
              </span>
              <h3>
                {p.name} <small>{lv ? `Lv.${lv}` : '未契约'}</small>
              </h3>
              <p>{p.description}</p>
              <p className="item-lore">{p.lore}</p>
              <div className="button-row">
                <button
                  className="gold-button"
                  data-sound="upgrade"
                  onClick={() => {
                    store.upgradePet(p.id);
                    if (!lv && (useGameStore.getState().save.petLevels[p.id] ?? 0) > 0)
                      store.selectPet(p.id);
                  }}
                  disabled={lv >= 20 || save.gold < 300 + lv * 250}
                >
                  {lv >= 20 ? '已满级' : `${lv ? '升级' : '契约并出战'} · ${300 + lv * 250} 金`}
                </button>
                {lv > 0 && (
                  <button
                    className="ghost-button"
                    disabled={save.petId === p.id}
                    onClick={() => store.selectPet(p.id)}
                  >
                    {save.petId === p.id ? (
                      <>
                        <Check size={15} /> 已出战
                      </>
                    ) : (
                      '出战'
                    )}
                  </button>
                )}
              </div>
              {lv < 20 && save.gold < 300 + lv * 250 && (
                <small className="negative">金币不足，还需 {300 + lv * 250 - save.gold} 金</small>
              )}
            </article>
          );
        })}
      </div>
      <div className="section-heading">
        <h3>守望功绩</h3>
        <span>本地旅程</span>
      </div>
      <div className="season-goals">
        {goals.map((g) => (
          <article className="card" key={g.name}>
            <div className="section-heading">
              <h4>{g.name}</h4>
              {g.value >= g.target ? (
                <Check size={18} />
              ) : (
                <span>
                  {Math.min(g.value, g.target)} / {g.target}
                </span>
              )}
            </div>
            <p>{g.description}</p>
            <div className="mini-progress">
              <i style={{ width: `${Math.min(100, (g.value / g.target) * 100)}%` }} />
            </div>
            <small className="muted">
              {g.value >= g.target ? '奖励已自动发放' : '完成自动领取'} · {g.reward}
            </small>
          </article>
        ))}
      </div>
      <p className="muted system-hint">
        个人战绩：累计肃清 {save.clears} 层 · 击败 {save.kills} 个敌人 · 最佳通关{' '}
        {save.bestTime ? `${Math.round(save.bestTime)} 秒` : '尚无记录'}
        。完整配装记录保留在当前账号，在线榜读取已同步战绩。
      </p>
      <LeaderboardPanel onClose={onClose} onNavigate={onNavigate} />
    </>
  );
}

function LabPanel({ onClose }: { onClose: () => void }) {
  const store = useGameStore();
  const [classFilter, setClassFilter] = useState<string>(store.save.classId);
  return (
    <>
      <div className="lab-intro">
        <FlaskConical size={32} />
        <div>
          <h3>十五种命运，一步成型。</h3>
          <p>
            完整四件套、太古传奇、三槽共鸣与满级技能。演武独立于你的开荒进度，战利品不会带回存档。
          </p>
        </div>
        {store.labBackup && (
          <button
            className="gold-button"
            onClick={() => {
              store.leaveLab();
              onClose();
            }}
          >
            返回开荒
          </button>
        )}
      </div>
      <div className="panel-tabs" aria-label="按职业查看流派">
        <button
          className={classFilter === 'all' ? 'active' : ''}
          aria-pressed={classFilter === 'all'}
          onClick={() => setClassFilter('all')}
        >
          全部 15 套
        </button>
        {CLASSES.map((hero) => (
          <button
            key={hero.id}
            className={classFilter === hero.id ? 'active' : ''}
            aria-pressed={classFilter === hero.id}
            onClick={() => setClassFilter(hero.id)}
          >
            {hero.name} · 3 套
          </button>
        ))}
      </div>
      {CLASSES.filter((hero) => classFilter === 'all' || hero.id === classFilter).map((c) => (
        <section className="lab-class" key={c.id}>
          <div className="section-heading">
            <h3 style={{ color: c.color }}>{c.name}</h3>
            <span>{c.title}</span>
          </div>
          <div className="build-grid">
            {SETS.filter((t) => t.classId === c.id).map((t) => (
              <article
                className="build-card"
                style={{ '--build': t.color } as CSSProperties}
                key={t.id}
              >
                <span className="eyebrow">{SKILLS.find((n) => n.id === t.skillId)?.name}</span>
                <h3>{t.name}</h3>
                <p className="build-lore">{t.lore}</p>
                <p>
                  <b>2 件</b> {t.two}
                </p>
                <p>
                  <b>4 件</b> {t.four}
                </p>
                {BUILD_GUIDES[t.id] && (
                  <dl className="build-guide">
                    <dt>{BUILD_GUIDES[t.id].style} · 推荐站位</dt>
                    <dd>{BUILD_GUIDES[t.id].range}</dd>
                    <dt>操作循环</dt>
                    <dd>{BUILD_GUIDES[t.id].rotation}</dd>
                    <dt>流畅游玩提示</dt>
                    <dd>{BUILD_GUIDES[t.id].tip}</dd>
                  </dl>
                )}
                <button
                  className="gold-button wide"
                  disabled={store.cloudTransition || store.inCombat}
                  onClick={() => {
                    store.activateBuild(t.id);
                    onClose();
                  }}
                >
                  唤醒流派 <ChevronRight size={15} />
                </button>
              </article>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function SettingsPanel() {
  const store = useGameStore();
  const [reset, setReset] = useState(false);
  const [pendingImport, setPendingImport] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const locked = !!store.labBackup || store.inCombat || store.cloudTransition;
  const file = useRef<HTMLInputElement>(null);
  return (
    <div className="settings-panel">
      <section className="card">
        <div className="section-heading">
          <h3>
            <Volume2 size={18} />
            声音与画面
          </h3>
        </div>
        <label className="setting-row">
          <span>主音量</span>
          <input
            aria-label="主音量"
            type="range"
            min="0"
            max="1"
            step=".05"
            value={store.save.volume}
            onChange={(e) => store.updateSettings({ volume: Number(e.target.value) })}
          />
          <b>{Math.round(store.save.volume * 100)}%</b>
        </label>
        <label className="setting-row">
          <span>静音</span>
          <input
            type="checkbox"
            checked={store.save.muted}
            onChange={(e) => store.updateSettings({ muted: e.target.checked })}
          />
        </label>
        <label className="setting-row">
          <span>自动分解史诗及以下掉落</span>
          <input
            type="checkbox"
            checked={store.save.autoSalvage}
            onChange={(e) => store.updateSettings({ autoSalvage: e.target.checked })}
          />
        </label>
        <RareAffixFilter />
      </section>
      <PlayerSettings />
      <section className="card">
        <h3>反馈与建议</h3>
        <FeedbackForm />
      </section>
      <section className="card">
        <h3>旅程档案</h3>
        <p className="muted">
          每 3 秒保存全部本地账号、角色与共享仓库。离线收益最多累计 8 小时。
          导入账号档会替换本机账号档案；旧版单角色档迁入当前角色。建议先导出备份。
        </p>
        <div className="button-row">
          <button className="gold-button" onClick={store.exportSave}>
            <Download size={16} />
            导出存档
          </button>
          <button
            className="ghost-button"
            disabled={locked || !!store.cloudUserId || importing}
            onClick={() => file.current?.click()}
          >
            <Upload size={16} />
            导入 JSON
          </button>
          {store.corruptBackup && (
            <button className="ghost-button" onClick={store.exportCorruptBackup}>
              <Download size={16} />
              导出原始恢复备份
            </button>
          )}
        </div>
        {(locked || store.cloudUserId) && (
          <p className="muted">
            {store.cloudUserId
              ? '导入存档需先退出云账号，回到访客档。'
              : '请先返回开荒营地后导入存档。'}
          </p>
        )}
        {pendingImport && (
          <div className="operation-review">
            <p>
              已选择「{pendingImport.name}
              」。导入账号档将替换本机全部账号与角色，旧版单角色档替换当前角色。请先导出当前存档。
            </p>
            <div className="button-row">
              <button
                className="gold-button"
                disabled={locked || !!store.cloudUserId || importing}
                onClick={async () => {
                  setImporting(true);
                  try {
                    store.importSave(await pendingImport.text());
                    setPendingImport(null);
                  } catch {
                    store.setNotice('无法读取存档文件，请重新选择。');
                  } finally {
                    setImporting(false);
                  }
                }}
              >
                {importing ? '正在读取…' : '确认导入并替换进度'}
              </button>
              <button
                className="ghost-button"
                disabled={importing}
                onClick={() => setPendingImport(null)}
              >
                取消导入
              </button>
            </div>
          </div>
        )}
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 20 * 1024 * 1024) store.setNotice('存档文件不能超过 20 MB。');
              else setPendingImport(f);
            }
            e.target.value = '';
          }}
        />
      </section>
      <section className="card">
        <h3>操控指南</h3>
        <p>
          移动、施法与位移按键可在上方自定义，方向键移动始终可用；也可拖动战场、使用虚拟摇杆或点击技能栏。
          Esc 暂停。每个技能可独立切换自动施放与手动施放。
        </p>
        <p className="muted">
          秘境限时 5 分钟，收集进度球召唤守关魔王。低于 100 秒通关最高层可跳升 3 层。
        </p>
      </section>
      <section className="card danger-zone">
        <h3>重新启程</h3>
        {reset ? (
          <>
            <p>将重置当前角色的成长与背包。账号共享仓库及其他角色保留，建议先导出备份。</p>
            <div className="button-row">
              <button className="ghost-button" onClick={() => setReset(false)}>
                保留进度
              </button>
              <button
                className="danger-button"
                disabled={locked}
                onClick={() => {
                  store.resetProgress();
                  setReset(false);
                }}
              >
                确认重置当前角色
              </button>
            </div>
          </>
        ) : (
          <button className="ghost-button" disabled={locked} onClick={() => setReset(true)}>
            {locked ? '返回开荒营地后可重置' : '开始新的开荒旅程'}
          </button>
        )}
      </section>
    </div>
  );
}

export function SystemsModal({
  panel,
  onClose,
  onNavigate,
  onEnterHall,
  onReadChapter,
  inspectItem,
}: {
  panel: string | null;
  onClose: () => void;
  onNavigate?: (panel: string) => void;
  onEnterHall?: () => void;
  onReadChapter?: (chapter: CampaignChapter) => void;
  inspectItem?: string;
}) {
  const title = panel ? TITLES[panel] : undefined;
  const trigger = useRef<HTMLButtonElement>(null);
  const [selection, setSelection] = useState({ panel, inspectItem, id: inspectItem ?? '' });
  const selected =
    selection.panel === panel && selection.inspectItem === inspectItem
      ? selection.id
      : (inspectItem ?? '');
  useEffect(() => {
    setSelection({ panel, inspectItem, id: inspectItem ?? '' });
    trigger.current = null;
  }, [panel, inspectItem]);
  const selectItem = (id: string, button?: HTMLButtonElement) => {
    trigger.current = button ?? null;
    setSelection({ panel, inspectItem, id });
  };
  const closeItem = () => {
    const opener = trigger.current;
    selectItem('');
    requestAnimationFrame(() => {
      const replacement = ref.current?.querySelector<HTMLElement>(
        `[data-item-id="${CSS.escape(selected)}"]`,
      );
      if (opener?.isConnected && opener.offsetParent) opener.focus();
      else if (replacement?.offsetParent) replacement.focus();
      else ref.current?.focus({ preventScroll: true });
    });
  };
  const canCloseItem = useGameStore((state) => {
    if (!selected) return false;
    if (panel === 'skills')
      return SKILLS.some((skill) => skill.id === selected && skill.classId === state.save.classId);
    if (panel === 'character')
      return (
        state.save.inventory.some((item) => item.id === selected) ||
        Object.values(state.save.equipment).some((item) => item?.id === selected)
      );
    if (panel === 'stash')
      return (
        state.save.inventory.some((item) => item.id === selected) ||
        !!state.accounts
          .find((entry) => entry.id === state.activeAccountId)
          ?.stash.some((item) => item.id === selected)
      );
    return false;
  });
  const ref = useDialog(!!panel && !!title, () => (canCloseItem ? closeItem() : onClose()));
  const notice = useGameStore((state) => state.notice);
  if (!panel || !title) return null;
  const [heading, Icon] = title;
  const group = SYSTEM_GROUPS.find((entry) => entry.panels.includes(panel)) ?? SYSTEM_GROUPS[0];
  return (
    <div
      className="modal-backdrop system-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal systems-modal system-screen panel-${panel}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="system-modal-title"
        tabIndex={-1}
      >
        <header className="modal-header">
          {onNavigate && (
            <button
              className="camp-back"
              onClick={canCloseItem ? closeItem : onClose}
              aria-label={canCloseItem ? '返回列表' : '返回营地'}
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <span className="modal-heading-icon">
            <Icon size={25} />
          </span>
          <div>
            <h2 id="system-modal-title">{heading}</h2>
          </div>
          {onNavigate && (
            <label className="compact-system-switcher">
              <span className="sr-only">营地手册</span>
              <select
                aria-label="切换营地系统"
                value={panel}
                onChange={(event) => onNavigate(event.target.value)}
              >
                {SYSTEM_GROUPS.map((entry) => (
                  <optgroup key={entry.label} label={entry.label}>
                    {entry.panels.map((id) => (
                      <option key={id} value={id}>
                        {SYSTEM_LINKS[id]}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}
          <button className="modal-close ghost-button" aria-label="关闭面板" onClick={onClose}>
            <X size={21} />
          </button>
        </header>
        {onNavigate && (
          <>
            <nav className="system-groups" aria-label="营地系统分类">
              {SYSTEM_GROUPS.map((entry) => {
                const GroupIcon = entry.icon;
                const selected = entry === group;
                return (
                  <button
                    key={entry.label}
                    aria-current={selected ? 'true' : undefined}
                    onClick={() => onNavigate(selected ? panel : entry.panels[0])}
                  >
                    <GroupIcon size={19} />
                    <span>{entry.label}</span>
                  </button>
                );
              })}
            </nav>
            <nav
              className="system-navigation"
              aria-label={`${group.label}系统快捷切换`}
              style={{ gridTemplateColumns: `repeat(${group.panels.length}, minmax(0, 140px))` }}
            >
              {group.panels.map((id) => (
                <button
                  key={id}
                  aria-current={panel === id ? 'page' : undefined}
                  onClick={() => onNavigate(id)}
                >
                  {SYSTEM_LINKS[id]}
                </button>
              ))}
            </nav>
          </>
        )}
        {notice && (
          <div className="system-feedback" role="status" aria-live="polite">
            {notice}
          </div>
        )}
        <div className="modal-body" key={panel}>
          <div className="system-content">
            {panel === 'services' ? (
              <ServicesPanel onNavigate={onNavigate} />
            ) : panel === 'accounts' ? (
              <AccountPanel onEnterHall={onEnterHall} />
            ) : panel === 'stash' ? (
              <StashPanel selected={selected} selectItem={selectItem} closeItem={closeItem} />
            ) : panel === 'character' ? (
              <CharacterPanel selected={selected} selectItem={selectItem} closeItem={closeItem} />
            ) : panel === 'journey' ? (
              <JourneyPanel onNavigate={onNavigate} onReadChapter={onReadChapter} />
            ) : panel === 'skills' ? (
              <SkillsPanel selected={selected} selectItem={selectItem} closeItem={closeItem} />
            ) : panel === 'cube' ? (
              <CubePanel />
            ) : panel === 'gamble' ? (
              <GamblePanel />
            ) : panel === 'forge' ? (
              <ForgePanel />
            ) : panel === 'pets' ? (
              <PetsPanel onClose={onClose} onNavigate={onNavigate} />
            ) : panel === 'leaderboard' ? (
              <LeaderboardPanel onClose={onClose} onNavigate={onNavigate} />
            ) : panel === 'lab' ? (
              <LabPanel onClose={onClose} />
            ) : (
              <SettingsPanel />
            )}
          </div>
        </div>
        <footer className="modal-footer">
          <span>
            {canCloseItem
              ? `Esc 关闭${panel === 'skills' ? '技能说明' : '装备详情'}`
              : 'Esc 返回营地'}
          </span>
          <button className="ghost-button" onClick={onClose}>
            返回大厅 <ChevronRight size={14} />
          </button>
        </footer>
      </div>
    </div>
  );
}
