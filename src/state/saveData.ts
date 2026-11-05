import type { AccountData, AccountSave, ClassId, Item, SaveData, Slot } from '../core/types';
import { SLOTS } from '../core/types';
import { CLASSES } from '../data/classes';
import { SKILLS } from '../data/skillTrees';
import { SETS } from '../data/sets';
import { LEGENDARIES } from '../data/legendaries';
import { AFFIXES, GEMS, PETS } from '../data/affixes';
import {
  PROGRESSION_MILESTONES,
  HUNT_LIMIT,
  skillLearningStatus,
  skillUnlockLevel,
  starterSkills,
} from '../data/progression';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const starters = starterSkills;
export const MAX_INVENTORY = 240;
export const MAX_STASH = 480;
export const MAX_CHARACTERS = 6;
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export function newSave(classId: ClassId = 'ranger'): SaveData {
  return {
    version: 1,
    classId,
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
    skills: starters(classId),
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
    progression: { version: 1, clearedStage: 0, claimedMilestones: [] },
  };
}
export function cubeSlot(slot: Slot): 'weapon' | 'armor' | 'jewelry' {
  return slot === 'weapon' || slot === 'offhand'
    ? 'weapon'
    : slot === 'jewelry'
      ? 'jewelry'
      : 'armor';
}
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const bounded = (v: unknown, min: number, max: number, integer = false): v is number =>
  typeof v === 'number' &&
  Number.isFinite(v) &&
  v >= min &&
  v <= max &&
  (!integer || Number.isInteger(v));
export function validateSave(input: unknown, historical = false): SaveData {
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
    (s.keepRareAffix !== undefined && !AFFIXES.some((a) => a.id === s.keepRareAffix)) ||
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
      validateSave(
        {
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
        },
        true,
      );
    }
  }
  if (s.progression !== undefined) {
    const p = s.progression;
    if (
      !isRecord(p) ||
      p.version !== 1 ||
      !bounded(p.clearedStage, 0, 150, true) ||
      !Array.isArray(p.claimedMilestones) ||
      p.claimedMilestones.length > CLASSES.length * PROGRESSION_MILESTONES.length ||
      new Set(p.claimedMilestones).size !== p.claimedMilestones.length ||
      p.claimedMilestones.some(
        (key) =>
          !CLASSES.some((hero) =>
            PROGRESSION_MILESTONES.some((m) => key === `${hero.id}:${m.stage}`),
          ),
      ) ||
      (p.campFocus !== undefined && p.campFocus !== 'crystals' && p.campFocus !== 'shards') ||
      (p.hunt !== undefined &&
        (Number(p.clearedStage) < 16 ||
          !isRecord(p.hunt) ||
          !bounded(p.hunt.misses, 0, HUNT_LIMIT - 1, true) ||
          !LEGENDARIES.some(
            (l) =>
              l.id === (p.hunt as Record<string, unknown>).legendaryId &&
              (!l.classId || l.classId === s.classId),
          ))) ||
      (p.targetSetId !== undefined && !SETS.some((set) => set.id === p.targetSetId))
    )
      throw new Error('成长旅程记录无效。');
  }
  const save = clone(s) as unknown as SaveData;
  if (!save.progression) {
    // Old equipment/economy survives. Rebuild old automatic unlocks into the new
    // level/parent budget; unspent points remain available to choose again.
    save.progression = {
      version: 1,
      clearedStage: save.runRecords?.length
        ? Math.max(...save.runRecords.map((record) => record.stage))
        : Math.max(0, save.highestStage - 3),
      claimedMilestones: [],
    };
    const previous = { ...save.skills };
    save.skills = {};
    for (const hero of CLASSES) {
      if (
        hero.id !== save.classId &&
        !SKILLS.some((node) => node.classId === hero.id && previous[node.id])
      )
        continue;
      Object.assign(save.skills, starters(hero.id));
      const view = { ...save, classId: hero.id };
      const nodes = SKILLS.filter((node) => node.classId === hero.id).sort(
        (a, b) => skillUnlockLevel(a) - skillUnlockLevel(b),
      );
      for (let pass = 0; pass < 5; pass++)
        for (const node of nodes)
          if (
            (view.skills[node.id] ?? 0) < (previous[node.id] ?? 0) &&
            skillLearningStatus(view, node).canLearn
          )
            view.skills[node.id] = (view.skills[node.id] ?? 0) + 1;
    }
    // Existing accounts can earn each new chapter gift once by clearing its
    // threshold (or a deeper rift); migration never grants items on load.
  } else if (!historical) {
    for (const hero of CLASSES) {
      const nodes = SKILLS.filter((node) => node.classId === hero.id);
      const spent = nodes.reduce((sum, node) => sum + (save.skills[node.id] ?? 0), 0);
      if (
        spent > 1 + (save.level - 1) * 2 ||
        nodes.some((node) => {
          const rank = save.skills[node.id] ?? 0;
          return (
            rank > 0 &&
            (save.level < skillUnlockLevel(node) + (rank - 1) * 3 ||
              (node.parent && (save.skills[node.parent] ?? 0) < 2))
          );
        })
      )
        throw new Error('技能分配超出当前等级、前置条件或可用点数。');
    }
    if (
      !SKILLS.some(
        (node) => node.classId === save.classId && node.kind === 'basic' && save.skills[node.id],
      )
    )
      throw new Error('当前职业至少需要一个基础攻击。');
  }
  return save;
}

