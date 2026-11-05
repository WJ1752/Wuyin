import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newSave,
  newAccountSave,
  validateSave,
  useGameStore,
  computeStats,
  cubeSlot,
  emptySlotItems,
  snapshotAccounts,
  createCombatConfig,
} from '../src/state/gameStore';
import { generateLoot } from '../src/engine/LootGenerator';
import { getActiveSkills } from '../src/engine/GameEngine';
import { SETS } from '../src/data/sets';
import { LEGENDARIES } from '../src/data/legendaries';
import { GEMS } from '../src/data/affixes';
import type { Item } from '../src/core/types';

function reset() {
  const data = newAccountSave();
  useGameStore.setState({
    save: data.accounts[0].characters[0].save,
    accounts: data.accounts,
    activeAccountId: data.activeAccountId,
    inCombat: false,
    labBackup: null,
    notice: '',
    lastGamble: [],
  });
  return useGameStore.getState();
}
function gemTotal() {
  const s = useGameStore.getState().save;
  return (
    GEMS.reduce(
      (total, g) => total + s.gems[g.id].reduce((n, count, i) => n + count * 3 ** i, 0),
      0,
    ) +
    Object.values(s.equipment).reduce(
      (n, item) => n + (item?.gem ? 3 ** (item.gem.level - 1) : 0),
      0,
    )
  );
}

test('save import accepts generated equipment and rejects corrupt economy and duplicate identities', () => {
  const save = newSave();
  save.inventory = [generateLoot('ranger', 20, { legendaryId: 'dawn', primal: true })];
  assert.deepEqual(
    validateSave(JSON.parse(JSON.stringify(save))),
    JSON.parse(JSON.stringify(save)),
  );
  assert.throws(() => validateSave({ ...save, gold: -1 }));
  assert.throws(() => validateSave({ ...save, version: 100 }));
  assert.throws(() => validateSave({ ...save, inventory: [save.inventory[0], save.inventory[0]] }));
  assert.throws(() => validateSave({ ...save, cube: { armor: 'dawn' }, extracted: ['dawn'] }));
  assert.throws(() => validateSave({ ...save, petId: 'missing' }));
});
test('quick equip fills empty slots with compatible gear and preserves choices across reloads', () => {
  reset();
  const save = newSave();
  const equipped = generateLoot('ranger', 1, { slot: 'weapon', rarity: 'common' });
  const betterWeapon = generateLoot('ranger', 100, { legendaryId: 'dawn' });
  const wrongClass = generateLoot('barbarian', 100, { setId: 'wasteland', slot: 'head' });
  const weakHead = generateLoot('ranger', 1, { slot: 'head', rarity: 'common' });
  const strongHead = generateLoot('ranger', 20, { slot: 'head', rarity: 'epic' });
  strongHead.gem = { id: 'ruby', level: 1 };
  save.equipment.weapon = equipped;
  save.inventory = [betterWeapon, wrongClass, weakHead, strongHead];
  useGameStore.setState({ save });
  assert.deepEqual(
    emptySlotItems(save).map((item) => item.id),
    [strongHead.id],
  );
  useGameStore.getState().equipEmptySlots();
  useGameStore.getState().equipEmptySlots();
  const restored = validateSave(
    snapshotAccounts(useGameStore.getState()).accounts[0].characters[0].save,
  );
  assert.equal(restored.equipment.weapon?.id, equipped.id);
  assert.equal(restored.equipment.head?.id, strongHead.id);
  assert.deepEqual(restored.equipment.head?.gem, strongHead.gem);
  assert.deepEqual(
    restored.inventory.map((item) => item.id),
    [betterWeapon.id, wrongClass.id, weakHead.id],
  );
});

