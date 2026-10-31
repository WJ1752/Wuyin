import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_CHARACTERS,
  MAX_INVENTORY,
  MAX_STASH,
  createCombatConfig,
  newAccountSave,
  newSave,
  snapshotAccounts,
  useGameStore,
  validateAccountSave,
} from '../src/state/gameStore';
import { generateLoot } from '../src/engine/LootGenerator';
import type { AccountSave } from '../src/core/types';

function reset(data = newAccountSave()) {
  const account = data.accounts.find((account) => account.id === data.activeAccountId)!;
  useGameStore.setState({
    accounts: data.accounts,
    activeAccountId: data.activeAccountId,
    save: account.characters.find((character) => character.id === account.activeCharacterId)!.save,
    labBackup: null,
    inCombat: false,
    ready: false,
    lastGamble: [],
    notice: '',
  });
  return useGameStore.getState();
}
const account = () => {
  const state = useGameStore.getState();
  return state.accounts.find((entry) => entry.id === state.activeAccountId)!;
};

test('legacy migration preserves the complete character and validates all account slots and storage', () => {
  const legacy = newSave('druid');
  legacy.inventory.push(generateLoot('druid', 50, { setId: 'wild_vines', slot: 'head' }));
  legacy.gold = 123456;
  const data = validateAccountSave(legacy);
  assert.deepEqual(data.accounts[0].characters[0].save, JSON.parse(JSON.stringify(legacy)));
  assert.equal(data.accounts[0].stash.length, 0);
  assert.deepEqual(validateAccountSave(JSON.parse(JSON.stringify(data))), data);
  for (const alter of [
    (copy: AccountSave) => {
      copy.accounts[0].activeCharacterId = 'missing';
    },
    (copy: AccountSave) => {
      copy.activeAccountId = 'missing';
    },
    (copy: AccountSave) => {
      copy.accounts[0].stash = [legacy.inventory[0]];
    },
    (copy: AccountSave) => {
      copy.accounts[0].characters.push(copy.accounts[0].characters[0]);
    },
    (copy: AccountSave) => {
      copy.accounts[0].stash = [{ ...legacy.inventory[0], attack: -1 }];
    },
  ]) {
    const invalid = structuredClone(data);
    alter(invalid);
    assert.throws(() => validateAccountSave(invalid));
  }
});

test('six character limit is per account and progress, materials, and backpacks remain independent', () => {
  reset();
  const firstId = account().activeCharacterId;
  const firstAccount = account().id;
  const save = { ...useGameStore.getState().save, level: 10, gold: 12345 };
  useGameStore.setState({ save });
  for (let index = 1; index < MAX_CHARACTERS; index++)
    useGameStore.getState().createCharacter(`行者${index}`, 'sorcerer');
  assert.equal(account().characters.length, 6);
  assert.equal(useGameStore.getState().save.level, 1);
  assert.equal(useGameStore.getState().save.gold, 1500);
  useGameStore.getState().createCharacter('第七人', 'druid');
  assert.equal(account().characters.length, 6);
  assert.match(useGameStore.getState().notice, /已满/);
  useGameStore.getState().switchCharacter(firstId);
  assert.equal(useGameStore.getState().save.level, 10);
  assert.equal(useGameStore.getState().save.gold, 12345);
  useGameStore.getState().createAccount('第二账号');
  assert.equal(account().characters.length, 1);
  assert.equal(useGameStore.getState().save.level, 1);
  useGameStore.getState().createCharacter('初始行者', 'druid');
  assert.match(useGameStore.getState().notice, /同名/);
  useGameStore.getState().switchAccount(firstAccount);
  assert.equal(account().characters.length, 6);
  assert.equal(useGameStore.getState().save.gold, 12345);
  validateAccountSave(snapshotAccounts(useGameStore.getState()));
});

test('warehouse transfers preserve item identity and gems, bypass salvage, and enforce both capacities', () => {
  reset();
  const item = generateLoot('druid', 31, { setId: 'wild_vines', slot: 'head' });
  item.gem = { id: 'ruby', level: 3 };
  useGameStore.setState({
    save: { ...useGameStore.getState().save, inventory: [item], autoSalvage: true },
  });
  useGameStore.getState().equip(item.id);
  assert.equal(useGameStore.getState().save.equipment.head, undefined);
  useGameStore.getState().depositItem(item.id);
  assert.equal(useGameStore.getState().save.inventory.length, 0);
  assert.deepEqual(account().stash[0], JSON.parse(JSON.stringify(item)));
  assert.ok(
    createCombatConfig(useGameStore.getState().save, account().stash).ownedSetPieces?.includes(
      'wild_vines:head',
    ),
  );
  useGameStore.getState().createCharacter('德鲁伊', 'druid');
  const save = useGameStore.getState().save;
  const filler = generateLoot('druid', 1, { rarity: 'common' });
  useGameStore.setState({
    save: {
      ...save,
      inventory: Array.from({ length: MAX_INVENTORY }, (_, index) => ({
        ...filler,
        id: `full-${index}`,
      })),
    },
  });
  useGameStore.getState().withdrawItem(item.id);
  assert.equal(account().stash.length, 1);
  assert.match(useGameStore.getState().notice, /背包已满/);
  useGameStore.setState({ save: { ...save, inventory: [], autoSalvage: true } });
  useGameStore.getState().withdrawItem(item.id);
  assert.equal(account().stash.length, 0);
  assert.deepEqual(useGameStore.getState().save.inventory[0], JSON.parse(JSON.stringify(item)));
  useGameStore.getState().equip(item.id);
  assert.deepEqual(useGameStore.getState().save.equipment.head, JSON.parse(JSON.stringify(item)));
  useGameStore.getState().unequip('head');
  useGameStore.setState({
    accounts: [
      {
        ...account(),
        stash: Array.from({ length: MAX_STASH }, (_, index) => ({
          ...filler,
          id: `stash-${index}`,
        })),
      },
    ],
  });
  useGameStore.getState().depositItem(item.id);
  assert.equal(account().stash.length, MAX_STASH);
  assert.deepEqual(useGameStore.getState().save.inventory[0], JSON.parse(JSON.stringify(item)));
  assert.match(useGameStore.getState().notice, /仓库已满/);
});

