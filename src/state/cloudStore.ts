import { settleCamp } from '../data/progression';
import { create } from 'zustand';
import type { AccountData, AccountSave, RunResult } from '../core/types';
import {
  newAccountSave,
  readDisk,
  registerCloudPersistence,
  snapshotAccounts,
  useGameStore,
  validateAccountSave,
  writeDisk,
} from './gameStore';

interface CloudUser {
  id: string;
  username: string;
}
interface CloudSave {
  account: AccountData | null;
  revision: number;
  updatedAt: number | null;
}
interface LocalCloudSave {
  version: 1;
  user: CloudUser;
  account: AccountData;
  revision: number;
  dirty: boolean;
  updatedAt: number | null;
}
type Status = 'guest' | 'choosing' | 'online' | 'offline' | 'expired' | 'conflict';
interface CloudState {
  localReady: boolean;
  user: CloudUser | null;
  localUser: CloudUser | null;
  status: Status;
  busy: boolean;
  dirty: boolean;
  revision: number;
  updatedAt: number | null;
  error: string;
  pending: CloudSave | null;
  hasLocalCopy: boolean;
  recoveryCode: string;
  securityNotice: string;
  initialize: () => Promise<void>;
  authenticate: (mode: 'login' | 'register', username: string, password: string) => Promise<void>;
  choose: (mode: 'download' | 'migrate' | 'new' | 'resume') => Promise<void>;
  sync: () => Promise<void>;
  overwriteCloud: () => Promise<void>;
  logout: () => Promise<void>;
  exportBackup: (source?: 'local' | 'remote') => Promise<void>;
  claimCoopReward: (runId: string) => Promise<RunResult>;
  recover: (username: string, recoveryCode: string, newPassword: string) => Promise<void>;
  manageSecurity: (
    action: 'password' | 'recovery-code' | 'sessions/revoke',
    password: string,
    newPassword?: string,
  ) => Promise<void>;
  deleteAccount: (password: string, confirmation: string) => Promise<void>;
}

const ACTIVE_KEY = 'mist-continent-cloud-active';
const GUEST_KEY = 'mist-continent-cloud-guest-backup';
const BACKUP_KEY = 'mist-continent-cloud-replacement-backup';
const cacheKey = (id: string) => `mist-continent-cloud:${id}`;
let csrfToken = '';
let initialized: Promise<void> | undefined;
let syncing: Promise<void> | undefined;
let debounce: ReturnType<typeof setTimeout> | undefined;
let suppressChanges = false;
let signature = '';
let storageGeneration = 0;
function record(value: unknown) {
  storageGeneration = Math.max(storageGeneration + 1, Date.now() * 1000);
  return { format: 'mist-cloud-record', generation: storageGeneration, value };
}
const fingerprint = (account: AccountData) =>
  JSON.stringify(account, (key, value) => (key === 'lastSaved' ? 0 : value));

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}
export async function apiRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'x-csrf-token': csrfToken } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new RequestError(
        data.error ?? `云服务请求失败（${response.status}）`,
        response.status,
        data.code,
      );
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}
async function session() {
  const result = await apiRequest<{ user: CloudUser | null; csrfToken: string }>('/session');
  if (
    typeof result.csrfToken !== 'string' ||
    !result.csrfToken ||
    (result.user !== null &&
      (typeof result.user?.id !== 'string' || typeof result.user?.username !== 'string'))
  )
    throw new Error('云服务尚未连接，当前可继续访客本地游玩。');
  csrfToken = result.csrfToken;
  return result;
}
async function remoteSave(user: CloudUser) {
  const remote = await apiRequest<CloudSave>('/save');
  if (
    !Number.isSafeInteger(remote.revision) ||
    remote.revision < 0 ||
    (remote.account !== null && remote.account?.id !== user.id)
  )
    throw new RequestError('服务器会话已切换，请重新登录当前账号；本机进度未替换。', 401);
  if (remote.account) remote.account = accountData(remote.account, user);
  return remote;
}
function checkWriteResult(result: CloudSave, user: CloudUser, previousRevision: number) {
  if (result.account?.id !== user.id)
    throw new RequestError('服务器会话已切换，同步结果不属于当前账号。本机进度仍保留。', 401);
  if (!Number.isSafeInteger(result.revision) || result.revision <= previousRevision)
    throw new Error('云端返回的存档版本无效，已保留本机待同步进度。');
}

