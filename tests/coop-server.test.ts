import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { createApp } from '../server/app';
import type { CoopFrame } from '../src/core/coop';
import type { CoopRoom } from '../src/core/coopRoom';
import { newAccountSave } from '../src/state/saveData';

const origin = 'http://localhost:5173';
function client(app: FastifyInstance) {
  const cookies: Record<string, string> = {};
  let token = '';
  return {
    async request(method: 'GET' | 'POST' | 'PUT', url: string, body?: unknown) {
      const response = await app.inject({
        method,
        url: `/api${url}`,
        cookies,
        headers: {
          origin,
          'x-csrf-token': token,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
      });
      for (const cookie of response.cookies) {
        if (cookie.maxAge === 0) delete cookies[cookie.name];
        else cookies[cookie.name] = cookie.value;
      }
      const data = response.json();
      if (data.csrfToken) token = data.csrfToken;
      return response;
    },
  };
}
async function fixture(t: TestContext, count: number) {
  const app = await createApp({ dbPath: ':memory:', origins: [origin] });
  t.after(() => app.close());
  const clients = [];
  for (let index = 0; index < count; index++) {
    const browser = client(app);
    await browser.request('GET', '/session');
    const registered = await browser.request('POST', '/auth/register', {
      username: `coop_test_${index}`,
      password: 'cooperative-test-password-42',
    });
    assert.equal(registered.statusCode, 201, registered.body);
    const account = newAccountSave().accounts[0];
    account.id = registered.json().user.id;
    const saved = await browser.request('PUT', '/save', { account, revision: 0 });
    assert.equal(saved.statusCode, 200, saved.body);
    clients.push(browser);
  }
  return { app, clients };
}
function frame(room: CoopRoom, number = 1): CoopFrame {
  return {
    sequence: number,
    elapsed: 1,
    progress: 2,
    kills: 0,
    actors: room.members.map((member) => ({
      id: member.id,
      x: 0,
      y: 0,
      facing: 1,
      moving: false,
      downSeconds: 0,
      snapshot: {
        hp: 100,
        maxHp: 100,
        resource: 100,
        maxResource: 100,
        progress: 2,
        seconds: 299,
        kills: 0,
        combo: 0,
        cooldowns: {},
        buffs: [],
        paused: false,
        finished: false,
        pylons: [],
        fps: 60,
      },
    })),
    enemies: [],
    projectiles: [],
    zones: [],
    orbs: [],
    warnings: [],
    pylons: [],
  };
}

test('cooperative rooms enforce four session-bound members, preparation, locked cloud loadouts and host authority', async (t) => {
  const {
    app,
    clients: [host, second, third, fourth, fifth],
  } = await fixture(t, 5);
  assert.equal((await client(app).request('GET', '/coop/room')).statusCode, 401);
  assert.equal((await host.request('POST', '/coop/create', { stage: 2 })).statusCode, 409);
  const created = await host.request('POST', '/coop/create', { stage: 1 });
  assert.equal(created.statusCode, 201, created.body);
  const code = created.json().room.code;
  assert.match(code, /^[A-F0-9]{6}$/);
  assert.equal(created.json().room.members[0].ready, true);
  for (const browser of [second, third, fourth])
    assert.equal((await browser.request('POST', '/coop/join', { code })).statusCode, 200);
  assert.equal((await fifth.request('POST', '/coop/join', { code })).json().code, 'ROOM_FULL');
  assert.equal((await fifth.request('GET', '/coop/room')).json().room, null);
  assert.equal((await second.request('POST', '/coop/start', {})).statusCode, 403);
  assert.equal((await host.request('POST', '/coop/start', {})).json().code, 'NOT_READY');
  for (const browser of [second, third, fourth])
    assert.equal((await browser.request('POST', '/coop/ready', { ready: true })).statusCode, 200);
  const staleSave = (await second.request('GET', '/save')).json();
  staleSave.account.characters[0].save.level = 2;
  assert.equal(
    (
      await second.request('PUT', '/save', {
        account: staleSave.account,
        revision: staleSave.revision,
      })
    ).statusCode,
    200,
  );
  assert.equal((await host.request('POST', '/coop/start', {})).json().code, 'CHARACTER_CHANGED');
  assert.equal((await second.request('POST', '/coop/ready', { ready: true })).statusCode, 200);
  const started = await host.request('POST', '/coop/start', {});
  assert.equal(started.statusCode, 200, started.body);
  const room = started.json().room as CoopRoom;
  assert.equal(room.status, 'playing');
  assert.equal(room.members.length, 4);
  assert.ok(room.members.every((member) => member.config.stage === 1));
  assert.ok(!JSON.stringify(room).includes('userId'));
  assert.ok(!JSON.stringify(room).includes('session'));
  assert.equal((await second.request('POST', '/coop/ready', { ready: false })).statusCode, 409);
  assert.equal((await fifth.request('POST', '/coop/join', { code })).json().code, 'ROOM_STARTED');
  const snapshot = frame(room);
  assert.equal((await second.request('POST', '/coop/exchange', { snapshot })).statusCode, 403);
  const synced = await host.request('POST', '/coop/exchange', { snapshot });
  assert.equal(synced.statusCode, 200, synced.body);
  assert.equal(
    (await second.request('POST', '/coop/exchange', {})).json().room.snapshot.sequence,
    1,
  );
  assert.equal((await third.request('POST', '/coop/leave', {})).statusCode, 200);
  const aborted = await host.request('POST', '/coop/exchange', {});
  assert.equal(aborted.statusCode, 200);
  assert.equal(aborted.json().room.status, 'aborted');
  assert.equal(aborted.json().room.snapshot, undefined);
});

test('inputs are validated and expire; final host results are shared once and remain immutable', async (t) => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const {
    clients: [host, guest],
  } = await fixture(t, 2);
  const room = (await host.request('POST', '/coop/create', { stage: 1 })).json().room as CoopRoom;
  const joined = (await guest.request('POST', '/coop/join', { code: room.code })).json()
    .room as CoopRoom;
  const guestId = joined.selfId;
  await guest.request('POST', '/coop/ready', { ready: true });
  const active = (await host.request('POST', '/coop/start', {})).json().room as CoopRoom;
  const skill = Object.keys(
    joined.members.find((member) => member.id === guestId)!.config.skills,
  )[0];
  assert.equal(
    (
      await guest.request('POST', '/coop/exchange', {
        input: { sequence: 1, movement: { x: 2, y: 0 }, casts: [] },
      })
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await guest.request('POST', '/coop/exchange', {
        input: {
          sequence: 1,
          movement: { x: 1, y: 0 },
          casts: [],
          commands: [{ sequence: 1, id: 'unknown_skill' }],
        },
      })
    ).statusCode,
    400,
  );
  const input = {
    sequence: 2,
    movement: { x: 1, y: 0 },
    casts: [],
    commands: [{ sequence: 1, id: skill }],
  };
  assert.equal((await guest.request('POST', '/coop/exchange', { input })).statusCode, 200);
  assert.equal(
    (await host.request('POST', '/coop/exchange', {})).json().room.inputs[guestId].movement.x,
    1,
  );
  now += 600;
  const neutral = (await host.request('POST', '/coop/exchange', {})).json().room.inputs[guestId];
  assert.deepEqual(neutral.movement, { x: 0, y: 0 });
  assert.equal(neutral.sequence, input.sequence);
  const malformed = frame(active);
  malformed.actors[0].id = 'foreign-player';
  assert.equal(
    (await host.request('POST', '/coop/exchange', { snapshot: malformed })).statusCode,
    400,
  );
  const final = frame(active, 3);
  final.results = Object.fromEntries(
    active.members.map((member) => [
      member.id,
      { partySize: 2, won: true, stage: 1, seconds: 2, kills: 5, gold: 10, shards: 3, items: [] },
    ]),
  );
  const finished = await host.request('POST', '/coop/exchange', { snapshot: final });
  assert.equal(finished.statusCode, 200, finished.body);
  assert.equal(finished.json().room.status, 'finished');
  const received = (await guest.request('POST', '/coop/exchange', {})).json().room;
  assert.deepEqual(received.snapshot.results[guestId], final.results[guestId]);
  const changed = {
    ...final,
    sequence: 4,
    results: Object.fromEntries(
      active.members.map((member) => [member.id, { ...final.results![member.id], gold: 99 }]),
    ),
  };
  assert.equal(
    (await host.request('POST', '/coop/exchange', { snapshot: changed })).json().room.snapshot
      .results[guestId].gold,
    10,
  );
  // Dedicated per-user exchange limits permit 10Hz without hitting the normal API's 180/minute limit.
  for (let index = 0; index < 185; index++)
    assert.equal((await guest.request('POST', '/coop/exchange', {})).statusCode, 200);
});

