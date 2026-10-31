import test from 'node:test';
import assert from 'node:assert/strict';
import { coopBalance } from '../src/data/coopBalance';
import { newAccountSave, useGameStore } from '../src/state/gameStore';

test('cooperative scaling keeps damage gradual and rewards per player unchanged', () => {
  const rows = [1, 2, 3, 4].map(coopBalance);
  assert.deepEqual(
    rows.map((row) => Number(row.monsterHp.toFixed(2))),
    [1, 1.7, 2.4, 3.1],
  );
  assert.deepEqual(
    rows.map((row) => Number(row.bossHp.toFixed(2))),
    [1, 1.9, 2.8, 3.7],
  );
  assert.deepEqual(
    rows.map((row) => row.monsterDamage),
    [1, 1.08, 1.16, 1.24],
  );
  assert.ok(rows.every((row) => row.timeLimit === 300 && row.rewardMultiplier === 1));
  assert.equal(coopBalance(0).players, 1);
  assert.equal(coopBalance(9).players, 4);
});

test('cooperative clears grant personal progression without entering the solo leaderboard', () => {
  const data = newAccountSave();
  const save = data.accounts[0].characters[0].save;
  useGameStore.setState({
    save,
    accounts: data.accounts,
    activeAccountId: data.activeAccountId,
    inCombat: true,
    labBackup: null,
    cloudTransition: false,
  });
  const result = { won: true, stage: 1, seconds: 120, kills: 10, gold: 60, shards: 5, items: [] };
  useGameStore.getState().completeRun({ ...result, partySize: 4 });
  const cooperative = useGameStore.getState().save;
  assert.equal(cooperative.clears, save.clears + 1);
  assert.equal(cooperative.kills, save.kills + 10);
  assert.equal(cooperative.gold, save.gold + 60);
  assert.equal(cooperative.runRecords?.length ?? 0, 0);
  useGameStore.getState().completeRun(result);
  assert.equal(useGameStore.getState().save.runRecords?.length, 1);
});
