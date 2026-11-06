import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../server/app';
import { recordVerifiedRun } from '../server/verifiedRuns';
import { officialTrialConfig } from '../server/trials';
import { newAccountSave } from '../src/state/saveData';

const origin = 'http://localhost:5173';
const password = 'long-original-password-42';

test('official trial loadouts have reproducible stats and affixes without changing the ambient RNG', () => {
  const original = Math.random;
  const first = officialTrialConfig('stormcaller');
  const second = officialTrialConfig('stormcaller');
  assert.equal(Math.random, original);
  assert.deepEqual(first.stats, second.stats);
  assert.deepEqual(first.skills, second.skills);
  const identityFree = (value: unknown) =>
    JSON.parse(JSON.stringify(value, (key, entry) => (key === 'id' ? undefined : entry)));
  assert.deepEqual(identityFree(first.equipment), identityFree(second.equipment));
});
async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), 'wuyin-release-test-'));
  const dbPath = join(directory, 'test.sqlite');
  let app = await createApp({ dbPath, origins: [origin] });
  const browser = () => {
    const cookies: Record<string, string> = {};
    let csrf = '';
    return {
      async request(method: 'GET' | 'POST' | 'PUT', path: string, payload?: unknown) {
        const response = await app.inject({
          method,
          url: `/api${path}`,
          cookies,
          headers: { origin, 'x-csrf-token': csrf },
          ...(payload === undefined ? {} : { payload }),
        });
        for (const cookie of response.cookies) {
          if (cookie.maxAge === 0) delete cookies[cookie.name];
          else cookies[cookie.name] = cookie.value;
        }
        const data = response.json();
        if (data.csrfToken) csrf = data.csrfToken;
        return response;
      },
    };
  };
  t.after(async () => {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  });
  return {
    dbPath,
    browser,
    async restart() {
      await app.close();
      app = await createApp({ dbPath, origins: [origin] });
    },
  };
}

