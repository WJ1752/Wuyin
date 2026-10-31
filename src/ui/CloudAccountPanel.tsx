import { useState } from 'react';
import { useCloudStore } from '../state/cloudStore';
import { useGameStore } from '../state/gameStore';

const labels = {
  guest: '访客 · 本地保存',
  choosing: '选择要使用的进度',
  online: '云端已连接',
  offline: '离线 · 本机进度保留',
  expired: '登录已过期',
  conflict: '检测到跨设备进度冲突',
};

export function CloudAccountPanel() {
  const cloud = useCloudStore();
  const game = useGameStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const locked = game.inCombat || !!game.labBackup || game.cloudTransition || cloud.busy;
  const authenticated = !!cloud.user && cloud.status !== 'expired';
  return (
    <section className="card cloud-account-panel">
      <div className="section-heading">
        <h3>云账号 · 跨设备存档</h3>
        <span>
          {labels[cloud.status]}
          {cloud.dirty ? ' · 待同步' : ''}
        </span>
      </div>
      <p className="muted">
        一个云账号最多创建 6
        个角色，角色背包独立，仓库账号内共享。登录后选择进度，云端不会自动覆盖本机开荒档。
      </p>
      {cloud.error && (
        <p className="cloud-error" role="alert">
          {cloud.error}
        </p>
      )}
      {locked && <p className="muted">请结束远征、演武或等待当前操作完成后再切换进度。</p>}
      {!authenticated && (
        <form
          className="cloud-login-form"
          onSubmit={async (event) => {
            event.preventDefault();
            await cloud.authenticate(mode, username, password);
            setPassword('');
          }}
        >
          <div className="cloud-actions" role="group" aria-label="登录或注册">
            <button
              type="button"
              className="ghost-button"
              aria-pressed={mode === 'login'}
              onClick={() => setMode('login')}
            >
              登录
            </button>
            <button
              type="button"
              className="ghost-button"
              aria-pressed={mode === 'register'}
              onClick={() => setMode('register')}
            >
              注册新账号
            </button>
          </div>
          <div className="account-forms">
            <label>
              用户名
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                pattern={'[A-Za-z0-9_\\-]{3,24}'}
                minLength={3}
                maxLength={24}
                required
                disabled={locked}
                placeholder="3–24位字母、数字、_ 或 -"
              />
            </label>
            <label>
              密码
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={12}
                maxLength={128}
                required
                disabled={locked}
                placeholder="至少12位"
              />
            </label>
            <button className="gold-button" disabled={locked}>
              {cloud.busy ? '处理中…' : mode === 'login' ? '登录云账号' : '注册云账号'}
            </button>
          </div>
          <p className="muted">
            {game.cloudUserId
              ? '可继续游玩本机云账号缓存，重新登录后同步。'
              : '也可以继续使用下方访客本地账号。'}
            密码不会保存在本机游戏存档中。
          </p>
        </form>
      )}
      {(cloud.user || cloud.localUser) && (
        <>
          <p>
            账号：{cloud.localUser?.username ?? cloud.user?.username}
            {cloud.updatedAt
              ? ` · 最近云存档 ${new Date(cloud.updatedAt).toLocaleString('zh-CN')}`
              : ''}
          </p>
          {cloud.status === 'choosing' && authenticated && (
            <div className="cloud-choice">
              {cloud.pending?.account ? (
                <>
                  <p>
                    云端有 {cloud.pending.account.characters.length}{' '}
                    个角色。载入前会备份本机当前进度。
                  </p>
                  <button
                    className="gold-button"
                    disabled={locked}
                    onClick={() => void cloud.choose('download')}
                  >
                    备份本机并载入云端
                  </button>
                </>
              ) : (
                <>
                  <p>这是空云账号。可迁移当前本地账号的角色和仓库，或从零开始。</p>
                  <div className="cloud-actions">
                    <button
                      className="gold-button"
                      disabled={locked}
                      onClick={() => void cloud.choose('migrate')}
                    >
                      迁移当前本地账号
                    </button>
                    <button
                      className="ghost-button"
                      disabled={locked}
                      onClick={() => void cloud.choose('new')}
                    >
                      云账号从零开始
                    </button>
                  </div>
                </>
              )}
              {cloud.hasLocalCopy && !game.cloudUserId && (
                <button
                  className="ghost-button"
                  disabled={locked}
                  onClick={() => void cloud.choose('resume')}
                >
                  继续此云账号的本机缓存
                </button>
              )}
            </div>
          )}
          {cloud.status === 'conflict' && (
            <div className="cloud-choice">
              <p>
                另一设备已更新云端。自动上传已暂停，本机进度仍保留。选择需要保留的版本，替换前会保存冲突备份。
              </p>
              <div className="cloud-actions">
                <button
                  className="gold-button"
                  disabled={locked || !authenticated}
                  onClick={() => void cloud.choose('download')}
                >
                  备份本机并加载云端
                </button>
                <button
                  className="ghost-button"
                  disabled={locked || !authenticated || !game.cloudUserId}
                  onClick={() => setConfirmOverwrite(true)}
                >
                  保留本机并覆盖云端
                </button>
              </div>
              {confirmOverwrite && (
                <div className="cloud-confirm">
                  <p>将备份当前云档，再用本机进度替换云端。其他设备下次同步会提示冲突。</p>
                  <button
                    className="gold-button"
                    disabled={locked}
                    onClick={async () => {
                      await cloud.overwriteCloud();
                      setConfirmOverwrite(false);
                    }}
                  >
                    确认使用本机进度
                  </button>
                  <button className="ghost-button" onClick={() => setConfirmOverwrite(false)}>
                    取消
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="cloud-actions">
            {game.cloudUserId && ['online', 'offline'].includes(cloud.status) && (
              <button className="ghost-button" disabled={locked} onClick={() => void cloud.sync()}>
                立即同步
              </button>
            )}
            <button className="ghost-button" disabled={locked} onClick={() => void cloud.logout()}>
              退出云账号，返回访客
            </button>
            <button className="ghost-button" onClick={() => void cloud.exportBackup()}>
              导出替换前的本机备份
            </button>
            <button className="ghost-button" onClick={() => void cloud.exportBackup('remote')}>
              导出替换前的云端备份
            </button>
          </div>
          <p className="muted">
            自动同步前先保存本机副本；断线或登录过期时继续保留待同步进度。退出不会删除此云账号的本机缓存。
          </p>
        </>
      )}
    </section>
  );
}
