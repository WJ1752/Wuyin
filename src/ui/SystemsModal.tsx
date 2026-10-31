import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, ReactNode } from 'react';
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
  ArrowDown,
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
} from 'lucide-react';
import type { Item, Slot, Stats } from '../core/types';
import { RARITY_COLORS, RARITY_NAMES, SLOTS, SLOT_NAMES } from '../core/types';
import { CLASSES } from '../data/classes';
import { SKILLS } from '../data/skillTrees';
import { SETS } from '../data/sets';
import { LEGENDARIES } from '../data/legendaries';
import { AFFIXES, GEMS, PETS } from '../data/affixes';
import { computeStats, cubeSlot, skillPoints, useGameStore } from '../state/gameStore';
import { formatBigNumber } from '../core/format';
import './systems.css';
import { audio } from '../audio/SynthAudio';
import { CharacterPreview } from './CharacterPreview';

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
const TITLES: Record<string, [string, string, typeof Sword]> = {
  character: ['行者档案', 'CHARACTER & INVENTORY', Sword],
  skills: ['命运之树', 'THE PATH OF POWER', BookOpen],
  cube: ['魔盒共鸣', 'THE ARCHIVE OF RELICS', WandSparkles],
  gamble: ['米娅的秘藏', 'FORTUNE FAVORS THE BOLD', Dices],
  forge: ['余烬铁砧', 'THE EMBER FORGE', Hammer],
  pets: ['守望契约', 'COMPANIONS & SEASON', PawPrint],
  settings: ['远征设置', 'SETTINGS & CHRONICLE', Settings],
  lab: ['秘境演武场', 'THE BUILD LABORATORY', FlaskConical],
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
function ItemTile({
  item,
  onClick,
  selected = false,
}: {
  item: Item;
  onClick?: () => void;
  selected?: boolean;
}) {
  const equipped = useGameStore((s) => s.save.equipment[item.slot]);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [position, setPosition] = useState({ left: 16, top: 16 });
  const button = useRef<HTMLButtonElement>(null);
  const tooltipId = useId();
  const show = hovered || focused;
  const compare =
    equipped && JSON.stringify(equipped) !== JSON.stringify(item) ? equipped : undefined;
  const placeTooltip = () => {
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(compare ? 650 : 330, window.innerWidth - 32);
    setPosition({
      left: Math.max(16, Math.min(window.innerWidth - width - 16, rect.right + 12)),
      top: Math.max(16, Math.min(rect.top, window.innerHeight - 490)),
    });
  };
  return (
    <>
      <button
        ref={button}
        className={`item-card rarity-${item.rarity} ${selected ? 'selected' : ''}`}
        style={{ '--rarity': RARITY_COLORS[item.rarity] } as CSSProperties}
        onClick={onClick}
        aria-describedby={show ? tooltipId : undefined}
        onMouseEnter={() => {
          placeTooltip();
          setHovered(true);
        }}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => {
          placeTooltip();
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
      >
        <span className="item-tile-art">
          <EquipmentIcon slot={item.slot} size={32} />
          {item.gem && <i style={{ color: GEMS.find((g) => g.id === item.gem!.id)?.color }}>◆</i>}
        </span>
        <span className="item-tile-name">{item.name}</span>
        <span className="item-tile-meta">
          {RARITY_NAMES[item.rarity]} · Lv.{item.level}
        </span>
      </button>
      {show &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            className={`systems-modal item-comparison-tooltip ${compare ? 'has-comparison' : ''}`}
            style={position}
          >
            <section>
              <span className="eyebrow">{equipped?.id === item.id ? '当前穿戴' : '选中装备'}</span>
              <ItemDetails item={item} compare={compare} />
            </section>
            {compare && (
              <section>
                <span className="eyebrow">当前穿戴 · 同部位</span>
                <ItemDetails item={compare} />
              </section>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
function ItemDetails({
  item,
  compare,
  children,
}: {
  item: Item;
  compare?: Item;
  children?: ReactNode;
}) {
  const l = LEGENDARIES.find((l) => l.id === item.legendaryId);
  const set = SETS.find((t) => t.id === item.setId);
  return (
    <article
      className={`item-detail rarity-${item.rarity}`}
      style={{ '--rarity': RARITY_COLORS[item.rarity] } as CSSProperties}
    >
      <span className="eyebrow">
        {RARITY_NAMES[item.rarity]} / {SLOT_NAMES[item.slot]}
      </span>
      <h3>{item.name}</h3>
      <div className="item-base-stats">
        {item.attack > 0 && (
          <strong>
            {item.attack} <small>攻击</small>
            {compare && (
              <span className={item.attack >= compare.attack ? 'positive' : 'negative'}>
                {item.attack >= compare.attack ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{' '}
                {Math.abs(item.attack - compare.attack)}
              </span>
            )}
          </strong>
        )}
        {item.armor > 0 && (
          <strong>
            {item.armor} <small>护甲</small>
            {compare && (
              <span className={item.armor >= compare.armor ? 'positive' : 'negative'}>
                {item.armor >= compare.armor ? <ArrowUp size={12} /> : <ArrowDown size={12} />}{' '}
                {Math.abs(item.armor - compare.armor)}
              </span>
            )}
          </strong>
        )}
      </div>
      <ul className="affix-list">
        {item.affixes.map((a) => {
          const difference = a.value - (compare?.affixes.find((v) => v.id === a.id)?.value ?? 0);
          const unit = AFFIXES.find((v) => v.id === a.id)?.unit;
          return (
            <li key={a.id}>
              {affixLabel(a.id, a.value)}
              {compare && (
                <small className={difference >= 0 ? 'positive' : 'negative'}>
                  {' '}
                  {difference >= 0 ? '↑' : '↓'}{' '}
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
          <p className="set-power">[2] {set.two}</p>
          <p className="set-power">[4] {set.four}</p>
          <p className="item-lore">“{set.lore}”</p>
        </>
      )}
      {children}
    </article>
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
function CharacterPanel() {
  const store = useGameStore();
  const { save } = store;
  const [selected, setSelected] = useState<string>('');
  const [filter, setFilter] = useState('all');
  const [showStats, setShowStats] = useState(false);
  const item = [...save.inventory, ...Object.values(save.equipment)].find(
    (i) => i?.id === selected,
  );
  const equipped = item && save.equipment[item.slot]?.id === item.id;
  const hero = CLASSES.find((c) => c.id === save.classId)!;
  const stats = computeStats(save);
  return (
    <div className="system-columns">
      <section>
        <div className="character-dossier" style={{ '--class-color': hero.color } as CSSProperties}>
          <div className="dossier-top">
            <span className="eyebrow">THE WANDERER</span>
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
                onClick={() => setSelected(save.equipment[slot]?.id ?? '')}
                title={SLOT_NAMES[slot]}
              >
                <EquipmentIcon slot={slot} />
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
        <button className="ghost-button wide" onClick={() => setShowStats(!showStats)}>
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
        {item && (
          <ItemDetails item={item} compare={equipped ? undefined : save.equipment[item.slot]}>
            <div className="button-row">
              <button
                className="gold-button"
                data-sound="equip"
                onClick={() => (equipped ? store.unequip(item.slot) : store.equip(item.id))}
              >
                {equipped ? '卸下装备' : '穿戴装备'}
              </button>
              {!equipped && (
                <button
                  className="ghost-button"
                  onClick={() => {
                    store.salvage(item.id);
                    setSelected('');
                  }}
                >
                  分解
                </button>
              )}
            </div>
          </ItemDetails>
        )}
      </section>
      <section>
        <div className="section-heading">
          <h3>行囊</h3>
          <span>{save.inventory.length} / 240</span>
        </div>
        <div className="panel-tabs compact">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            全部
          </button>
          <button
            className={filter === 'legendary' ? 'active' : ''}
            onClick={() => setFilter('legendary')}
          >
            传奇
          </button>
          <button className={filter === 'set' ? 'active' : ''} onClick={() => setFilter('set')}>
            套装
          </button>
          <button
            className={filter === 'primal' ? 'active' : ''}
            onClick={() => setFilter('primal')}
          >
            太古
          </button>
        </div>
        <div className="item-grid">
          {save.inventory
            .filter((i) => filter === 'all' || (filter === 'set' ? !!i.setId : i.rarity === filter))
            .map((i) => (
              <ItemTile
                key={i.id}
                item={i}
                selected={i.id === selected}
                onClick={() => setSelected(i.id)}
              />
            ))}
        </div>
        {save.inventory.length === 0 && <Empty>行囊空空。秘境深处，遗物正等待重见天日。</Empty>}
        <p className="muted system-hint">
          选择装备查看数值与已穿戴装备的对比。背包上限 240，溢出掉落将转为锻造材料。
        </p>
      </section>
    </div>
  );
}

function SkillsPanel() {
  const store = useGameStore();
  const { save } = store;
  const [selected, setSelected] = useState('');
  const nodes = SKILLS.filter((n) => n.classId === save.classId);
  const node = nodes.find((n) => n.id === selected);
  return (
    <>
      <div className="system-toolbar">
        <span className="skill-points">
          <Sparkles size={17} />
          可用技能点 <b>{skillPoints(save)}</b>
        </span>
        <button className="ghost-button" onClick={store.resetSkills}>
          <RotateCcw size={14} />
          免费洗点
        </button>
      </div>
      <div className="panel-tabs">
        {SETS.filter((t) => t.classId === save.classId).map((t) => (
          <button key={t.id} onClick={() => store.recommendSkills(t.id)}>
            {t.name} · 推荐加点
          </button>
        ))}
      </div>
      <div className="skill-tree">
        <p className="muted system-hint">
          技能说明以 1 级为基准。每提升 1 级，主动伤害与护盾强度、被动数值收益提高 10%，最高 5
          级（+40%）；穿透、分裂等结构性效果保持，衍生伤害随节点等级提高。
        </p>
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
                    className={`skill-node ${save.skills[n.id] ? 'unlocked' : ''} ${selected === n.id ? 'selected' : ''}`}
                    onClick={() => setSelected(n.id)}
                  >
                    <span className="skill-symbol">
                      {n.kind === 'passive' ? (
                        <Sparkles size={22} />
                      ) : n.kind === 'defense' ? (
                        <Shield size={22} />
                      ) : n.kind === 'movement' ? (
                        <Footprints size={22} />
                      ) : (
                        <Sword size={22} />
                      )}
                    </span>
                    <strong>{n.name}</strong>
                    <small>
                      {n.kind === 'passive' ? '被动' : '主动'} · {save.skills[n.id] ?? 0} / 5
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
      {node && (
        <div className="card skill-description">
          <div>
            <span className="eyebrow">
              {node.element.toUpperCase()} / TIER {node.tier}
            </span>
            <h3>{node.name}</h3>
            <p>{node.description}</p>
            <small className="muted">
              伤害倍率 ×{node.multiplier} · 消耗 {node.cost} · 冷却 {node.cooldown}s
              {node.parent ? ` · 前置：${SKILLS.find((n) => n.id === node.parent)?.name}` : ''}
            </small>
          </div>
          <button
            className="gold-button"
            data-sound="upgrade"
            onClick={() => store.allocateSkill(node.id)}
            disabled={(save.skills[node.id] ?? 0) >= 5 || skillPoints(save) === 0}
          >
            提升节点 <ArrowUp size={15} />
          </button>
        </div>
      )}
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
      <div className="cube-slots">
        {(['weapon', 'armor', 'jewelry'] as const).map((slot) => {
          const def = LEGENDARIES.find((l) => l.id === save.cube[slot]);
          const duplicate =
            def && Object.values(save.equipment).some((i) => i?.legendaryId === def.id);
          return (
            <div className={`cube-slot ${def ? 'filled' : ''}`} key={slot}>
              <span className="cube-orbit">
                <EquipmentIcon slot={slot === 'armor' ? 'chest' : slot} size={32} />
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
                <EquipmentIcon slot={l.slot} />
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
                disabled={!save.extracted.includes(l.id)}
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
                <button
                  className="gold-button wide"
                  disabled={save.extracted.includes(i.legendaryId!)}
                  data-sound="arcane"
                  onClick={() => store.extract(i.id)}
                >
                  {save.extracted.includes(i.legendaryId!) ? '已收录' : '萃取传奇 · 15 结晶 + 1 魂'}
                </button>
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
  const [slot, setSlot] = useState<Slot>('weapon');
  const [selected, setSelected] = useState<Item>();
  return (
    <>
      <div className="mia-quote">
        <span className="mia-sigil">✧</span>
        <div>
          <span className="eyebrow">MIA · THE KEEPER OF CHANCE</span>
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
      <div className="gamble-actions">
        <span>
          持有 <b>{costLabel(store.save.shards)}</b> 神秘碎片
        </span>
        <button
          className="ghost-button"
          data-sound="gamble"
          onClick={() => store.gamble(slot, 1)}
          disabled={store.save.shards < 50}
        >
          揭开一张 · 50
        </button>
        <button
          className="gold-button"
          data-sound="gamble"
          onClick={() => store.gamble(slot, 10)}
          disabled={store.save.shards < 500}
        >
          <Dices size={16} />
          十连秘藏 · 500
        </button>
      </div>
      <p className="muted system-hint">
        传奇与套装判定合计 67%；传奇 / 套装再判定太古，概率随层级提高，最高 15%。装备留在行囊中。
      </p>
      {store.lastGamble.length > 0 ? (
        <div className="gamble-results item-grid" key={store.lastGamble[0].id}>
          {store.lastGamble.map((item, index) => (
            <div key={item.id} style={{ animationDelay: `${index * 0.09}s` }}>
              <ItemTile item={item} onClick={() => setSelected(item)} />
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
      {selected && <ItemDetails item={selected} compare={store.save.equipment[selected.slot]} />}
    </>
  );
}

function ForgePanel() {
  const store = useGameStore();
  const { save } = store;
  const [tab, setTab] = useState('forge');
  const [slot, setSlot] = useState<Slot>('weapon');
  const [id, setId] = useState('');
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
                  disabled={save.forge[s] >= 50}
                >
                  神铸
                  <small>
                    {100 + save.forge[s] * 80} 金 / {5 + save.forge[s] * 2} 结晶
                  </small>
                </button>
              </article>
            ))}
          </div>
        </>
      )}
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
              onChange={(e) => setId(e.target.value)}
            >
              <option value="">选择一件装备</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
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
                      disabled={item.reforged !== undefined && item.reforged !== index}
                      data-sound="forge"
                      onClick={() => store.reforge(item.id, index)}
                    >
                      <RotateCcw size={14} />
                      重铸
                    </button>
                  </div>
                ))}
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
            <button className="gold-button" onClick={store.salvageLow}>
              一键分解史诗及以下
            </button>
          </div>
          <div className="relic-grid">
            {save.inventory.map((i) => (
              <div key={i.id} className="salvage-card">
                <ItemTile item={i} />
                <button className="ghost-button wide" onClick={() => store.salvage(i.id)}>
                  分解 ·{' '}
                  {['legendary', 'set', 'primal'].includes(i.rarity) ? '12 结晶 / 2 魂' : '4 结晶'}
                </button>
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

function PetsPanel({ onClose }: { onClose: () => void }) {
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
                <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
                  <path
                    d={
                      p.id === 'dragon'
                        ? 'M20 52 6 23 30 34 42 12 53 34 78 23 63 54 42 70Z'
                        : p.id === 'owl'
                          ? 'M13 20 31 27 42 18 52 27 70 20 62 60 42 73 22 60Z'
                          : p.id === 'fox'
                            ? 'M16 9 38 29 49 29 70 9 63 55 42 72 21 55Z'
                            : 'M14 17 31 27 42 15 54 27 71 17 62 57 42 72 22 57Z'
                    }
                    fill="currentColor"
                    opacity=".18"
                    stroke="currentColor"
                  />
                  <path
                    d="M25 40 35 44 25 47M59 40 49 44 59 47M37 56 42 59 47 56"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path d="M30 61 42 67 54 61" stroke="currentColor" fill="none" opacity=".5" />
                </svg>
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
                  onClick={() => store.upgradePet(p.id)}
                  disabled={lv >= 20}
                >
                  {lv ? '升级' : '契约'} · {300 + lv * 250} 金
                </button>
                {lv > 0 && (
                  <button
                    className="ghost-button"
                    disabled={save.petId === p.id}
                    onClick={() => store.selectPet(p.id)}
                  >
                    {save.petId === p.id ? <Check size={15} /> : '出战'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <div className="section-heading">
        <h3>第一赛季 · 守夜者誓约</h3>
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
        {save.bestTime ? `${Math.round(save.bestTime)} 秒` : '尚无记录'}。本作排行记录保存在本机。
      </p>
      <div className="section-heading">
        <h3>远征荣誉榜</h3>
        <span>本机前 20 次 · 按层数 / 用时排序</span>
      </div>
      <div className="run-leaderboard">
        {[...((store.labBackup ?? save).runRecords ?? [])]
          .sort((a, b) => b.stage - a.stage || a.seconds - b.seconds)
          .map((record, index) => {
            const hero = CLASSES.find((c) => c.id === record.build.classId)!;
            const sets = [
              ...new Set(
                Object.values(record.build.equipment)
                  .map((i) => i?.setId)
                  .filter(Boolean),
              ),
            ]
              .map((id) => SETS.find((s) => s.id === id)?.name)
              .filter(Boolean);
            return (
              <article className="run-record card" key={record.id}>
                <div className="run-record-heading">
                  <span className="run-rank">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>
                      第 {record.stage} 层{' '}
                      <small>
                        {record.seconds.toFixed(1)} 秒 · {hero.name} Lv.{record.build.level}
                      </small>
                    </h3>
                    <p className="muted">
                      {sets.join(' / ') || '自定义配装'} ·{' '}
                      {new Date(record.date).toLocaleString('zh-CN', {
                        timeZone: 'Asia/Hong_Kong',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </p>
                  </div>
                  <button
                    className="gold-button"
                    data-sound="equip"
                    onClick={() => {
                      store.activateRecord(record.id);
                      onClose();
                    }}
                  >
                    体验此配装 <ChevronRight size={14} />
                  </button>
                </div>
                <details>
                  <summary>查看当时装备与共鸣</summary>
                  <div className="item-grid">
                    {Object.values(record.build.equipment)
                      .filter((i): i is Item => !!i)
                      .map((item) => (
                        <ItemTile key={item.id} item={item} />
                      ))}
                  </div>
                  <p className="muted system-hint">
                    共鸣：
                    {Object.values(record.build.cube)
                      .map((id) => LEGENDARIES.find((l) => l.id === id)?.name)
                      .filter(Boolean)
                      .join(' · ') || '未装配'}{' '}
                    · 伙伴：{PETS.find((p) => p.id === record.build.petId)?.name}
                  </p>
                </details>
              </article>
            );
          })}
        {!(store.labBackup ?? save).runRecords?.length && (
          <Empty>完成一次正式秘境后，会在此保存当时的完整配装。演武和训练不会计入排行。</Empty>
        )}
      </div>
    </>
  );
}

function LabPanel({ onClose }: { onClose: () => void }) {
  const store = useGameStore();
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
      {CLASSES.map((c) => (
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
                <button
                  className="gold-button wide"
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
          <span>界面方向</span>
          <select
            className="system-select"
            value={store.save.orientation}
            onChange={(e) =>
              store.updateSettings({ orientation: e.target.value as 'portrait' | 'landscape' })
            }
          >
            <option value="portrait">竖屏 · 单手探索</option>
            <option value="landscape">横屏 · 键鼠作战</option>
          </select>
        </label>
        <label className="setting-row">
          <span>自动分解史诗及以下掉落</span>
          <input
            type="checkbox"
            checked={store.save.autoSalvage}
            onChange={(e) => store.updateSettings({ autoSalvage: e.target.checked })}
          />
        </label>
      </section>
      <section className="card">
        <h3>旅程档案</h3>
        <p className="muted">
          每 3 秒自动保存至本机。离线收益最多累计 8 小时。导入会替换当前开荒进度，建议先导出备份。
        </p>
        <div className="button-row">
          <button className="gold-button" onClick={store.exportSave}>
            <Download size={16} />
            导出存档
          </button>
          <button className="ghost-button" onClick={() => file.current?.click()}>
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
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 2000000) store.setNotice('存档文件不能超过 2 MB。');
              else store.importSave(await f.text());
            }
            e.target.value = '';
          }}
        />
      </section>
      <section className="card">
        <h3>操控指南</h3>
        <p>
          WASD /
          方向键移动；拖动战场或虚拟摇杆移动；空格释放位移；技能栏点击手动施放。每个技能可独立切换
          AUTO / MANUAL。
        </p>
        <p className="muted">
          秘境限时 5 分钟，收集进度球召唤守关魔王。低于 100 秒通关最高层可跳升 3 层。
        </p>
      </section>
      <section className="card danger-zone">
        <h3>重新启程</h3>
        {reset ? (
          <>
            <p>将清除当前本机进度。建议先导出备份。</p>
            <div className="button-row">
              <button className="ghost-button" onClick={() => setReset(false)}>
                保留进度
              </button>
              <button
                className="danger-button"
                onClick={() => {
                  store.resetProgress();
                  setReset(false);
                }}
              >
                确认重置本机存档
              </button>
            </div>
          </>
        ) : (
          <button className="ghost-button" onClick={() => setReset(true)}>
            开始新的开荒旅程
          </button>
        )}
      </section>
    </div>
  );
}

export function SystemsModal({ panel, onClose }: { panel: string | null; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const title = panel ? TITLES[panel] : undefined;
  useEffect(() => {
    if (!panel) return;
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key === 'Tab') {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not([hidden]),select,[tabindex="0"]',
          ) ?? [],
        ).filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [panel]);
  if (!panel || !title) return null;
  const Icon = title[2];
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        onClickCapture={(event) => {
          const button = (event.target as Element).closest('button');
          if (button && !button.disabled) audio.play(button.dataset.sound ?? 'click');
        }}
        className={`modal systems-modal panel-${panel}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="system-modal-title"
        tabIndex={-1}
      >
        <header className="modal-header">
          <span className="modal-heading-icon">
            <Icon size={25} />
          </span>
          <div>
            <span className="eyebrow">{title[1]}</span>
            <h2 id="system-modal-title">{title[0]}</h2>
          </div>
          <button className="modal-close ghost-button" aria-label="关闭面板" onClick={onClose}>
            <X size={21} />
          </button>
        </header>
        <div className="modal-body">
          {panel === 'character' ? (
            <CharacterPanel />
          ) : panel === 'skills' ? (
            <SkillsPanel />
          ) : panel === 'cube' ? (
            <CubePanel />
          ) : panel === 'gamble' ? (
            <GamblePanel />
          ) : panel === 'forge' ? (
            <ForgePanel />
          ) : panel === 'pets' ? (
            <PetsPanel onClose={onClose} />
          ) : panel === 'lab' ? (
            <LabPanel onClose={onClose} />
          ) : (
            <SettingsPanel />
          )}
        </div>
        <footer className="modal-footer">
          <span>雾隐营地 · 远征者的避风港</span>
          <button className="ghost-button" onClick={onClose}>
            返回营地 <ChevronRight size={14} />
          </button>
        </footer>
      </div>
    </div>
  );
}