test('settlement reports drops actually stored or salvaged after the chapter gift takes a slot', () => {
  reset();
  const save = newSave();
  const common = generateLoot('ranger', 1, { rarity: 'common' });
  const relic = generateLoot('ranger', 16, { legendaryId: 'dawn' });
  save.autoSalvage = true;
  save.inventory = Array.from({ length: 238 }, (_, i) => ({ ...common, id: `packed-${i}` }));
  useGameStore.setState({ save });
  useGameStore.getState().completeRun({
    won: true,
    stage: 4,
    seconds: 90,
    kills: 50,
    gold: 0,
    shards: 0,
    items: [common, relic, { ...relic, id: 'overflow' }],
  });
  const state = useGameStore.getState();
  assert.equal(state.save.inventory.length, 240);
  assert.equal(state.save.inventory.at(-1)?.id, relic.id);
  assert.equal(state.save.crystals - save.crystals, 16);
  assert.equal(state.save.souls - save.souls, 2);
  assert.match(
    state.notice,
    /战场装备入包 1 件，按设置分解 1 件，背包满额分解 1 件（其中传奇及以上 1 件），分解所得 16 结晶、2 遗忘之魂/,
  );
});

test('gem combination, replacement and removal preserve total gem value', () => {
  reset();
  const save = useGameStore.getState().save;
  save.equipment.weapon = generateLoot('ranger', 1, { slot: 'weapon' });
  useGameStore.setState({ save });
  const before = gemTotal();
  useGameStore.getState().combineGems('ruby');
  assert.equal(gemTotal(), before);
  useGameStore.getState().socketGem('weapon', 'ruby', 2);
  assert.equal(gemTotal(), before);
  useGameStore.getState().socketGem('weapon', 'topaz', 1);
  assert.equal(gemTotal(), before);
  useGameStore.getState().removeGem('weapon');
  assert.equal(gemTotal(), before);
});
test('gambling pays exactly once and insufficient shards make no mutation', () => {
  reset();
  const before = JSON.stringify(useGameStore.getState().save);
  useGameStore.getState().gamble('head', 10);
  assert.equal(JSON.stringify(useGameStore.getState().save), before);
  useGameStore.setState({ save: { ...useGameStore.getState().save, shards: 500 } });
  useGameStore.getState().gamble('head', 10);
  const s = useGameStore.getState().save;
  assert.equal(s.shards, 0);
  assert.equal(s.inventory.length, 10);
  assert.ok(s.inventory.every((i) => i.slot === 'head'));
});
test('class selection changes character slots and preserves even a full original backpack', () => {
  reset();
  const save = newSave();
  save.autoSalvage = true;
  const weapon = generateLoot('ranger', 1, { slot: 'weapon', rarity: 'rare' });
  weapon.gem = { id: 'ruby', level: 1 };
  save.equipment = { weapon };
  save.inventory = Array.from({ length: 240 }, (_, index) => ({
    ...weapon,
    id: `stored-${index}`,
  }));
  useGameStore.setState({ save });
  useGameStore.getState().selectClass('barbarian');
  const switched = useGameStore.getState().save;
  assert.equal(switched.classId, 'barbarian');
  assert.equal(switched.level, 1);
  assert.deepEqual(switched.equipment, {});
  assert.equal(switched.inventory.length, 0);
  useGameStore.getState().selectClass('ranger');
  const restored = useGameStore.getState().save;
  assert.deepEqual(restored.equipment, JSON.parse(JSON.stringify(save.equipment)));
  assert.deepEqual(restored.inventory, JSON.parse(JSON.stringify(save.inventory)));
  assert.equal(restored.crystals, save.crystals);
  assert.deepEqual(restored.gems, save.gems);
});
test('all fifteen laboratory loadouts restore original progress and grant no run rewards', () => {
  reset();
  const original = structuredClone(useGameStore.getState().save);
  for (const set of SETS) {
    useGameStore.getState().activateBuild(set.id);
    const state = useGameStore.getState();
    const items = Object.values(state.save.equipment) as Item[];
    assert.equal(items.length, 8);
    assert.equal(items.filter((i) => i.setId === set.id).length, 4);
    assert.ok(items.every((i) => i.rarity === 'primal'));
    for (const [slot, id] of Object.entries(state.save.cube)) {
      const def = LEGENDARIES.find((l) => l.id === id)!;
      assert.equal(cubeSlot(def.slot), slot);
      assert.ok(!items.some((i) => i.legendaryId === id));
    }
    assert.equal(Object.keys(state.save.cube).length, 3);
    assert.equal(validateSave(JSON.parse(JSON.stringify(state.save))).classId, set.classId);
    assert.equal(state.save.autoSkills[set.skillId], true);
    const active = getActiveSkills(createCombatConfig(state.save));
    assert.equal(active.length, 6);
    assert.ok(active.some((skill) => skill.id === set.skillId));
    state.completeRun({
      won: true,
      stage: 30,
      seconds: 15,
      kills: 100,
      gold: 5000,
      shards: 500,
      items: [],
    });
    useGameStore.getState().leaveLab();
    assert.deepEqual(useGameStore.getState().save, original);
  }
});
test('each recommendation selects its defining active skill without changing equipment', () => {
  for (const set of SETS) {
    reset();
    useGameStore.getState().selectClass(set.classId);
    useGameStore.setState({ save: { ...useGameStore.getState().save, level: 20 } });
    useGameStore.getState().recommendSkills(set.id);
    const save = useGameStore.getState().save;
    assert.deepEqual(save.equipment, {});
    assert.ok(getActiveSkills(createCombatConfig(save)).some((skill) => skill.id === set.skillId));
  }
});
test('forge inherits across equipment changes and preserves critical overflow', () => {
  reset();
  const save = newSave();
  save.equipment.weapon = generateLoot('ranger', 1, { slot: 'weapon' });
  save.equipment.weapon.affixes = [{ id: 'critChance', value: 1.2 }];
  save.forge.weapon = 10;
  const stats = computeStats(save);
  assert.ok(stats.critChance > 1);
  const flat = save.equipment.weapon.attack;
  save.forge.weapon = 0;
  assert.ok(Math.abs(stats.attack - computeStats(save).attack - flat * 0.4) < 0.00001);
});
test('clear records keep historical gear and replay in an isolated restorable save', () => {
  reset();
  const save = newSave();
  save.level = 20;
  save.equipment.weapon = generateLoot('ranger', 20, { legendaryId: 'dawn', primal: true });
  const originalWeapon = JSON.parse(JSON.stringify(save.equipment.weapon));
  useGameStore.setState({ save });
  useGameStore
    .getState()
    .completeRun({ won: true, stage: 1, seconds: 75, kills: 50, gold: 100, shards: 50, items: [] });
  const record = useGameStore.getState().save.runRecords![0];
  assert.deepEqual(record.build.equipment.weapon, originalWeapon);
  assert.equal(record.build.level, 20);
  useGameStore.getState().unequip('weapon');
  const beforeReplay = JSON.stringify(useGameStore.getState().save);
  useGameStore.getState().activateRecord(record.id);
  assert.deepEqual(useGameStore.getState().save.equipment.weapon, originalWeapon);
  useGameStore.getState().completeRun({
    won: true,
    stage: 1,
    seconds: 10,
    kills: 100,
    gold: 10000,
    shards: 500,
    items: [],
  });
  useGameStore.getState().leaveLab();
  assert.equal(JSON.stringify(useGameStore.getState().save), beforeReplay);
  assert.equal(validateSave(JSON.parse(beforeReplay)).runRecords!.length, 1);
  const invalid = JSON.parse(beforeReplay);
  invalid.runRecords[0].build.equipment.weapon.legendaryId = 'unknown';
  assert.throws(() => validateSave(invalid));
});
test('season rewards fire once and fast victories unlock three stages', () => {
  reset();
  const store = useGameStore.getState();
  store.completeRun({
    won: true,
    stage: 1,
    seconds: 80,
    kills: 100,
    gold: 100,
    shards: 50,
    items: [],
  });
  const first = useGameStore.getState().save;
  assert.equal(first.highestStage, 4);
  assert.equal(first.gold, 2100);
  useGameStore.getState().completeRun({
    won: true,
    stage: 1,
    seconds: 80,
    kills: 100,
    gold: 100,
    shards: 50,
    items: [],
  });
  assert.equal(useGameStore.getState().save.gold, 2200);
  assert.equal(useGameStore.getState().save.highestStage, 4);
});