export const identity = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const validName = (name: unknown): name is string =>
  typeof name === 'string' &&
  name === name.trim() &&
  name.length > 0 &&
  name.length <= 24 &&
  !/[\u0000-\u001f\u007f]/.test(name);
export const nameKey = (name: string) => name.normalize('NFKC').toLocaleLowerCase();

export function newAccountSave(save = newSave()): AccountSave {
  const character = { id: identity(), name: '初始行者', save: clone(save) };
  const account: AccountData = {
    id: identity(),
    name: '本地账号',
    activeCharacterId: character.id,
    characters: [character],
    stash: [],
  };
  return {
    format: 'mist-continent-accounts',
    version: 1,
    activeAccountId: account.id,
    accounts: [account],
    lastSaved: save.lastSaved,
  };
}

export function validateAccountSave(input: unknown): AccountSave {
  // Existing single-character saves migrate into the first slot without moving gear.
  if (isRecord(input) && input.format === undefined) return newAccountSave(validateSave(input));
  if (
    !isRecord(input) ||
    input.format !== 'mist-continent-accounts' ||
    input.version !== 1 ||
    !bounded(input.lastSaved, 0, Date.now() + 86400000) ||
    !Array.isArray(input.accounts) ||
    !input.accounts.length
  )
    throw new Error('账号存档格式无效。');
  const identities = new Set<string>();
  const names = new Set<string>();
  const itemIds = new Set<string>();
  const checkIdentity = (id: unknown) => {
    if (typeof id !== 'string' || !id || id.length > 100 || identities.has(id))
      throw new Error('账号或角色标识重复或无效。');
    identities.add(id);
  };
  const checkItems = (items: Item[]) => {
    for (const item of items) {
      if (itemIds.has(item.id)) throw new Error('角色或仓库中存在重复装备。');
      itemIds.add(item.id);
    }
  };
  const accounts = input.accounts.map((raw): AccountData => {
    if (
      !isRecord(raw) ||
      !validName(raw.name) ||
      names.has(nameKey(raw.name)) ||
      !Array.isArray(raw.characters) ||
      raw.characters.length < 1 ||
      raw.characters.length > MAX_CHARACTERS ||
      !Array.isArray(raw.stash) ||
      raw.stash.length > MAX_STASH
    )
      throw new Error('账号名称、角色槽或仓库无效。');
    checkIdentity(raw.id);
    names.add(nameKey(raw.name));
    const characterNames = new Set<string>();
    const characters = raw.characters.map((character) => {
      if (
        !isRecord(character) ||
        !validName(character.name) ||
        characterNames.has(nameKey(character.name))
      )
        throw new Error('角色名称无效或重复。');
      checkIdentity(character.id);
      characterNames.add(nameKey(character.name));
      const save = validateSave(character.save);
      checkItems([...save.inventory, ...Object.values(save.equipment)] as Item[]);
      return { id: character.id as string, name: character.name, save };
    });
    if (!characters.some((character) => character.id === raw.activeCharacterId))
      throw new Error('当前角色不存在。');
    // Reuse the existing item validator, with chunks respecting its backpack limit.
    for (let offset = 0; offset < raw.stash.length; offset += MAX_INVENTORY)
      validateSave({ ...newSave(), inventory: raw.stash.slice(offset, offset + MAX_INVENTORY) });
    checkItems(raw.stash as Item[]);
    return {
      id: raw.id as string,
      name: raw.name,
      activeCharacterId: raw.activeCharacterId as string,
      characters,
      stash: clone(raw.stash) as Item[],
    };
  });
  if (!accounts.some((account) => account.id === input.activeAccountId))
    throw new Error('当前账号不存在。');
  return {
    format: 'mist-continent-accounts',
    version: 1,
    accounts,
    activeAccountId: input.activeAccountId as string,
    lastSaved: input.lastSaved as number,
  };
}
