import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { createApp, type AppOptions } from '../server/app';
import { newAccountSave, newSave } from '../src/state/saveData';
import { generateLoot } from '../src/engine/LootGenerator';
import type { RunRecord, SaveData } from '../src/core/types';

const origin = 'http://localhost:5173';
const password = 'a-valid-test-password-42';
async function fixture(t: TestContext, options: AppOptions = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'wuyin-server-'));
  const dbPath = join(directory, 'test.sqlite');
  let app = await createApp({ dbPath, origins: [origin], ...options });
  t.after(async () => {
    await app.close();
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    await rm(directory, { recursive: true, force: true });
  });
  return {
    get app() {
      return app;
    },
    dbPath,
    async restart() {
      await app.close();
      app = await createApp({ dbPath, origins: [origin], ...options });
      return app;
    },
  };
}
function client(getApp: () => FastifyInstance) {
  const cookies: Record<string, string> = {};
  let csrfToken = '';
  const headers = () => ({ origin, 'x-csrf-token': csrfToken });
  return {
    cookies,
    headers,
    async request(method: 'GET' | 'POST' | 'PUT', url: string, payload?: unknown) {
      const response = await getApp().inject({
        method,
        url,
        cookies,
        headers: headers(),
        ...(payload !== undefined
          ? {
              payload: JSON.stringify(payload),
              headers: { ...headers(), 'content-type': 'application/json' },
            }
          : {}),
      });
      for (const cookie of response.cookies) {
        if (cookie.maxAge === 0) delete cookies[cookie.name];
        else cookies[cookie.name] = cookie.value;
      }
      const data = response.json();
      if (data.csrfToken) csrfToken = data.csrfToken;
      return response;
    },
  };
}
async function register(browser: ReturnType<typeof client>, username = 'test_user') {
  assert.equal((await browser.request('GET', '/api/session')).statusCode, 200);
  const response = await browser.request('POST', '/api/auth/register', { username, password });
  assert.equal(response.statusCode, 201, response.body);
  return response.json().user as { id: string; username: string };
}

test('credentials, CSRF, origin checks and logout protect sessions without storing plain secrets', async (t) => {
  const f = await fixture(t);
  const browser = client(() => f.app);
  assert.equal((await browser.request('GET', '/api/save')).statusCode, 401);
  const user = await register(browser);
  const session = await browser.request('GET', '/api/session');
  assert.deepEqual(session.json().user, user);
  const missingCsrf = await f.app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    cookies: browser.cookies,
    headers: { origin },
  });
  assert.equal(missingCsrf.statusCode, 403);
  assert.equal(missingCsrf.json().code, 'CSRF_INVALID');
  const foreign = await f.app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    cookies: browser.cookies,
    headers: { ...browser.headers(), origin: 'https://untrusted.example' },
  });
  assert.equal(foreign.statusCode, 403);
  assert.equal(foreign.json().code, 'ORIGIN_REJECTED');
  const wrong = await browser.request('POST', '/api/auth/login', {
    username: 'test_user',
    password: 'wrong-password-is-long',
  });
  const missing = await browser.request('POST', '/api/auth/login', {
    username: 'missing_user',
    password,
  });
  assert.equal(wrong.statusCode, 401);
  assert.deepEqual(wrong.json(), missing.json());
  assert.equal(
    (await browser.request('POST', '/api/auth/register', { username: 'TEST_USER', password }))
      .statusCode,
    409,
  );
  const inspection = new DatabaseSync(f.dbPath);
  try {
    const row = inspection.prepare('SELECT password_hash, password_salt FROM users').get()!;
    assert.match(String(row.password_hash), /^[a-f0-9]{128}$/);
    assert.match(String(row.password_salt), /^[a-f0-9]{32}$/);
    assert.ok(!JSON.stringify(row).includes(password));
    const token = browser.cookies['wuyin-session'];
    assert.notEqual(inspection.prepare('SELECT token_hash FROM sessions').get()!.token_hash, token);
  } finally {
    inspection.close();
  }
  const priorCookies = { ...browser.cookies };
  assert.equal((await browser.request('POST', '/api/auth/logout')).statusCode, 200);
  assert.equal(
    (await f.app.inject({ method: 'GET', url: '/api/save', cookies: priorCookies })).statusCode,
    401,
  );
});