test('single-player rooms start, and host timeout or logout closes live expeditions without rewards', async (t) => {
  let now = Date.now();
  t.mock.method(Date, 'now', () => now);
  const {
    clients: [host, guest],
  } = await fixture(t, 2);
  const solo = await host.request('POST', '/coop/create', { stage: 1 });
  assert.equal(solo.statusCode, 201);
  assert.equal((await host.request('POST', '/coop/start', {})).json().room.members.length, 1);
  await host.request('POST', '/coop/leave', {});
  const created = (await host.request('POST', '/coop/create', { stage: 1 })).json()
    .room as CoopRoom;
  await guest.request('POST', '/coop/join', { code: created.code });
  await guest.request('POST', '/coop/ready', { ready: true });
  await host.request('POST', '/coop/start', {});
  now += 16000;
  const stale = await guest.request('POST', '/coop/exchange', {});
  assert.equal(stale.statusCode, 200, stale.body);
  assert.equal(stale.json().room.status, 'aborted');
  assert.equal(stale.json().room.snapshot, undefined);
  await host.request('POST', '/coop/leave', {});
  await guest.request('POST', '/coop/leave', {});
  const next = (await host.request('POST', '/coop/create', { stage: 1 })).json().room as CoopRoom;
  await guest.request('POST', '/coop/join', { code: next.code });
  await guest.request('POST', '/coop/ready', { ready: true });
  await host.request('POST', '/coop/start', {});
  await host.request('POST', '/auth/logout');
  assert.equal((await guest.request('GET', '/coop/room')).json().room.status, 'aborted');
});