/** A single atomic envelope keeps the local edits and their base server revision together. */
async function storeLocal(key: string, value: unknown) {
  const entry = record(value);
  const raw = JSON.stringify(entry);
  let saved = false;
  try {
    localStorage.setItem(key, raw);
    saved = true;
  } catch {
    /* IndexedDB may have more room. */
  }
  try {
    await writeDisk(entry, key);
    saved = true;
  } catch {
    /* The synchronous backup may suffice. */
  }
  if (!saved) throw new Error('浏览器存储空间不足，请导出存档后再继续；现有进度未替换。');
}
async function loadLocal(
  key: string,
  valid: (value: unknown) => boolean = () => true,
): Promise<unknown> {
  const candidates: { generation: number; value: unknown }[] = [];
  const accept = (raw: unknown) => {
    if (raw === null || raw === undefined) return;
    const entry = raw as { format?: string; generation?: number; value?: unknown };
    if (entry.format === 'mist-cloud-record') {
      if (!Number.isSafeInteger(entry.generation) || entry.generation! < 0) return;
      storageGeneration = Math.max(storageGeneration, entry.generation!);
      candidates.push({ generation: entry.generation!, value: entry.value });
    } else candidates.push({ generation: 0, value: raw });
  };
  // Both copies are independent. A full localStorage must never hide a newer IndexedDB save.
  try {
    const raw = localStorage.getItem(key);
    if (raw) accept(JSON.parse(raw));
  } catch {
    /* Read the independent copy. */
  }
  try {
    accept(await readDisk(key));
  } catch {
    /* The browser backup may suffice. */
  }
  for (const entry of candidates.sort((a, b) => b.generation - a.generation)) {
    try {
      if (valid(entry.value)) return entry.value;
    } catch {
      /* Try the next valid copy. */
    }
  }
  return null;
}
function accountData(account: AccountData, user: CloudUser): AccountData {
  const owned = { ...account, id: user.id, name: user.username };
  return validateAccountSave({
    format: 'mist-continent-accounts',
    version: 1,
    activeAccountId: user.id,
    accounts: [owned],
    lastSaved: Date.now(),
  }).accounts[0];
}
function cached(value: unknown, id: string): LocalCloudSave | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as LocalCloudSave;
  if (
    data.version !== 1 ||
    data.user?.id !== id ||
    data.account?.id !== id ||
    typeof data.user.username !== 'string' ||
    !Number.isSafeInteger(data.revision) ||
    data.revision < 0 ||
    typeof data.dirty !== 'boolean'
  )
    return null;
  return { ...data, account: accountData(data.account, data.user) };
}
async function loadCloudCache(id: string) {
  return cached(await loadLocal(cacheKey(id), (value) => !!cached(value, id)), id);
}
function currentAccount() {
  const data = snapshotAccounts(useGameStore.getState());
  return data.accounts.find((account) => account.id === data.activeAccountId)!;
}
function envelope(): LocalCloudSave | null {
  const cloud = useCloudStore.getState();
  const game = useGameStore.getState();
  if (!cloud.localUser || game.cloudUserId !== cloud.localUser.id) return null;
  return {
    version: 1,
    user: cloud.localUser,
    account: accountData(currentAccount(), cloud.localUser),
    revision: cloud.revision,
    dirty: cloud.dirty,
    updatedAt: cloud.updatedAt,
  };
}
async function persistLocal() {
  const data = envelope();
  if (data) await storeLocal(cacheKey(data.user.id), data);
}
function backupOnExit() {
  const data = envelope();
  if (data) {
    try {
      localStorage.setItem(cacheKey(data.user.id), JSON.stringify(record(data)));
    } catch {
      /* Last IndexedDB snapshot remains. */
    }
  }
}
function install(data: LocalCloudSave) {
  const account = accountData(data.account, data.user);
  const save = account.characters.find((c) => c.id === account.activeCharacterId)!.save;
  const reward = settleCamp(save);
  suppressChanges = true;
  useCloudStore.setState({
    localUser: data.user,
    dirty: data.dirty || !!reward,
    revision: data.revision,
    updatedAt: data.updatedAt,
  });
  useGameStore.setState({
    accounts: [account],
    activeAccountId: account.id,
    save,
    ...(reward ? { notice: reward } : {}),
    cloudUserId: data.user.id,
    labBackup: null,
    lastGamble: [],
  });
  signature = fingerprint(account);
  suppressChanges = false;
  if (reward) backupOnExit();
}
function canReplace() {
  const game = useGameStore.getState();
  if (game.inCombat || game.labBackup || game.cloudTransition || useCloudStore.getState().busy)
    throw new Error('请先结束远征、演武或当前同步操作，再管理云账号。');
}
function fail(error: unknown) {
  const message = error instanceof Error ? error.message : '云服务暂时不可用，本机进度已保留。';
  if (
    error instanceof RequestError &&
    [
      'INVALID_CREDENTIALS',
      'INVALID_CREDENTIALS_FORMAT',
      'CONFIRMATION_REQUIRED',
      'RATE_LIMITED',
    ].includes(error.code ?? '')
  ) {
    useCloudStore.setState({ error: message });
    return;
  }
  const cloud = useCloudStore.getState();
  const status: Status =
    error instanceof RequestError && error.code === 'SAVE_CONFLICT'
      ? 'conflict'
      : error instanceof RequestError && (error.status === 401 || error.status === 403)
        ? 'expired'
        : cloud.localUser
          ? 'offline'
          : 'guest';
  useCloudStore.setState({
    status,
    error: message,
    ...(status === 'expired' || (!cloud.localUser && status === 'guest') ? { user: null } : {}),
  });
  backupOnExit();
}
async function transition(action: () => Promise<void>) {
  try {
    canReplace();
  } catch (error) {
    useCloudStore.setState({ error: (error as Error).message });
    return;
  }
  useCloudStore.setState({ busy: true, error: '' });
  useGameStore.setState({ cloudTransition: true });
  try {
    if (syncing) await syncing;
    await action();
  } catch (error) {
    fail(error);
  } finally {
    useGameStore.setState({ cloudTransition: false });
    useCloudStore.setState({ busy: false });
  }
}
async function replacementBackup(remote?: CloudSave) {
  await storeLocal(BACKUP_KEY, {
    capturedAt: Date.now(),
    local: snapshotAccounts(useGameStore.getState()),
    remote,
  });
  if (!useGameStore.getState().cloudUserId)
    await storeLocal(GUEST_KEY, snapshotAccounts(useGameStore.getState()));
  else await persistLocal();
}
function queueSync() {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    void useCloudStore.getState().sync();
  }, 1500);
}

