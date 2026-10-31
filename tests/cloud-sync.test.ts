import assert from 'node:assert/strict';
import test from 'node:test';
import { newAccountSave, snapshotAccounts, useGameStore } from '../src/state/gameStore';
import { useCloudStore } from '../src/state/cloudStore';

const local = new Map<string, string>();
const disk = new Map<string, unknown>();
let localFull = false;
let offline = false;
let expire = false;
let failSaveGet = false;
const browserEvents = new Map<string, () => void>();
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    addEventListener: (name: string, callback: () => void) => browserEvents.set(name, callback),
  },
});
let user: { id: string; username: string } | null = null;
let remote: any = { account: null, revision: 0, updatedAt: null };
let puts = 0;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (localFull) throw new Error('full');
      local.set(key, value);
    },
  },
});
Object.defineProperty(globalThis, 'indexedDB', {
  configurable: true,
  value: {
    open: () => {
      const request: any = {};
      queueMicrotask(() => {
        request.result = {
          transaction: () => {
            const transaction: any = {
              objectStore: () => ({
                get: (key: string) => {
                  const read: any = {};
                  queueMicrotask(() => {
                    read.result = clone(disk.get(key) ?? null);
                    read.onsuccess?.();
                  });
                  return read;
                },
                put: (value: unknown, key: string) => {
                  disk.set(key, clone(value));
                  queueMicrotask(() => transaction.oncomplete?.());
                },
              }),
            };
            return transaction;
          },
        };
        request.onsuccess?.();
      });
      return request;
    },
  },
});
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  value: async (path: string, options: RequestInit) => {
    if (offline) throw new Error('network unavailable');
    if (failSaveGet && path === '/api/save' && options.method === 'GET')
      throw new Error('cloud read interrupted');
    const method = options.method ?? 'GET';
    const body = options.body ? JSON.parse(options.body as string) : undefined;
    assert.equal(options.credentials, 'same-origin');
    assert.equal(
      (options.headers as Record<string, string>)['Content-Type'],
      options.body === undefined ? undefined : 'application/json',
      'Requests without a body must not advertise an empty JSON document',
    );
    if (method !== 'GET') assert.equal((options.headers as any)['x-csrf-token'], 'csrf-test');
    let status = 200;
    let result: unknown;
    if (path === '/api/session') result = { user, csrfToken: 'csrf-test' };
    else if (path === '/api/auth/login' || path === '/api/auth/register') {
      user = { id: 'server-alice', username: body.username };
      result = { user, csrfToken: 'csrf-test' };
    } else if (path === '/api/auth/logout') {
      user = null;
      result = { user, csrfToken: 'csrf-test' };
    } else if (!user || expire) {
      status = 401;
      result = { error: 'session expired', code: 'UNAUTHORIZED' };
    } else if (path === '/api/save' && method === 'GET') result = remote;
    else if (path === '/api/save' && method === 'PUT') {
      puts++;
      if (body.revision !== remote.revision) {
        status = 409;
        result = { error: 'changed elsewhere', code: 'SAVE_CONFLICT', revision: remote.revision };
      } else {
        remote = {
          account: clone(body.account),
          revision: remote.revision + 1,
          updatedAt: Date.now(),
        };
        result = remote;
      }
    } else throw new Error(`unexpected request ${method} ${path}`);
    return new Response(JSON.stringify(result), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  },
});

function resetGuest() {
  const data = newAccountSave();
  useGameStore.setState({
    accounts: data.accounts,
    activeAccountId: data.activeAccountId,
    save: data.accounts[0].characters[0].save,
    cloudUserId: null,
    cloudTransition: false,
    ready: true,
    inCombat: false,
    labBackup: null,
  });
  return clone(data);
}

