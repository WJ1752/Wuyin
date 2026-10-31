import { create } from 'zustand';
import type {
  ClassId,
  CombatConfig,
  Item,
  RunRecord,
  RunResult,
  SaveData,
  Slot,
  Stats,
} from '../core/types';
import { SLOTS, SLOT_NAMES } from '../core/types';
import { CLASSES } from '../data/classes';
import { SKILLS } from '../data/skillTrees';
import { SETS } from '../data/sets';
import { LEGENDARIES } from '../data/legendaries';
import { AFFIXES, GEMS, PETS } from '../data/affixes';
import { generateLoot } from '../engine/LootGenerator';

const SAVE_KEY = 'mist-continent-save-v1';
const RECOVERY_KEY = 'mist-continent-recovery-v1';
const MAX_INVENTORY = 240;
// Each loadout keeps exactly one armor slot free for its build-defining relic.
const BUILD_RELICS: Record<string, { worn: string[]; cube: string[] }> = {
  stormcaller: {
    worn: ['dawn', 'dead_mans', 'olda', 'elements'],
    cube: ['yang', 'aquila', 'squirt'],
  },
  marauder: {
    worn: ['yang', 'ninth_satchel', 'olda', 'berserker_charm'],
    cube: ['dawn', 'aquila', 'zodiac'],
  },
  frost_hunter: {
    worn: ['froststring', 'dead_mans', 'sacred_walkers', 'elements'],
    cube: ['windforce', 'aquila', 'squirt'],
  },
  wasteland: {
    worn: ['bulkathos', 'pride', 'olda', 'elements'],
    cube: ['lamentation', 'immortal_armor', 'squirt'],
  },
  earthbreaker: {
    worn: ['judgment', 'gavel', 'olda', 'elements'],
    cube: ['oathkeeper', 'aquila', 'zodiac'],
  },
  immortal_thorns: {
    worn: ['oathkeeper', 'shield_of_ancients', 'immortal_armor', 'berserker_charm'],
    cube: ['judgment', 'oraviel', 'squirt'],
  },
  tal_rasha: {
    worn: ['grand_vizier', 'endless_depths', 'aquila', 'elements'],
    cube: ['deathwish', 'olda', 'squirt'],
  },
  delsere: {
    worn: ['grand_vizier', 'winterglass', 'sacred_walkers', 'elements'],
    cube: ['endless_depths', 'aquila', 'zodiac'],
  },
  vyr: {
    worn: ['deathwish', 'etched_sigil', 'aquila', 'squirt'],
    cube: ['cosmic_strand', 'olda', 'elements'],
  },
  rathma: {
    worn: ['jesseth', 'bloodtide', 'olda', 'elements'],
    cube: ['reilena', 'aquila', 'squirt'],
  },
  trang_oul: {
    worn: ['corroded_fang', 'bloodtide', 'olda', 'elements'],
    cube: ['nayr', 'aquila', 'zodiac'],
  },
  inarius: {
    worn: ['reilena', 'bone_relic', 'immortal_armor', 'elements'],
    cube: ['jesseth', 'olda', 'squirt'],
  },
  shadow_blades: {
    worn: ['greenstone', 'earthward', 'sacred_walkers', 'elements'],
    cube: ['shadowfang', 'aquila', 'squirt'],
  },
  wild_vines: {
    worn: ['greenstone', 'venom_source', 'aquila', 'elements'],
    cube: ['plaguebranch', 'olda', 'squirt'],
  },
  storm_wolf: {
    worn: ['moonfang', 'stormheart', 'sacred_walkers', 'berserker_charm'],
    cube: ['shadowfang', 'aquila', 'elements'],
  },
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const starters = (id: ClassId) =>
  Object.fromEntries(
    SKILLS.filter((s) => s.classId === id && !s.parent && s.kind !== 'passive').map((s) => [
      s.id,
      1,
    ]),
  );
function preferBuildSkills(save: SaveData, skillId: string) {
  const focus = SKILLS.find((n) => n.id === skillId)!;
  const nodes = SKILLS.filter((n) => n.classId === save.classId);
  const basic = focus.kind === 'basic' ? focus.id : nodes.find((n) => n.kind === 'basic')?.id;
  const core = focus.kind === 'core' ? focus.id : nodes.find((n) => n.kind === 'core')?.id;
  for (const node of nodes)
    if (node.kind !== 'passive')
      save.autoSkills[node.id] =
        node.kind !== 'movement' &&
        (node.kind !== 'basic' || node.id === basic) &&
        (node.kind !== 'core' || (node.id === core && focus.kind !== 'basic'));
}
export function newSave(): SaveData {
  return {
    version: 1,
    classId: 'ranger',
    level: 1,
    xp: 0,
    gold: 1500,
    shards: 300,
    crystals: 80,
    souls: 10,
    highestStage: 1,
    selectedStage: 1,
    inventory: [],
    equipment: {},
    extracted: [],
    cube: {},
    forge: Object.fromEntries(SLOTS.map((s) => [s, 0])) as Record<Slot, number>,
    gems: Object.fromEntries(GEMS.map((g) => [g.id, [3, 0, 0, 0, 0, 0, 0, 0, 0, 0]])),
    skills: starters('ranger'),
    autoSkills: Object.fromEntries(SKILLS.map((s) => [s.id, s.kind !== 'movement'])),
    petId: PETS[0]?.id ?? 'goblin',
    petLevels: Object.fromEntries(PETS.map((p, i) => [p.id, i === 0 ? 1 : 0])),
    kills: 0,
    clears: 0,
    bestTime: 0,
    lastSaved: Date.now(),
    volume: 0.45,
    muted: false,
    autoSalvage: false,
    orientation: 'portrait',
    tutorialSeen: false,
  };
}
export function cubeSlot(slot: Slot): 'weapon' | 'armor' | 'jewelry' {
  return slot === 'weapon' || slot === 'offhand'
    ? 'weapon'
    : slot === 'jewelry'
      ? 'jewelry'
      : 'armor';
}
export function computeStats(save: SaveData): Stats {
  const hero = CLASSES.find((c) => c.id === save.classId)!;
  const stats: Stats = {
    hp: hero.hp + (save.level - 1) * 26,
    attack: hero.attack + (save.level - 1) * 3,
    armor: 40 + save.level * 5,
    mainStat: 20 + save.level * 3,
    critChance: 0.1,
    critDamage: 1.5,
    attackSpeed: 1,
    moveSpeed: 220,
    cooldown: 0,
    elementDamage: 0,
    eliteDamage: 0,
    regen: 2,
    resourceRegen: hero.regen,
    areaDamage: 0,
    damageReduction: 0,
    dodge: 0.03,
    pickupRadius: 85,
    lifeOnHit: 0,
    thorns: 0,
    penetration: 0,
    bonusDamage: 0,
    independent: [],
    maxResource: hero.maxResource,
    luck: 0,
  };
  let attackPercent = 0;
  for (const slot of SLOTS) {
    const item = save.equipment[slot];
    if (!item) continue;
    stats.attack += item.attack * (1 + save.forge[slot] * 0.04);
    stats.armor += item.armor * (1 + save.forge[slot] * 0.04);
    for (const affix of item.affixes) {
      if (affix.id === 'moveSpeed') stats.moveSpeed += 220 * affix.value;
      else if (affix.id === 'attackPercent') attackPercent += affix.value;
      else if (affix.id in stats && affix.id !== 'independent')
        (stats as unknown as Record<string, number>)[affix.id] += affix.value;
    }
    if (item.gem) {
      const gem = GEMS.find((g) => g.id === item.gem!.id);
      if (gem) {
        const value = gem.value * item.gem.level;
        if (gem.stat === 'attack' || gem.stat === 'attackPercent') attackPercent += value;
        else if (gem.stat in stats && gem.stat !== 'independent')
          (stats as unknown as Record<string, number>)[gem.stat] += value;
      }
    }
  }
  const pet = PETS.find((p) => p.id === save.petId);
  const petLevel = save.petLevels[save.petId] ?? 1;
  const petScale = 1 + (petLevel - 1) * 0.05;
  if (pet?.id === 'goblin') stats.luck += 0.25 * petScale;
  if (pet?.id === 'owl') {
    stats.cooldown += 0.15 * petScale;
    stats.resourceRegen += 3 * petScale;
  }
  if (pet?.id === 'imp') stats.critDamage += 0.4 * petScale;
  if (pet?.id === 'fox') {
    stats.moveSpeed += 22 * petScale;
    stats.dodge += 0.12 * petScale;
  }
  if (pet?.id === 'wisp') stats.regen += stats.hp * 0.015 * petScale;
  stats.attack *= 1 + attackPercent;
  // Preserve overflow: Oraviel converts the amount above 50% in combat.
  stats.critChance = Math.max(0, stats.critChance);
  stats.cooldown = Math.min(0.75, stats.cooldown);
  stats.dodge = Math.min(0.65, stats.dodge);
  stats.damageReduction = Math.min(0.75, stats.damageReduction);
  return stats;
}
export function createCombatConfig(save: SaveData): CombatConfig {
  return {
    classId: save.classId,
    level: save.level,
    stage: save.selectedStage,
    stats: computeStats(save),
    equipment: clone(save.equipment),
    skills: { ...save.skills },
    autoSkills: { ...save.autoSkills },
    cube: { ...save.cube },
    petId: save.petId,
    petLevel: save.petLevels[save.petId] ?? 1,
  };
}
export function skillPoints(save: SaveData) {
  const spent = SKILLS.filter((s) => s.classId === save.classId).reduce(
    (n, s) => n + (save.skills[s.id] ?? 0),
    0,
  );
  return Math.max(0, 8 + save.level * 3 - spent);
}
export function getActiveLegendaries(save: SaveData) {
  const powers = new Map<string, number>();
  Object.values(save.equipment).forEach((item) => {
    if (item?.legendaryId)
      powers.set(item.legendaryId, Math.max(powers.get(item.legendaryId) ?? 0, item.power));
  });
  Object.values(save.cube).forEach((id) => {
    const def = LEGENDARIES.find((l) => l.id === id);
    if (def) powers.set(def.id, def.max);
  });
  return [...powers].map(([id, power]) => ({ ...LEGENDARIES.find((l) => l.id === id)!, power }));
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const bounded = (v: unknown, min: number, max: number, integer = false): v is number =>
  typeof v === 'number' &&
  Number.isFinite(v) &&
  v >= min &&
  v <= max &&
  (!integer || Number.isInteger(v));
export function validateSave(input: unknown): SaveData {
  if (!isRecord(input) || input.version !== 1 || !CLASSES.some((c) => c.id === input.classId))
    throw new Error('存档版本或职业无效。');
  const s = input;
  for (const key of ['gold', 'shards', 'crystals', 'souls', 'xp', 'kills', 'clears'])
    if (!bounded(s[key], 0, 1e15, true)) throw new Error(`存档字段 ${key} 无效。`);
  if (
    !bounded(s.level, 1, 100, true) ||
    !bounded(s.highestStage, 1, 150, true) ||
    !bounded(s.selectedStage, 1, s.highestStage as number, true) ||
    !bounded(s.lastSaved, 0, Date.now() + 86400000) ||
    !bounded(s.bestTime, 0, 300)
  )
    throw new Error('存档进度无效。');
  const checkItem = (v: unknown): v is Item => {
    if (
      !isRecord(v) ||
      typeof v.id !== 'string' ||
      v.id.length > 100 ||
      typeof v.name !== 'string' ||
      v.name.length > 100 ||
      !SLOTS.includes(v.slot as Slot) ||
      !['common', 'uncommon', 'rare', 'epic', 'legendary', 'set', 'primal'].includes(
        String(v.rarity),
      )
    )
      return false;
    if (
      !bounded(v.level, 1, 150, true) ||
      !bounded(v.attack, 0, 1e8) ||
      !bounded(v.armor, 0, 1e8) ||
      !bounded(v.power, 0, 1e5)
    )
      return false;
    if (
      !Array.isArray(v.affixes) ||
      v.affixes.length > 4 ||
      !v.affixes.every(
        (a) =>
          isRecord(a) &&
          AFFIXES.some((d) => d.id === a.id && bounded(a.value, 0, Math.max(d.max * 1.3, d.min))),
      )
    )
      return false;
    if (
      v.legendaryId !== undefined &&
      !LEGENDARIES.some((l) => l.id === v.legendaryId && l.slot === v.slot)
    )
      return false;
    if (
      v.setId !== undefined &&
      (!SETS.some((t) => t.id === v.setId) ||
        !['head', 'chest', 'hands', 'legs', 'feet'].includes(String(v.slot)))
    )
      return false;
    if (
      v.gem !== undefined &&
      (!isRecord(v.gem) ||
        !GEMS.some((g) => g.id === (v.gem as Record<string, unknown>).id) ||
        !bounded(v.gem.level, 1, 10, true))
    )
      return false;
    if (v.reforged !== undefined && !bounded(v.reforged, 0, 3, true)) return false;
    return true;
  };
  if (
    !Array.isArray(s.inventory) ||
    s.inventory.length > MAX_INVENTORY ||
    !s.inventory.every(checkItem) ||
    !isRecord(s.equipment)
  )
    throw new Error('存档装备无效。');
  for (const [slot, item] of Object.entries(s.equipment)) {
    if (!SLOTS.includes(slot as Slot) || !checkItem(item) || item.slot !== slot)
      throw new Error('装备槽位无效。');
    const legendary = LEGENDARIES.find((l) => l.id === item.legendaryId);
    const setDef = SETS.find((t) => t.id === item.setId);
    if (
      (legendary?.classId && legendary.classId !== s.classId) ||
      (setDef && setDef.classId !== s.classId)
    )
      throw new Error('穿戴装备与当前职业不匹配。');
  }
  const ids = [...s.inventory, ...Object.values(s.equipment)].map((i) => (i as Item).id);
  if (new Set(ids).size !== ids.length) throw new Error('存档存在重复装备。');
  if (
    !Array.isArray(s.extracted) ||
    !s.extracted.every((id) => LEGENDARIES.some((l) => l.id === id)) ||
    !isRecord(s.cube)
  )
    throw new Error('魔盒图鉴无效。');
  for (const [slot, id] of Object.entries(s.cube))
    if (
      !s.extracted.includes(id) ||
      !LEGENDARIES.some(
        (l) => l.id === id && cubeSlot(l.slot) === slot && (!l.classId || l.classId === s.classId),
      )
    )
      throw new Error('魔盒共鸣无效。');
  if (
    !isRecord(s.forge) ||
    SLOTS.some((slot) => !bounded((s.forge as Record<string, unknown>)[slot], 0, 50, true))
  )
    throw new Error('神铸等级无效。');
  if (
    !isRecord(s.skills) ||
    Object.entries(s.skills).some(
      ([id, v]) => !SKILLS.some((n) => n.id === id) || !bounded(v, 0, 5, true),
    )
  )
    throw new Error('技能等级无效。');
  if (
    !isRecord(s.autoSkills) ||
    Object.entries(s.autoSkills).some(
      ([id, v]) => !SKILLS.some((n) => n.id === id) || typeof v !== 'boolean',
    )
  )
    throw new Error('自动施法配置无效。');
  if (
    !isRecord(s.gems) ||
    GEMS.some(
      (g) =>
        !Array.isArray((s.gems as Record<string, unknown>)[g.id]) ||
        (s.gems as Record<string, unknown[]>)[g.id].length !== 10 ||
        !(s.gems as Record<string, unknown[]>)[g.id].every((n) => bounded(n, 0, 1e9, true)),
    )
  )
    throw new Error('宝石库存无效。');
  if (
    !PETS.some((p) => p.id === s.petId) ||
    !isRecord(s.petLevels) ||
    PETS.some((p) => !bounded((s.petLevels as Record<string, unknown>)[p.id], 0, 20, true)) ||
    !((s.petLevels as Record<string, number>)[s.petId as string] > 0)
  )
    throw new Error('宠物资料无效。');
  if (
    !bounded(s.volume, 0, 1) ||
    !['portrait', 'landscape'].includes(String(s.orientation)) ||
    ['muted', 'autoSalvage', 'tutorialSeen'].some((k) => typeof s[k] !== 'boolean')
  )
    throw new Error('设置无效。');
  if (s.runRecords !== undefined) {
    if (!Array.isArray(s.runRecords) || s.runRecords.length > 20) throw new Error('远征记录无效。');
    const recordIds = new Set<string>();
    for (const record of s.runRecords) {
      if (
        !isRecord(record) ||
        typeof record.id !== 'string' ||
        !record.id ||
        record.id.length > 100 ||
        recordIds.has(record.id) ||
        !bounded(record.stage, 1, 150, true) ||
        !bounded(record.seconds, 0, 300) ||
        !bounded(record.kills, 0, 1e7, true) ||
        !bounded(record.date, 0, Date.now() + 86400000) ||
        !isRecord(record.build)
      )
        throw new Error('远征记录字段无效。');
      recordIds.add(record.id);
      const build = record.build;
      for (const key of [
        'classId',
        'level',
        'equipment',
        'cube',
        'skills',
        'autoSkills',
        'petId',
        'petLevels',
        'forge',
      ])
        if (!(key in build)) throw new Error('远征配装快照不完整。');
      // Reuse the save validator for the exact same item/class/cube rules. Records cannot nest.
      validateSave({
        ...newSave(),
        classId: build.classId,
        level: build.level,
        equipment: build.equipment,
        cube: build.cube,
        skills: build.skills,
        autoSkills: build.autoSkills,
        petId: build.petId,
        petLevels: build.petLevels,
        forge: build.forge,
        inventory: [],
        extracted: isRecord(build.cube) ? Object.values(build.cube) : [],
        runRecords: [],
      });
    }
  }
  return clone(s) as unknown as SaveData;
}

let dbPromise: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  if (!dbPromise)
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('mist-continent', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('saves');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = undefined;
        reject(req.error);
      };
    });
  return dbPromise;
}
async function readDisk(key = SAVE_KEY): Promise<unknown> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const r = db.transaction('saves').objectStore('saves').get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function writeDisk(save: unknown, key = SAVE_KEY): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', 'readwrite');
    tx.objectStore('saves').put(save, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
let hydrated = false;
let saving = false;
let recoveryBlocked = false;
let autosave: ReturnType<typeof setInterval> | undefined;

interface GameState {
  save: SaveData;
  ready: boolean;
  notice: string;
  labBackup: SaveData | null;
  lastGamble: Item[];
  corruptBackup: string | null;
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
  setNotice: (text: string) => void;
  selectClass: (id: ClassId) => void;
  selectStage: (stage: number) => void;
  updateSettings: (settings: Partial<SaveData>) => void;
  completeRun: (result: RunResult) => void;
  getStats: () => Stats;
  equip: (id: string) => void;
  unequip: (slot: Slot) => void;
  allocateSkill: (id: string) => void;
  resetSkills: () => void;
  recommendSkills: (setId: string) => void;
  toggleAuto: (id: string) => void;
  extract: (id: string) => void;
  equipCube: (id: string) => void;
  clearCube: (slot: 'weapon' | 'armor' | 'jewelry') => void;
  gamble: (slot: Slot, count: number) => void;
  salvage: (id: string) => void;
  salvageLow: () => void;
  reforge: (id: string, index: number) => void;
  upgradeForge: (slot: Slot) => void;
  combineGems: (id: string) => void;
  socketGem: (slot: Slot, gemId: string, level: number) => void;
  removeGem: (slot: Slot) => void;
  selectPet: (id: string) => void;
  upgradePet: (id: string) => void;
  activateBuild: (setId: string) => void;
  activateRecord: (id: string) => void;
  leaveLab: () => void;
  exportSave: () => void;
  exportCorruptBackup: () => void;
  importSave: (text: string) => void;
  resetProgress: () => void;
}
function materialValue(item: Item) {
  return {
    crystals: ['legendary', 'set', 'primal'].includes(item.rarity) ? 12 : 4,
    souls: ['legendary', 'set', 'primal'].includes(item.rarity) ? 2 : 0,
  };
}
function refundGem(save: SaveData, item: Item) {
  if (item.gem) save.gems[item.gem.id][item.gem.level - 1]++;
}
function addItems(save: SaveData, items: Item[]) {
  for (const item of items) {
    if (
      (save.autoSalvage && ['common', 'uncommon', 'rare', 'epic'].includes(item.rarity)) ||
      save.inventory.length >= MAX_INVENTORY
    ) {
      const m = materialValue(item);
      save.crystals += m.crystals;
      save.souls += m.souls;
      refundGem(save, item);
    } else save.inventory.push(item);
  }
}
export const useGameStore = create<GameState>((set, get) => {
  const mutate = (fn: (save: SaveData) => string | void) => {
    const save = clone(get().save);
    const notice = fn(save);
    set({ save, ...(notice ? { notice } : {}) });
  };
  return {
    save: newSave(),
    ready: false,
    notice: '',
    labBackup: null,
    lastGamble: [],
    corruptBackup: null,
    setNotice: (notice) => set({ notice }),
    async hydrate() {
      if (hydrated) return;
      hydrated = true;
      let loaded: unknown;
      let fallback = false;
      let corruptBackup: string | null = null;
      const damaged: { source: string; raw: string }[] = [];
      try {
        const prior = await readDisk(RECOVERY_KEY);
        if (typeof prior === 'string') corruptBackup = prior;
      } catch {
        /* Try the local fallback below. */
      }
      try {
        corruptBackup ??= localStorage.getItem(RECOVERY_KEY);
      } catch {
        /* Recovery remains in this session if storage is unavailable. */
      }
      try {
        loaded = await readDisk();
      } catch {
        fallback = true;
      }
      try {
        const local = localStorage.getItem(SAVE_KEY);
        if (local) {
          let backup: unknown;
          try {
            backup = JSON.parse(local);
          } catch {
            damaged.push({ source: 'localStorage', raw: local });
          }
          if (
            (backup && !loaded) ||
            (isRecord(loaded) &&
              isRecord(backup) &&
              Number(backup.lastSaved) > Number(loaded.lastSaved))
          )
            loaded = backup;
        }
      } catch {
        fallback = true;
      }
      let save = newSave();
      let notice = '欢迎来到雾隐营地。选择秘境，开始你的第一场远征。';
      if (loaded) {
        try {
          save = validateSave(loaded);
          const hours = Math.min(8, Math.max(0, (Date.now() - save.lastSaved) / 3600000));
          if (hours >= 0.05) {
            const gold = Math.floor(hours * (120 + save.highestStage * 20));
            const crystals = Math.floor(hours * 4);
            save.gold += gold;
            save.crystals += crystals;
            notice = `离线营地收益：${gold} 金币 · ${crystals} 奥术结晶（最多累计 8 小时）`;
          }
        } catch {
          damaged.push({ source: 'IndexedDB / save', raw: JSON.stringify(loaded, null, 2) });
          notice = '原存档无法读取，原始内容已留存。可在设置中导出恢复备份，或导入有效存档。';
        }
      }
      if (damaged.length) {
        if (corruptBackup) damaged.unshift({ source: 'previous recovery', raw: corruptBackup });
        corruptBackup =
          damaged.length === 1
            ? damaged[0].raw
            : JSON.stringify(
                { format: 'mist-continent-recovery', capturedAt: Date.now(), sources: damaged },
                null,
                2,
              );
        let preserved = false;
        try {
          await writeDisk(corruptBackup, RECOVERY_KEY);
          preserved = true;
        } catch {
          /* Independent local backup can still succeed. */
        }
        try {
          localStorage.setItem(RECOVERY_KEY, corruptBackup);
          preserved = true;
        } catch {
          /* Keep raw bytes in state until the user exports them. */
        }
        recoveryBlocked = !preserved;
        if (recoveryBlocked)
          notice += ' 原始备份暂存于当前会话；请先导出，自动保存已暂停以保护原始数据。';
        else if (!notice.includes('原存档'))
          notice += ' 检测到异常备用存档，原始内容已备份，可在设置中导出。';
      }
      if (fallback) notice += ' 当前使用浏览器备份存储。';
      save.lastSaved = Date.now();
      set({ save, ready: true, notice, corruptBackup });
      if (!autosave)
        autosave = setInterval(() => {
          void get().persist();
        }, 3000);
      if (typeof window !== 'undefined') {
        window.addEventListener('pagehide', () => {
          if (recoveryBlocked) return;
          try {
            localStorage.setItem(
              SAVE_KEY,
              JSON.stringify({ ...(get().labBackup ?? get().save), lastSaved: Date.now() }),
            );
          } catch {
            /* IndexedDB remains authoritative. */
          }
        });
      }
    },
    async persist() {
      if (!get().ready || saving || recoveryBlocked) return;
      saving = true;
      const save = clone(get().labBackup ?? get().save);
      save.lastSaved = Date.now();
      try {
        await writeDisk(save);
      } catch {
        try {
          localStorage.setItem(SAVE_KEY, JSON.stringify(save));
        } catch {
          set({ notice: '存档写入失败：浏览器空间不足，请在设置中导出备份。' });
        }
      }
      saving = false;
    },
    selectClass(id) {
      if (!CLASSES.some((c) => c.id === id)) return;
      const current = get().save;
      if (current.classId === id) return;
      const equippedItems = Object.values(current.equipment).filter((item): item is Item => !!item);
      if (current.inventory.length + equippedItems.length > MAX_INVENTORY) {
        set({
          notice: `背包空间不足，还需腾出 ${current.inventory.length + equippedItems.length - MAX_INVENTORY} 个空位再切换职业。`,
        });
        return;
      }
      mutate((s) => {
        // Returning worn gear is a transfer, never a loot pickup or salvage operation.
        s.inventory.push(...Object.values(s.equipment).filter((item): item is Item => !!item));
        s.equipment = {};
        s.classId = id;
        for (const slot of ['weapon', 'armor', 'jewelry'] as const) {
          const relic = LEGENDARIES.find((l) => l.id === s.cube[slot]);
          if (relic?.classId && relic.classId !== id) delete s.cube[slot];
        }
        if (!SKILLS.some((n) => n.classId === id && s.skills[n.id]))
          Object.assign(s.skills, starters(id));
        return `已切换为${CLASSES.find((c) => c.id === id)!.name}，装备已收回背包。`;
      });
    },
    selectStage(stage) {
      mutate((s) => {
        s.selectedStage = Math.max(1, Math.min(s.highestStage, Math.floor(stage)));
      });
    },
    updateSettings(settings) {
      mutate((s) => {
        for (const key of [
          'volume',
          'muted',
          'autoSalvage',
          'orientation',
          'tutorialSeen',
        ] as const)
          if (settings[key] !== undefined) Object.assign(s, { [key]: settings[key] });
      });
    },
    completeRun(result) {
      if (get().labBackup) {
        set({ notice: '演武结束。体验装备与奖励不会写入开荒存档。' });
        return;
      }
      mutate((s) => {
        if (result.won) {
          const { classId, level, equipment, cube, skills, autoSkills, petId, petLevels, forge } =
            s;
          const record: RunRecord = {
            id:
              globalThis.crypto?.randomUUID?.() ??
              `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            stage: result.stage,
            seconds: result.seconds,
            kills: result.kills,
            date: Date.now(),
            build: clone({
              classId,
              level,
              equipment,
              cube,
              skills,
              autoSkills,
              petId,
              petLevels,
              forge,
            }),
          };
          s.runRecords = [...(s.runRecords ?? []), record]
            .sort((a, b) => b.stage - a.stage || a.seconds - b.seconds || b.date - a.date)
            .slice(0, 20);
        }
        const priorKills = s.kills,
          priorClears = s.clears,
          priorStage = s.highestStage;
        s.gold += result.gold;
        s.shards += result.shards;
        s.kills += result.kills;
        s.xp += result.kills * 12 + (result.won ? 250 : 0);
        while (s.level < 100 && s.xp >= s.level * 180) {
          s.xp -= s.level * 180;
          s.level++;
        }
        addItems(s, result.items);
        if (result.won) {
          s.clears++;
          s.bestTime = s.bestTime ? Math.min(s.bestTime, result.seconds) : result.seconds;
          if (result.stage >= s.highestStage)
            s.highestStage = Math.min(150, result.stage + (result.seconds < 100 ? 3 : 1));
          const gem = GEMS[Math.floor(Math.random() * GEMS.length)];
          s.gems[gem.id][Math.min(9, Math.floor(result.stage / 20))]++;
        }
        if (priorKills < 100 && s.kills >= 100) s.gold += 500;
        if (priorClears < 5 && s.clears >= 5) s.shards += 250;
        if (priorStage < 15 && s.highestStage >= 15) s.crystals += 50;
        return result.won
          ? `秘境已肃清 · 获得 ${result.gold} 金币与 ${result.shards} 神秘碎片`
          : '远征结束，已带回本次收获。';
      });
    },
    getStats: () => computeStats(get().save),
    equip(id) {
      mutate((s) => {
        const i = s.inventory.findIndex((x) => x.id === id);
        if (i < 0) return;
        const item = s.inventory[i];
        const l = LEGENDARIES.find((l) => l.id === item.legendaryId);
        const t = SETS.find((t) => t.id === item.setId);
        if ((l?.classId && l.classId !== s.classId) || (t && t.classId !== s.classId))
          return '这件装备属于其他职业。';
        const old = s.equipment[item.slot];
        s.inventory.splice(i, 1);
        if (old) s.inventory.push(old);
        s.equipment[item.slot] = item;
        return `已装备 ${item.name}`;
      });
    },
    unequip(slot) {
      mutate((s) => {
        const item = s.equipment[slot];
        if (item) {
          if (s.inventory.length >= MAX_INVENTORY) return '背包已满，请先整理。';
          s.inventory.push(item);
          delete s.equipment[slot];
        }
      });
    },
    allocateSkill(id) {
      mutate((s) => {
        const node = SKILLS.find((n) => n.id === id && n.classId === s.classId);
        if (!node) return;
        if (skillPoints(s) <= 0) return '升级角色可获得更多技能点。';
        if ((s.skills[id] ?? 0) >= 5) return '该节点已达满级。';
        if (node.parent && !s.skills[node.parent]) return '请先点亮前置技能。';
        s.skills[id] = (s.skills[id] ?? 0) + 1;
        return `${node.name}提升至 ${s.skills[id]} 级`;
      });
    },
    resetSkills() {
      mutate((s) => {
        for (const n of SKILLS.filter((n) => n.classId === s.classId)) delete s.skills[n.id];
        Object.assign(s.skills, starters(s.classId));
        return '技能已免费重置，基础战斗技能保持解锁。';
      });
    },
    recommendSkills(setId) {
      mutate((s) => {
        const setDef = SETS.find((t) => t.id === setId && t.classId === s.classId);
        if (!setDef) return;
        for (const n of SKILLS.filter((n) => n.classId === s.classId)) delete s.skills[n.id];
        Object.assign(s.skills, starters(s.classId));
        const nodes = SKILLS.filter((n) => n.classId === s.classId).sort((a, b) =>
          a.id === setDef.skillId ? -1 : b.id === setDef.skillId ? 1 : a.tier - b.tier,
        );
        for (let pass = 0; pass < 5; pass++)
          for (const n of nodes)
            if (
              skillPoints(s) > 0 &&
              (s.skills[n.id] ?? 0) < 5 &&
              (!n.parent || s.skills[n.parent])
            )
              s.skills[n.id] = (s.skills[n.id] ?? 0) + 1;
        preferBuildSkills(s, setDef.skillId);
        return `已按${setDef.name}分配可用技能点。`;
      });
    },
    toggleAuto(id) {
      mutate((s) => {
        s.autoSkills[id] = !(s.autoSkills[id] ?? true);
      });
    },
    extract(id) {
      mutate((s) => {
        const item = s.inventory.find((i) => i.id === id);
        if (!item?.legendaryId) return '仅传奇散件可以萃取。';
        if (s.extracted.includes(item.legendaryId)) return '此特效已永久解锁。';
        if (s.crystals < 15 || s.souls < 1) return '萃取需要 15 结晶与 1 遗忘之魂。';
        s.crystals -= 15;
        s.souls--;
        s.extracted.push(item.legendaryId);
        refundGem(s, item);
        s.inventory = s.inventory.filter((i) => i.id !== id);
        return '传奇已萃取，可在对应共鸣槽装配。';
      });
    },
    equipCube(id) {
      mutate((s) => {
        const def = LEGENDARIES.find((l) => l.id === id);
        if (!def || !s.extracted.includes(id)) return;
        if (def.classId && def.classId !== s.classId) return '该共鸣仅适用于对应职业。';
        s.cube[cubeSlot(def.slot)] = id;
        return `已共鸣 ${def.name} · 特效按满值生效`;
      });
    },
    clearCube(slot) {
      mutate((s) => {
        delete s.cube[slot];
      });
    },
    gamble(slot, count) {
      count = count === 10 ? 10 : 1;
      const s = clone(get().save);
      if (s.shards < count * 50) {
        set({ notice: `需要 ${count * 50} 神秘碎片。` });
        return;
      }
      if (s.inventory.length + count > MAX_INVENTORY) {
        set({ notice: '背包空间不足，请先整理装备。' });
        return;
      }
      s.shards -= count * 50;
      const items = Array.from({ length: count }, () =>
        generateLoot(s.classId, Math.max(s.level, s.highestStage), {
          slot,
          gambling: true,
          ownedSetPieces: [
            ...s.inventory,
            ...Object.values(s.equipment).filter((i): i is Item => !!i),
          ]
            .filter((i) => i.setId)
            .map((i) => `${i.setId}:${i.slot}`),
        }),
      );
      addItems(s, items);
      set({
        save: s,
        lastGamble: items,
        notice: `米娅揭开命运：${items.filter((i) => ['legendary', 'set', 'primal'].includes(i.rarity)).length} 件珍稀战利品`,
      });
    },
    salvage(id) {
      mutate((s) => {
        const item = s.inventory.find((i) => i.id === id);
        if (!item) return;
        const m = materialValue(item);
        s.crystals += m.crystals;
        s.souls += m.souls;
        refundGem(s, item);
        s.inventory = s.inventory.filter((i) => i.id !== id);
        return `已分解，获得 ${m.crystals} 结晶、${m.souls} 遗忘之魂`;
      });
    },
    salvageLow() {
      mutate((s) => {
        const items = s.inventory.filter((i) =>
          ['common', 'uncommon', 'rare', 'epic'].includes(i.rarity),
        );
        for (const i of items) {
          const m = materialValue(i);
          s.crystals += m.crystals;
          refundGem(s, i);
        }
        s.inventory = s.inventory.filter((i) => !items.includes(i));
        return `已分解 ${items.length} 件史诗及以下装备`;
      });
    },
    reforge(id, index) {
      mutate((s) => {
        const item = [...s.inventory, ...Object.values(s.equipment)].find((i) => i?.id === id);
        if (!item || !item.affixes[index]) return;
        if (item.reforged !== undefined && item.reforged !== index)
          return '这件装备已经锁定另一条洗练词条。';
        if (s.gold < 200 || s.crystals < 8) return '洗练需要 200 金币与 8 结晶。';
        s.gold -= 200;
        s.crystals -= 8;
        const pool = AFFIXES.filter(
          (a) => !item.affixes.some((v, i) => i !== index && v.id === a.id),
        );
        let roll = Math.random() * pool.reduce((sum, a) => sum + a.weight, 0);
        const affix = pool.find((a) => (roll -= a.weight) <= 0) ?? pool[0];
        const value =
          item.rarity === 'primal'
            ? affix.max * 1.3
            : affix.min + Math.random() * (affix.max - affix.min);
        item.affixes[index] = { id: affix.id, value };
        item.reforged = index;
        return `洗练完成：${affix.name}。此装备仅此词条可重复洗练。`;
      });
    },
    upgradeForge(slot) {
      mutate((s) => {
        const lv = s.forge[slot];
        if (lv >= 50) return '神铸已达 +50';
        const gold = 100 + lv * 80,
          crystals = 5 + lv * 2;
        if (s.gold < gold || s.crystals < crystals) return `需要 ${gold} 金币与 ${crystals} 结晶。`;
        s.gold -= gold;
        s.crystals -= crystals;
        s.forge[slot]++;
        return `${SLOT_NAMES[slot]}神铸 +${s.forge[slot]}`;
      });
    },
    combineGems(id) {
      mutate((s) => {
        const counts = s.gems[id];
        if (!counts) return;
        let total = 0;
        for (let i = 0; i < 9; i++) {
          const n = Math.floor(counts[i] / 3);
          counts[i] -= n * 3;
          counts[i + 1] += n;
          total += n;
        }
        return total ? `已完成 ${total} 次三合一合成` : '需要 3 颗同种同级宝石。';
      });
    },
    socketGem(slot, id, level) {
      mutate((s) => {
        const item = s.equipment[slot];
        if (!item) return '请先在该槽位穿戴装备。';
        if (!s.gems[id]?.[level - 1]) return '对应宝石库存不足。';
        refundGem(s, item);
        s.gems[id][level - 1]--;
        item.gem = { id, level };
        return '宝石已镶嵌，替换的宝石无损返还。';
      });
    },
    removeGem(slot) {
      mutate((s) => {
        const item = s.equipment[slot];
        if (item?.gem) {
          refundGem(s, item);
          delete item.gem;
          return '宝石已无损取回。';
        }
      });
    },
    selectPet(id) {
      mutate((s) => {
        if ((s.petLevels[id] ?? 0) > 0) s.petId = id;
        else return '先缔结契约，即可让伙伴出战。';
      });
    },
    upgradePet(id) {
      mutate((s) => {
        if (!PETS.some((p) => p.id === id)) return;
        const lv = s.petLevels[id] ?? 0;
        if (lv >= 20) return '伙伴已满级。';
        const price = 300 + lv * 250;
        if (s.gold < price) return `需要 ${price} 金币。`;
        s.gold -= price;
        s.petLevels[id] = lv + 1;
        return lv ? '伙伴已升级。' : '契约缔结，可以让伙伴出战。';
      });
    },
    activateBuild(setId) {
      const def = SETS.find((t) => t.id === setId);
      const build = BUILD_RELICS[setId];
      if (!def || !build) return;
      const backup = get().labBackup ?? clone(get().save);
      const s = clone(backup);
      s.classId = def.classId;
      s.level = 100;
      s.highestStage = 150;
      s.selectedStage = 30;
      s.skills = Object.fromEntries(
        SKILLS.filter((n) => n.classId === def.classId).map((n) => [n.id, 5]),
      );
      preferBuildSkills(s, def.skillId);
      s.equipment = {};
      for (const id of build.worn) {
        const relic = LEGENDARIES.find((l) => l.id === id)!;
        s.equipment[relic.slot] = generateLoot(def.classId, 100, {
          slot: relic.slot,
          legendaryId: id,
          primal: true,
        });
      }
      for (const slot of ['head', 'chest', 'hands', 'legs', 'feet'] as Slot[])
        if (!s.equipment[slot])
          s.equipment[slot] = generateLoot(def.classId, 100, { slot, setId, primal: true });
      s.cube = {};
      for (const id of build.cube) {
        const relic = LEGENDARIES.find((l) => l.id === id)!;
        s.cube[cubeSlot(relic.slot)] = id;
        if (!s.extracted.includes(id)) s.extracted.push(id);
      }
      s.forge = Object.fromEntries(SLOTS.map((slot) => [slot, 30])) as Record<Slot, number>;
      set({
        save: s,
        labBackup: backup,
        notice: `演武模式 · ${def.name}已成型。退出演武将恢复开荒进度。`,
      });
    },
    activateRecord(id) {
      const backup = get().labBackup ?? clone(get().save);
      const record = backup.runRecords?.find((r) => r.id === id);
      if (!record) {
        set({ notice: '该远征记录已不在本机榜单中。' });
        return;
      }
      const save = clone(backup);
      Object.assign(save, clone(record.build));
      save.inventory = [];
      save.highestStage = Math.max(save.highestStage, record.stage);
      save.selectedStage = record.stage;
      for (const id of Object.values(save.cube))
        if (id && !save.extracted.includes(id)) save.extracted.push(id);
      set({
        save,
        labBackup: backup,
        lastGamble: [],
        notice: '已载入历史配装快照。体验独立于开荒进度，退出后完整恢复。',
      });
    },
    leaveLab() {
      const backup = get().labBackup;
      if (backup)
        set({ save: backup, labBackup: null, lastGamble: [], notice: '已返回原本的开荒进度。' });
    },
    exportSave() {
      const save = clone(get().labBackup ?? get().save);
      save.lastSaved = Date.now();
      const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mist-continent-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    exportCorruptBackup() {
      const raw = get().corruptBackup;
      if (!raw) return;
      const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `mist-continent-recovery-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      recoveryBlocked = false;
      set({ notice: '已导出原始恢复备份，请保留该文件。' });
      void get().persist();
    },
    importSave(text) {
      try {
        if (text.length > 2000000) throw new Error('文件过大。');
        const save = validateSave(JSON.parse(text));
        save.lastSaved = Date.now();
        set({ save, labBackup: null, lastGamble: [], notice: '存档导入成功。' });
        void get().persist();
      } catch (error) {
        set({ notice: `导入失败：${error instanceof Error ? error.message : '无效 JSON'}` });
      }
    },
    resetProgress() {
      set({ save: newSave(), labBackup: null, lastGamble: [], notice: '新的远征已经开始。' });
      void get().persist();
    },
  };
});