test('server save validation enforces six roles, capacities, item integrity, and account ownership', async (t) => {
  const f = await fixture(t);
  const browser = client(() => f.app);
  const user = await register(browser);
  assert.deepEqual((await browser.request('GET', '/api/save')).json(), {
    account: null,
    revision: 0,
    updatedAt: null,
  });
  const account = newAccountSave().accounts[0];
  for (let index = 1; index < 6; index++)
    account.characters.push({
      id: `character-${index}`,
      name: `角色${index}`,
      save: newSave('druid'),
    });
  account.id = user.id;
  account.name = 'forged-name';
  const saved = await browser.request('PUT', '/api/save', { account, revision: 0 });
  assert.equal(saved.statusCode, 200, saved.body);
  assert.equal(saved.json().account.id, user.id);
  assert.equal(saved.json().account.name, user.username);
  assert.equal(saved.json().revision, 1);
  const item = generateLoot('ranger', 1, { rarity: 'common' });
  const invalid = [
    {
      ...account,
      characters: [...account.characters, { id: 'seventh', name: '第七角色', save: newSave() }],
    },
    {
      ...account,
      stash: Array.from({ length: 481 }, (_, index) => ({ ...item, id: `stash-${index}` })),
    },
    { ...account, stash: [item, item] },
    { ...account, stash: [{ ...item, attack: -1 }] },
  ];
  const fullBackpack = structuredClone(account);
  fullBackpack.characters[0].save.inventory = Array.from({ length: 241 }, (_, index) => ({
    ...item,
    id: `pack-${index}`,
  }));
  invalid.push(fullBackpack);
  for (const value of invalid) {
    const rejected = await browser.request('PUT', '/api/save', { account: value, revision: 1 });
    assert.equal(rejected.statusCode, 400);
    assert.equal(rejected.json().code, 'INVALID_SAVE');
  }
  assert.equal((await browser.request('GET', '/api/save')).json().revision, 1);
  const other = client(() => f.app);
  await register(other, 'another_user');
  assert.equal((await other.request('GET', '/api/save')).json().account, null);
  // A different tab may replace the shared session cookie. Even with B's valid CSRF
  // token, a stale A payload must never become B's save.
  const mismatched = await other.request('PUT', '/api/save', {
    account: saved.json().account,
    revision: 0,
  });
  assert.equal(mismatched.statusCode, 401);
  assert.equal(mismatched.json().code, 'ACCOUNT_MISMATCH');
  assert.deepEqual((await other.request('GET', '/api/save')).json(), {
    account: null,
    revision: 0,
    updatedAt: null,
  });
  assert.deepEqual((await browser.request('GET', '/api/save')).json(), saved.json());
});

test('atomic revision compare-and-swap rejects simultaneous stale writers instead of overwriting', async (t) => {
  const f = await fixture(t);
  const browser = client(() => f.app);
  const user = await register(browser);
  const account = newAccountSave().accounts[0];
  account.id = user.id;
  const results = await Promise.all([
    browser.request('PUT', '/api/save', { account, revision: 0 }),
    browser.request('PUT', '/api/save', { account, revision: 0 }),
  ]);
  assert.deepEqual(results.map((response) => response.statusCode).sort(), [200, 409]);
  assert.equal(
    results.find((response) => response.statusCode === 409)!.json().code,
    'SAVE_CONFLICT',
  );
  assert.equal((await browser.request('GET', '/api/save')).json().revision, 1);
  assert.equal(
    (await browser.request('PUT', '/api/save', { account, revision: 0 })).statusCode,
    409,
  );
  const next = await browser.request('PUT', '/api/save', { account, revision: 1 });
  assert.equal(next.statusCode, 200);
  assert.equal(next.json().revision, 2);
});

test('cloud progress, sessions and signed CSRF cookies survive restart and login never replaces saves', async (t) => {
  const f = await fixture(t);
  const browser = client(() => f.app);
  const user = await register(browser);
  const account = newAccountSave().accounts[0];
  account.id = user.id;
  account.characters[0].save.gold = 98765;
  await browser.request('PUT', '/api/save', { account, revision: 0 });
  const csrfBefore = browser.headers()['x-csrf-token'];
  await f.restart();
  const persisted = await browser.request('GET', '/api/save');
  assert.equal(persisted.statusCode, 200);
  assert.equal(persisted.json().account.characters[0].save.gold, 98765);
  const afterRestart = await f.app.inject({
    method: 'PUT',
    url: '/api/save',
    cookies: browser.cookies,
    headers: { origin, 'x-csrf-token': csrfBefore },
    payload: { account, revision: 1 },
  });
  assert.equal(afterRestart.statusCode, 200, afterRestart.body);
  const secondDevice = client(() => f.app);
  await secondDevice.request('GET', '/api/session');
  const login = await secondDevice.request('POST', '/api/auth/login', {
    username: 'TEST_USER',
    password,
  });
  assert.equal(login.statusCode, 200);
  assert.deepEqual(login.json().user, user);
  assert.deepEqual((await secondDevice.request('GET', '/api/save')).json(), afterRestart.json());
  await browser.request('POST', '/api/auth/logout');
  assert.equal((await secondDevice.request('GET', '/api/save')).statusCode, 200);
});