export const useCloudStore = create<CloudState>((set, get) => ({
  localReady: false,
  user: null,
  localUser: null,
  status: 'guest',
  busy: false,
  dirty: false,
  revision: 0,
  updatedAt: null,
  error: '',
  pending: null,
  hasLocalCopy: false,
  recoveryCode: '',
  securityNotice: '',
  initialize() {
    if (initialized) return initialized;
    initialized = (async () => {
      set({ busy: true });
      registerCloudPersistence({ persist: persistLocal, backup: backupOnExit });
      useGameStore.subscribe(() => {
        const game = useGameStore.getState();
        if (suppressChanges || !game.cloudUserId || !get().localUser) return;
        const next = fingerprint(currentAccount());
        if (next === signature) return;
        signature = next;
        set({
          dirty: true,
          ...(get().status === 'choosing' && get().pending?.revision !== get().revision
            ? { status: 'conflict' as const }
            : {}),
        });
        backupOnExit();
        void persistLocal().catch(fail);
        queueSync();
      });
      if (typeof window !== 'undefined')
        window.addEventListener('online', () => {
          void get().sync();
        });
      try {
        const active = await loadLocal(
          ACTIVE_KEY,
          (value) => value === null || typeof value === 'string',
        );
        if (typeof active === 'string') {
          const local = await loadCloudCache(active);
          if (local) {
            install(local);
            set({ status: 'offline' });
          }
        }
        // Once the right local character is installed, combat can start even on a slow network.
        set({ localReady: true });
        const auth = await session();
        set({ user: auth.user });
        if (!auth.user) {
          if (get().localUser)
            set({ status: 'expired', error: '登录已过期，本机进度已保留。请重新登录原账号。' });
          return;
        }
        if (get().localUser && get().localUser!.id !== auth.user.id) {
          set({
            status: 'expired',
            error: '当前服务器会话与本机云进度不属于同一账号。请退出云模式后再登录。',
          });
          return;
        }
        const remote = await remoteSave(auth.user);
        set({ pending: remote });
        if (get().localUser) {
          if (remote.revision !== get().revision)
            set({ status: get().dirty ? 'conflict' : 'choosing' });
          else {
            set({ status: 'online' });
            queueSync();
          }
        } else {
          const copy = await loadCloudCache(auth.user.id);
          set({ status: 'choosing', hasLocalCopy: !!copy });
        }
      } catch (error) {
        fail(error);
      } finally {
        set({ localReady: true, busy: false });
      }
    })();
    return initialized;
  },
  async authenticate(mode, username, password) {
    await transition(async () => {
      username = username.trim();
      if (!/^[A-Za-z0-9_-]{3,24}$/.test(username) || password.length < 12 || password.length > 128)
        throw new Error('用户名需为3–24位字母、数字、下划线或短横线；密码需为12–128位。');
      if (get().localUser && get().localUser!.username.toLowerCase() !== username.toLowerCase())
        throw new Error('请先退出当前云账号，再登录其他账号；本机未同步进度会保留。');
      await session();
      const auth = await apiRequest<{ user: CloudUser; csrfToken: string; recoveryCode?: string }>(
        `/auth/${mode}`,
        'POST',
        {
          username,
          password,
        },
      );
      csrfToken = auth.csrfToken;
      set({ user: auth.user, recoveryCode: auth.recoveryCode ?? '', securityNotice: '' });
      const remote = await remoteSave(auth.user);
      set({ pending: remote, error: '' });
      if (get().localUser?.id === auth.user.id) {
        set({
          status:
            remote.revision === get().revision ? 'online' : get().dirty ? 'conflict' : 'choosing',
        });
      } else {
        const copy = await loadCloudCache(auth.user.id);
        set({ status: 'choosing', hasLocalCopy: !!copy });
      }
    });
    if (get().status === 'online') queueSync();
  },
  async choose(mode) {
    await transition(async () => {
      const user = get().user;
      if (!user) throw new Error('请先登录云账号。');
      const remote = await remoteSave(user);
      let account: AccountData;
      let revision = remote.revision;
      let dirty = false;
      if (mode === 'download') {
        if (!remote.account) throw new Error('云端还没有存档，请选择迁移或从零开始。');
        account = accountData(remote.account, user);
      } else if (mode === 'resume') {
        const local = await loadCloudCache(user.id);
        if (!local) throw new Error('本机没有该账号的缓存。');
        account = local.account;
        revision = local.revision;
        dirty = local.dirty;
      } else {
        if (remote.account)
          throw new RequestError(
            '云端已有进度，请先载入云档；迁移不会覆盖已有云档。',
            409,
            'SAVE_CONFLICT',
          );
        account = accountData(
          mode === 'new' ? newAccountSave().accounts[0] : currentAccount(),
          user,
        );
        dirty = true;
      }
      await replacementBackup(remote);
      const local: LocalCloudSave = {
        version: 1,
        user,
        account,
        revision,
        dirty,
        updatedAt: remote.updatedAt,
      };
      await storeLocal(cacheKey(user.id), local);
      await storeLocal(ACTIVE_KEY, user.id);
      install(local);
      set({
        status: revision !== remote.revision ? (dirty ? 'conflict' : 'choosing') : 'online',
        pending: remote,
        hasLocalCopy: true,
        error: '',
      });
    });
    if (get().status === 'online') queueSync();
  },
  async recover(username, recoveryCode, newPassword) {
    await transition(async () => {
      username = username.trim();
      if (get().localUser && get().localUser!.username.toLowerCase() !== username.toLowerCase())
        throw new Error('请先退出当前云账号，再找回其他账号。');
      await session();
      const result = await apiRequest<{ user: CloudUser; csrfToken: string; recoveryCode: string }>(
        '/auth/recover',
        'POST',
        { username, recoveryCode, newPassword },
      );
      csrfToken = result.csrfToken;
      const remote = await remoteSave(result.user);
      set({
        user: result.user,
        pending: remote,
        recoveryCode: result.recoveryCode,
        hasLocalCopy: !!(await loadCloudCache(result.user.id)),
        status: 'choosing',
        error: '',
        securityNotice: '密码已重置，旧会话和旧恢复码均已失效。请保存新恢复码。',
      });
    });
  },
  async manageSecurity(action, password, newPassword) {
    await transition(async () => {
      const result = await apiRequest<{
        csrfToken?: string;
        recoveryCode?: string;
        revoked?: number;
      }>(`/auth/${action}`, 'POST', {
        password,
        currentPassword: password,
        ...(newPassword ? { newPassword } : {}),
      });
      if (result.csrfToken) csrfToken = result.csrfToken;
      set({
        ...(result.recoveryCode ? { recoveryCode: result.recoveryCode } : {}),
        securityNotice:
          action === 'password'
            ? '密码已修改，其它设备已退出登录。'
            : action === 'recovery-code'
              ? '已生成新恢复码，旧恢复码立即失效。请妥善保存。'
              : `已撤销其它 ${result.revoked ?? 0} 个会话。`,
        error: '',
      });
    });
  },
  async deleteAccount(password, confirmation) {
    let deleted = false;
    await transition(async () => {
      await replacementBackup(await remoteSave(get().user!));
      const result = await apiRequest<{ csrfToken: string }>('/auth/delete', 'POST', {
        password,
        confirmation,
      });
      csrfToken = result.csrfToken;
      deleted = true;
    });
    if (deleted) await get().logout();
  },
  async claimCoopReward(runId) {
    const initial = get();
    if (
      !initial.user ||
      initial.user.id !== initial.localUser?.id ||
      useGameStore.getState().labBackup
    )
      throw new Error('请登录奖励所属账号并结束流派体验后领取。');
    await get().sync();
    if (get().status !== 'online' || get().dirty || get().busy)
      throw new Error(get().error || '请先处理云端进度分歧，再从远征面板补领奖励。');
    set({ busy: true });
    useGameStore.setState({ cloudTransition: true });
    try {
      await replacementBackup();
      const response = await apiRequest<
        CloudSave & { result: RunResult; alreadyClaimed: boolean; notice?: string }
      >('/coop/claim', 'POST', { runId, revision: get().revision });
      if (
        !response.account ||
        response.account.id !== initial.user.id ||
        response.revision < get().revision
      )
        throw new Error('奖励返回的云端存档无效，本机备份已保留。');
      install({
        version: 1,
        user: initial.user,
        account: response.account,
        revision: response.revision,
        updatedAt: response.updatedAt,
        dirty: false,
      });
      set({ status: 'online', pending: response, error: '' });
      if (response.notice) useGameStore.setState({ notice: response.notice });
      await persistLocal();
      return response.result;
    } catch (error) {
      fail(error);
      throw error;
    } finally {
      useGameStore.setState({ cloudTransition: false });
      set({ busy: false });
    }
  },
  sync() {
    if (syncing) return syncing;
    const initial = get();
    if (
      !initial.user ||
      initial.user.id !== initial.localUser?.id ||
      ['conflict', 'choosing', 'expired'].includes(initial.status) ||
      initial.busy ||
      useGameStore.getState().cloudTransition
    )
      return Promise.resolve();
    syncing = (async () => {
      try {
        if (!get().dirty) {
          const remote = await remoteSave(initial.user!);
          set({ pending: remote });
          if (remote.revision !== get().revision) {
            set({ status: get().dirty ? 'conflict' : 'choosing', error: '' });
            return;
          }
          set({ status: 'online', error: '' });
        }
        while (get().dirty && get().user?.id === get().localUser?.id) {
          const data = envelope();
          if (!data) break;
          await persistLocal();
          const sent = fingerprint(data.account);
          const result = await apiRequest<CloudSave>('/save', 'PUT', {
            account: data.account,
            revision: data.revision,
          });
          checkWriteResult(result, data.user, data.revision);
          set({
            revision: result.revision,
            updatedAt: result.updatedAt,
            dirty: fingerprint(currentAccount()) !== sent,
            status: 'online',
            error: '',
          });
          await persistLocal();
        }
      } catch (error) {
        fail(error);
      } finally {
        syncing = undefined;
      }
    })();
    return syncing;
  },
  async overwriteCloud() {
    await transition(async () => {
      const user = get().user;
      if (!user || user.id !== get().localUser?.id)
        throw new Error('请先重新登录本机进度所属账号。');
      const remote = await remoteSave(user);
      await replacementBackup(remote);
      const account = accountData(currentAccount(), user);
      const sent = fingerprint(account);
      const result = await apiRequest<CloudSave>('/save', 'PUT', {
        account,
        revision: remote.revision,
      });
      checkWriteResult(result, user, remote.revision);
      set({
        revision: result.revision,
        updatedAt: result.updatedAt,
        dirty: fingerprint(currentAccount()) !== sent,
        status: 'online',
        pending: result,
        error: '',
      });
      await persistLocal();
    });
    if (get().status === 'online') queueSync();
  },
  async logout() {
    await transition(async () => {
      await persistLocal();
      const guest = await loadLocal(GUEST_KEY, (value) => {
        validateAccountSave(value);
        return true;
      });
      const data: AccountSave = guest
        ? validateAccountSave(guest)
        : snapshotAccounts(useGameStore.getState());
      if (useGameStore.getState().cloudUserId && !guest)
        throw new Error('访客备份无法读取，当前云进度仍保留，请导出后再处理。');
      // A failed logout keeps the session visible; it must not appear signed out while the cookie remains valid.
      await session();
      await apiRequest('/auth/logout', 'POST');
      await storeLocal(ACTIVE_KEY, null);
      suppressChanges = true;
      if (useGameStore.getState().cloudUserId) {
        const account = data.accounts.find((entry) => entry.id === data.activeAccountId)!;
        useGameStore.setState({
          accounts: data.accounts,
          activeAccountId: data.activeAccountId,
          save: account.characters.find((entry) => entry.id === account.activeCharacterId)!.save,
          cloudUserId: null,
          labBackup: null,
          lastGamble: [],
        });
      }
      set({
        user: null,
        localUser: null,
        status: 'guest',
        dirty: false,
        revision: 0,
        updatedAt: null,
        pending: null,
        hasLocalCopy: false,
        recoveryCode: '',
        securityNotice: '',
        error: '',
      });
      suppressChanges = false;
      await useGameStore.getState().persist();
    });
  },
  async exportBackup(source = 'local') {
    try {
      const backup = (await loadLocal(BACKUP_KEY)) as {
        local?: AccountSave;
        remote?: CloudSave;
      } | null;
      if (!backup) throw new Error('尚无替换或冲突备份。');
      const account = backup.remote?.account;
      const output =
        source === 'local'
          ? backup.local
          : account
            ? {
                format: 'mist-continent-accounts',
                version: 1,
                accounts: [account],
                activeAccountId: account.id,
                lastSaved: Date.now(),
              }
            : null;
      if (!output) throw new Error('最近备份中没有该版本的存档。');
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `mist-cloud-${source}-replacement-backup.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      set({ error: (error as Error).message });
    }
  },
}));