test('account recovery rotates codes and sessions; password change, revocation and deletion preserve authentication boundaries', async (t) => {
  const f = await fixture(t);
  const owner = f.browser();
  const other = f.browser();
  await owner.request('GET', '/session');
  const registered = await owner.request('POST', '/auth/register', {
    username: 'recovery_user',
    password,
  });
  assert.equal(registered.statusCode, 201, registered.body);
  const recoveryCode = registered.json().recoveryCode;
  assert.match(recoveryCode, /^[a-f0-9]{8}(-[a-f0-9]{8}){5}$/);
  await other.request('GET', '/session');
  await other.request('POST', '/auth/login', { username: 'recovery_user', password });
  const revoked = await owner.request('POST', '/auth/sessions/revoke', { password });
  assert.equal(revoked.json().revoked, 1);
  assert.equal((await other.request('GET', '/save')).statusCode, 401);
  await other.request('POST', '/auth/login', { username: 'recovery_user', password });
  assert.equal(
    (
      await owner.request('POST', '/auth/password', {
        currentPassword: password,
        newPassword: 'new-password-change-44',
      })
    ).statusCode,
    200,
  );
  assert.equal((await other.request('GET', '/save')).statusCode, 401);
  const recovered = await other.request('POST', '/auth/recover', {
    username: 'recovery_user',
    recoveryCode,
    newPassword: 'recovered-new-password-45',
  });
  assert.equal(recovered.statusCode, 200, recovered.body);
  assert.notEqual(recovered.json().recoveryCode, recoveryCode);
  assert.equal((await owner.request('GET', '/save')).statusCode, 401);
  assert.equal(
    (
      await owner.request('POST', '/auth/recover', {
        username: 'recovery_user',
        recoveryCode,
        newPassword: password,
      })
    ).statusCode,
    401,
  );
  const db = new DatabaseSync(f.dbPath);
  assert.ok(
    !JSON.stringify(db.prepare('SELECT * FROM account_recovery').all()).includes(
      recovered.json().recoveryCode,
    ),
  );
  db.close();
  assert.equal(
    (
      await other.request('POST', '/auth/delete', {
        password: 'recovered-new-password-45',
        confirmation: 'wrong-name',
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await other.request('POST', '/auth/delete', {
        password: 'recovered-new-password-45',
        confirmation: 'recovery_user',
      })
    ).statusCode,
    200,
  );
  assert.equal((await other.request('GET', '/save')).statusCode, 401);
});

test('durable reward claims survive restarts, enforce ownership and revisions, and never enter the verified board from cloud imports', async (t) => {
  const f = await fixture(t);
  const owner = f.browser();
  await owner.request('GET', '/session');
  const registration = await owner.request('POST', '/auth/register', {
    username: 'reward_user',
    password,
  });
  const user = registration.json().user;
  const account = newAccountSave().accounts[0];
  account.id = user.id;
  const characterId = account.activeCharacterId;
  assert.equal((await owner.request('PUT', '/save', { account, revision: 0 })).statusCode, 200);
  const result = {
    won: true,
    partySize: 2,
    stage: 1,
    seconds: 30,
    kills: 10,
    gold: 100,
    shards: 5,
    items: [],
  };
  let db = new DatabaseSync(f.dbPath);
  db.prepare(
    'INSERT INTO coop_results(run_id,user_id,character_id,result_json,created_at) VALUES (?,?,?,?,?)',
  ).run('durable-run', user.id, characterId, JSON.stringify(result), Date.now());
  db.close();
  await f.restart();
  assert.equal((await owner.request('GET', '/coop/results')).json().rewards.length, 1);
  assert.equal(
    (await owner.request('POST', '/coop/claim', { runId: 'durable-run', revision: 0 })).statusCode,
    409,
  );
  const claimed = await owner.request('POST', '/coop/claim', { runId: 'durable-run', revision: 1 });
  assert.equal(claimed.statusCode, 200, claimed.body);
  assert.equal(
    claimed.json().account.characters[0].save.gold,
    account.characters[0].save.gold + 100,
  );
  assert.equal(claimed.json().account.characters[0].save.clears, 1);
  assert.equal(claimed.json().revision, 2);
  assert.equal((await owner.request('PUT', '/save', { account, revision: 1 })).statusCode, 409);
  await f.restart();
  const repeated = await owner.request('POST', '/coop/claim', {
    runId: 'durable-run',
    revision: 2,
  });
  assert.equal(repeated.json().alreadyClaimed, true);
  assert.equal(repeated.json().revision, 2);
  assert.equal(repeated.json().account.characters[0].save.clears, 1);
  assert.deepEqual((await owner.request('GET', '/coop/results')).json().rewards, []);
  const other = f.browser();
  await other.request('GET', '/session');
  await other.request('POST', '/auth/register', { username: 'reward_other', password });
  assert.equal(
    (await other.request('POST', '/coop/claim', { runId: 'durable-run', revision: 0 })).statusCode,
    404,
  );
  assert.equal(
    (await owner.request('GET', '/leaderboard/verified?classId=ranger')).json().total,
    0,
  );
  db = new DatabaseSync(f.dbPath);
  recordVerifiedRun(db, {
    runId: 'official-run',
    userId: user.id,
    characterId,
    name: '试炼者',
    classId: 'ranger',
    level: 100,
    stage: 150,
    seconds: 25,
    kills: 60,
    setName: '风暴召唤者',
  });
  db.close();
  const board = await owner.request('GET', '/leaderboard/verified?classId=ranger');
  assert.equal(board.json().source, 'verified');
  assert.equal(board.json().entries[0].name, '试炼者');
  assert.ok(!board.body.includes(user.id));
  const trial = await owner.request('POST', '/trials/start', { setId: 'stormcaller' });
  assert.equal(trial.statusCode, 201, trial.body);
  assert.equal(trial.json().room.hostId, 'server');
  assert.equal(
    (await owner.request('POST', '/trials/exchange', { snapshot: { results: { forged: result } } }))
      .statusCode,
    400,
  );
  assert.equal((await owner.request('POST', '/trials/leave', {})).statusCode, 200);
});