test('production cookies have secure flags and expired sessions cannot access cloud saves', async (t) => {
  const f = await fixture(t, { secureCookies: true });
  const browser = client(() => f.app);
  const session = await browser.request('GET', '/api/session');
  const csrfCookie = session.cookies.find((entry) => entry.name === '__Host-wuyin-csrf')!;
  assert.ok(csrfCookie.secure && csrfCookie.httpOnly);
  assert.equal(csrfCookie.sameSite, 'Strict');
  const registration = await browser.request('POST', '/api/auth/register', {
    username: 'secure_user',
    password,
  });
  assert.equal(registration.statusCode, 201, registration.body);
  const authCookie = registration.cookies.find((entry) => entry.name === '__Host-wuyin-session')!;
  assert.ok(authCookie.secure && authCookie.httpOnly);
  assert.equal(authCookie.path, '/');
  const inspection = new DatabaseSync(f.dbPath);
  inspection.prepare('UPDATE sessions SET expires_at = ?').run(Date.now() - 1);
  inspection.close();
  assert.equal((await browser.request('GET', '/api/save')).statusCode, 401);
  assert.equal((await browser.request('GET', '/api/session')).json().user, null);
});

test('login rate and request body limits are enforced before expensive authentication', async (t) => {
  const f = await fixture(t);
  const browser = client(() => f.app);
  await browser.request('GET', '/api/session');
  const tooLarge = await browser.request('POST', '/api/auth/register', {
    username: 'limited_user',
    password: 'x'.repeat(5000),
  });
  assert.equal(tooLarge.statusCode, 413);
  for (let index = 0; index < 10; index++)
    assert.equal(
      (await browser.request('POST', '/api/auth/login', { username: 'x', password: 'short' }))
        .statusCode,
      400,
    );
  const blocked = await browser.request('POST', '/api/auth/login', {
    username: 'x',
    password: 'short',
  });
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.json().code, 'RATE_LIMITED');
  assert.ok(blocked.headers['retry-after']);
});

test('online lobby derives public profiles from cloud saves and removes logged-out or expired presences', async (t) => {
  const f = await fixture(t);
  const first = client(() => f.app);
  const second = client(() => f.app);
  const guest = client(() => f.app);
  await guest.request('GET', '/api/session');
  assert.equal(
    (await guest.request('POST', '/api/lobby/heartbeat', { x: 0.5, y: 0.5 })).statusCode,
    401,
  );
  const firstUser = await register(first, 'lobby_first');
  assert.equal(
    (await first.request('POST', '/api/lobby/heartbeat', { x: 0.5, y: 0.5 })).statusCode,
    409,
  );
  const secondUser = await register(second, 'lobby_second');
  for (const [browser, user, classId, name] of [
    [first, firstUser, 'ranger', '弓手甲'],
    [second, secondUser, 'druid', '狼行者乙'],
  ] as const) {
    const account = newAccountSave().accounts[0];
    account.id = user.id;
    account.characters[0].name = name;
    account.characters[0].save = newSave(classId);
    account.characters[0].save.equipment.weapon = generateLoot(classId, 1, {
      rarity: 'common',
      slot: 'weapon',
    });
    assert.equal(
      (await browser.request('PUT', '/api/save', { account, revision: 0 })).statusCode,
      200,
    );
    assert.equal(
      (await browser.request('POST', '/api/lobby/heartbeat', { x: 0.4, y: 0.6, activity: 'forge' }))
        .statusCode,
      200,
    );
  }
  assert.equal(
    (await first.request('POST', '/api/lobby/heartbeat', { x: 2, y: 0.5 })).statusCode,
    400,
  );
  assert.equal(
    (await first.request('POST', '/api/lobby/heartbeat', { x: 0.5, y: 0.5, name: '伪造身份' }))
      .statusCode,
    400,
  );
  assert.equal(
    (await first.request('POST', '/api/lobby/heartbeat', { x: 0.5, y: 0.5, activity: 'unknown' }))
      .statusCode,
    400,
  );
  const publicLobby = await guest.request('GET', '/api/lobby');
  assert.equal(publicLobby.json().onlineCount, 2);
  assert.deepEqual(
    publicLobby
      .json()
      .players.map((entry: { name: string }) => entry.name)
      .sort(),
    ['弓手甲', '狼行者乙'],
  );
  assert.ok(
    publicLobby
      .json()
      .players.every(
        (entry: { isSelf: boolean; id: string }) => !entry.isSelf && entry.id.length === 20,
      ),
  );
  for (const secret of [
    firstUser.id,
    secondUser.id,
    firstUser.username,
    secondUser.username,
    'password',
    'account_json',
  ])
    assert.ok(!publicLobby.body.includes(secret));
  assert.equal(
    (await first.request('GET', '/api/lobby'))
      .json()
      .players.filter((entry: { isSelf: boolean }) => entry.isSelf).length,
    1,
  );
  // Distinct authenticated players behind the same NAT keep separate heartbeat budgets.
  for (let pulse = 0; pulse < 20; pulse++)
    for (const browser of [first, second])
      assert.equal(
        (await browser.request('POST', '/api/lobby/heartbeat', { x: 0.4, y: 0.6 })).statusCode,
        200,
      );
  assert.equal((await first.request('POST', '/api/lobby/leave')).statusCode, 200);
  assert.equal((await guest.request('GET', '/api/lobby')).json().onlineCount, 1);
  await second.request('POST', '/api/auth/logout');
  assert.equal((await guest.request('GET', '/api/lobby')).json().onlineCount, 0);
  await first.request('POST', '/api/lobby/heartbeat', { x: 0.3, y: 0.7 });
  const inspection = new DatabaseSync(f.dbPath);
  inspection.prepare('UPDATE lobby_presence SET updated_at = ?').run(Date.now() - 45001);
  inspection.close();
  assert.equal((await guest.request('GET', '/api/lobby')).json().onlineCount, 0);
});