test('cloud lifecycle preserves isolated local progress, revision conflicts and storage fallback', async () => {
  const guest = resetGuest();
  const cloud = () => useCloudStore.getState();
  const game = () => useGameStore.getState();
  await cloud().initialize();
  assert.ok(browserEvents.has('online'), 'first-time guests also need reconnect handling');
  await cloud().authenticate('register', 'alice', 'test-password-123');
  assert.equal(cloud().status, 'choosing');
  assert.equal(
    game().activeAccountId,
    guest.activeAccountId,
    'login must not replace or upload a guest save',
  );
  assert.equal(puts, 0);
  await cloud().choose('migrate');
  assert.equal(game().cloudUserId, 'server-alice');
  assert.equal(game().accounts.length, 1);
  await cloud().sync();
  assert.equal(remote.revision, 1);
  assert.equal(cloud().dirty, false);

  game().createAccount('cannot-escape-cloud');
  game().switchAccount(guest.activeAccountId);
  game().importSave(JSON.stringify(guest));
  assert.equal(
    game().activeAccountId,
    'server-alice',
    'state actions must enforce cloud ownership',
  );
  assert.equal(game().accounts.length, 1);
  const beforeLab = puts;
  game().activateBuild('tal_rasha');
  await cloud().sync();
  assert.equal(puts, beforeLab, 'lab progress must never upload');
  assert.equal(snapshotAccounts(game()).accounts[0].characters[0].save.level, 1);
  game().leaveLab();
  for (let i = 0; i < 7; i++) game().createCharacter(`角色${i}`, 'druid');
  assert.equal(game().accounts[0].characters.length, 6);
  game().setInCombat(true);
  await cloud().choose('download');
  assert.match(cloud().error, /结束远征/);
  assert.equal(game().accounts[0].characters.length, 6);
  game().setInCombat(false);
  await cloud().logout();
  assert.equal(game().activeAccountId, guest.activeAccountId);
  assert.equal(game().accounts[0].characters.length, 1);

  await cloud().authenticate('login', 'alice', 'test-password-123');
  assert.equal(cloud().hasLocalCopy, true);
  await cloud().choose('resume');
  assert.equal(game().accounts[0].characters.length, 6);
  assert.equal(cloud().dirty, true);
  remote.revision++;
  remote.account.characters[0].save.gold += 800;
  await cloud().sync();
  assert.equal(cloud().status, 'conflict');
  const attempts = puts;
  await cloud().sync();
  assert.equal(puts, attempts, 'a conflict must pause automatic uploads');
  await cloud().overwriteCloud();
  assert.equal(cloud().status, 'online');
  assert.equal(cloud().dirty, false);
  assert.equal(remote.account.characters.length, 6);
  const replacement = JSON.parse(local.get('mist-continent-cloud-replacement-backup')!).value;
  assert.equal(
    replacement.remote.account.characters[0].save.gold,
    guest.accounts[0].characters[0].save.gold + 800,
  );

  // Keep an older localStorage envelope while only IndexedDB accepts the new dirty snapshot.
  localFull = true;
  game().updateSettings({ volume: 0.62 });
  await game().persist();
  assert.equal(cloud().dirty, true);
  await cloud().logout();
  localFull = false;
  await cloud().authenticate('login', 'alice', 'test-password-123');
  await cloud().choose('resume');
  assert.equal(game().save.volume, 0.62, 'newer IndexedDB cache must win over stale localStorage');
  assert.equal(cloud().dirty, true);
  expire = true;
  await cloud().sync();
  assert.equal(cloud().status, 'expired');
  assert.equal(cloud().dirty, true);
  assert.equal(game().save.volume, 0.62);
  await cloud().authenticate('login', 'someone_else', 'test-password-123');
  assert.equal(game().cloudUserId, 'server-alice');
  assert.match(cloud().error, /退出当前云账号/);
  expire = false;
  await cloud().authenticate('login', 'alice', 'test-password-123');
  await cloud().sync();
  assert.equal(cloud().dirty, false);
  assert.equal(
    remote.account.characters.find(
      (character: any) => character.id === remote.account.activeCharacterId,
    ).save.volume,
    0.62,
  );

  offline = true;
  game().updateSettings({ volume: 0.27 });
  await cloud().sync();
  assert.equal(cloud().status, 'offline');
  assert.equal(cloud().dirty, true);
  offline = false;
  await cloud().sync();
  assert.equal(cloud().dirty, false);
  remote.revision++;
  remote.account.characters.find(
    (character: any) => character.id === remote.account.activeCharacterId,
  ).save.volume = 0.43;
  await cloud().sync();
  assert.equal(
    cloud().status,
    'choosing',
    'a clean local save must still detect another device revision',
  );
  assert.equal(
    game().save.volume,
    0.27,
    'checking remote progress must not silently replace local progress',
  );
  await cloud().choose('download');
  assert.equal(game().save.volume, 0.43);
  await cloud().logout();
  assert.equal(game().cloudUserId, null);
  failSaveGet = true;
  await cloud().authenticate('login', 'alice', 'test-password-123');
  assert.equal(cloud().status, 'guest');
  assert.equal(
    cloud().user,
    null,
    'a successful login followed by a failed read must offer a retry',
  );
  failSaveGet = false;
  await cloud().authenticate('login', 'alice', 'test-password-123');
  assert.equal(cloud().status, 'choosing');
  await cloud().logout();
});