test('accounts cannot access each other’s warehouse and battle/lab sessions cannot transfer or switch', () => {
  reset();
  const firstAccount = account().id;
  const item = generateLoot('ranger', 1, { rarity: 'common' });
  useGameStore.setState({ save: { ...useGameStore.getState().save, inventory: [item] } });
  useGameStore.getState().depositItem(item.id);
  useGameStore.getState().createAccount('访客');
  useGameStore.getState().withdrawItem(item.id);
  assert.equal(useGameStore.getState().save.inventory.length, 0);
  useGameStore.getState().setInCombat(true);
  useGameStore.getState().switchAccount(firstAccount);
  assert.equal(account().name, '访客');
  useGameStore.getState().createCharacter('战中创建', 'druid');
  assert.equal(account().characters.length, 1);
  useGameStore.getState().setInCombat(false);
  useGameStore.getState().switchAccount(firstAccount);
  useGameStore.getState().activateBuild('stormcaller');
  useGameStore.getState().withdrawItem(item.id);
  assert.equal(account().stash.length, 1);
  useGameStore.getState().switchAccount('invalid');
  assert.ok(useGameStore.getState().labBackup);
  const snapshot = snapshotAccounts(useGameStore.getState());
  assert.equal(snapshot.accounts[0].characters[0].save.level, 1);
  assert.deepEqual(snapshot.accounts[0].characters[0].save.equipment, {});
  validateAccountSave(snapshot);
  useGameStore.getState().leaveLab();
});

test('imports validate atomically and legacy import/reset only replace the active character', () => {
  reset();
  const originalCharacter = account().activeCharacterId;
  const item = generateLoot('ranger', 10, { rarity: 'rare' });
  useGameStore.setState({ save: { ...useGameStore.getState().save, inventory: [item] } });
  useGameStore.getState().depositItem(item.id);
  useGameStore.getState().createCharacter('法师', 'sorcerer');
  const imported = newSave('druid');
  imported.gold = 54321;
  useGameStore.getState().importSave(JSON.stringify(imported));
  assert.equal(useGameStore.getState().save.gold, 54321);
  assert.equal(account().characters.length, 2);
  assert.deepEqual(account().stash[0], JSON.parse(JSON.stringify(item)));
  const invalid = snapshotAccounts(useGameStore.getState());
  invalid.accounts[0].characters[0].save.inventory.push(item);
  useGameStore.getState().importSave(JSON.stringify(invalid));
  assert.match(useGameStore.getState().notice, /导入失败/);
  assert.equal(useGameStore.getState().save.gold, 54321);
  const exported = snapshotAccounts(useGameStore.getState());
  reset();
  useGameStore.getState().importSave(JSON.stringify(exported));
  assert.equal(useGameStore.getState().save.gold, 54321);
  assert.deepEqual(account().stash[0], JSON.parse(JSON.stringify(item)));
  useGameStore.getState().resetProgress();
  assert.equal(useGameStore.getState().save.classId, 'druid');
  assert.equal(useGameStore.getState().save.gold, 1500);
  assert.deepEqual(account().stash[0], JSON.parse(JSON.stringify(item)));
  useGameStore.getState().switchCharacter(originalCharacter);
  assert.equal(useGameStore.getState().save.classId, 'ranger');
});

test('a pending save drains rapid account and character changes into the latest durable snapshot', async () => {
  reset();
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const writes: AccountSave[] = [];
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { setItem: (_key: string, value: string) => writes.push(JSON.parse(value)) },
  });
  try {
    useGameStore.setState({ ready: true });
    // Node has no IndexedDB, exercising the existing fallback after the async rejection.
    const pending = useGameStore.getState().persist();
    useGameStore.getState().createAccount('连续切换');
    useGameStore.getState().createCharacter('新的德鲁伊', 'druid');
    await pending;
    const saved = validateAccountSave(writes.at(-1));
    const selected = saved.accounts.find((entry) => entry.id === saved.activeAccountId)!;
    assert.equal(saved.accounts.length, 2);
    assert.equal(selected.characters.length, 2);
    assert.equal(
      selected.characters.find((entry) => entry.id === selected.activeCharacterId)!.save.classId,
      'druid',
    );
    assert.equal(writes.length, 2);
  } finally {
    useGameStore.setState({ ready: false });
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