function publicRun(save: SaveData, id: string, stage: number, seconds: number): RunRecord {
  const { classId, level, equipment, cube, skills, autoSkills, petId, petLevels, forge } = save;
  return {
    id,
    stage,
    seconds,
    kills: 50,
    date: 1700000000000,
    build: { classId, level, equipment, cube, skills, autoSkills, petId, petLevels, forge },
  };
}

test('public profession boards rank the best cloud record per account and omit private identities', async (t) => {
  const f = await fixture(t);
  const first = client(() => f.app);
  const second = client(() => f.app);
  const firstUser = await register(first, 'rank_first');
  const secondUser = await register(second, 'rank_second');
  const account = newAccountSave().accounts[0];
  account.id = firstUser.id;
  const basic = newSave();
  basic.level = 100;
  basic.runRecords = [
    publicRun(basic, 'old-ranger', 40, 20),
    publicRun(basic, 'invalid-zero', 150, 0),
  ];
  account.characters[0].name = '初代弓手';
  account.characters[0].save = basic;
  const better = newSave();
  better.level = 100;
  for (const slot of ['head', 'chest', 'hands', 'legs'] as const)
    better.equipment[slot] = generateLoot('ranger', 50, { slot, setId: 'stormcaller' });
  better.runRecords = [publicRun(better, 'best-ranger', 50, 40)];
  account.characters.push({ id: 'second-ranger', name: '成型弓手', save: better });
  const wolf = newSave('druid');
  wolf.runRecords = [publicRun(wolf, 'wolf-run', 60, 50)];
  account.characters.push({ id: 'wolf-character', name: '风暴之狼', save: wolf });
  assert.equal((await first.request('PUT', '/api/save', { account, revision: 0 })).statusCode, 200);
  const other = newAccountSave().accounts[0];
  other.id = secondUser.id;
  other.characters[0].name = '疾风弓手';
  other.characters[0].save.runRecords = [
    publicRun(other.characters[0].save, 'fast-ranger', 50, 35),
  ];
  assert.equal(
    (await second.request('PUT', '/api/save', { account: other, revision: 0 })).statusCode,
    200,
  );
  const response = await f.app.inject({ method: 'GET', url: '/api/leaderboard?classId=ranger' });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(response.json().source, 'cloud');
  assert.equal(response.json().total, 2);
  assert.deepEqual(
    response.json().entries.map((entry: { name: string }) => entry.name),
    ['疾风弓手', '成型弓手'],
  );
  assert.deepEqual(
    response.json().entries.map((entry: { rank: number }) => entry.rank),
    [1, 2],
  );
  assert.equal(response.json().entries[1].setName, '风暴召唤者');
  assert.equal(response.json().entries[0].setName, null);
  for (const secret of [
    firstUser.id,
    secondUser.id,
    firstUser.username,
    secondUser.username,
    'equipment',
    'password',
  ])
    assert.ok(!response.body.includes(secret));
  assert.equal(
    (await f.app.inject({ method: 'GET', url: '/api/leaderboard?classId=druid' })).json().entries[0]
      .name,
    '风暴之狼',
  );
  assert.equal(
    (await f.app.inject({ method: 'GET', url: '/api/leaderboard?classId=barbarian' })).json().total,
    0,
  );
  assert.equal(
    (await f.app.inject({ method: 'GET', url: '/api/leaderboard?classId=invalid' })).statusCode,
    400,
  );
  assert.equal((await f.app.inject({ method: 'GET', url: '/api/leaderboard' })).statusCode, 400);
});
