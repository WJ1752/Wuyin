import { useState } from 'react';
import { apiRequest, useCloudStore } from '../state/cloudStore';
import { useGameStore } from '../state/gameStore';
import './secondary-pixel.css';

const labels = {
  guest: '访客 · 本地保存',
  choosing: '选择要使用的进度',
  online: '云端已连接',
  offline: '离线 · 本机进度保留',
  expired: '登录已过期',
  conflict: '检测到跨设备进度冲突',
};

export function CloudAccountPanel({ onEnterHall }: { onEnterHall?: () => void }) {
  const cloud = useCloudStore();
  const game = useGameStore();
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deleteName, setDeleteName] = useState('');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const locked = game.inCombat || !!game.labBackup || game.cloudTransition || cloud.busy;
  const authenticated = !!cloud.user && cloud.status !== 'expired';
  const enterHallWhenReady = () => {
    const current = useCloudStore.getState();
    if (
      current.status === 'online' &&
      !current.error &&
      !current.recoveryCode &&
      !current.busy &&
      !useGameStore.getState().cloudTransition
    )
      onEnterHall?.();
  };
  const chooseProgress = async (choice: 'download' | 'migrate' | 'new' | 'resume') => {
    await cloud.choose(choice);
    enterHallWhenReady();
  };
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
        个角色，角色背包独立，仓库账号内共享。已有云档且本机无该账号缓存时，登录后备份当前进度并进入大厅；有缓存或空账号时先选择进度。
      </p>
      {typeof location !== 'undefined' &&
        location.protocol === 'http:' &&
        !['localhost', '127.0.0.1'].includes(location.hostname) && (
          <p className="cloud-error" role="note">
            当前为未加密的公网 /
            局域网测试入口。请仅使用测试账号与独立密码，不要复用其它网站的密码。
          </p>
        )}
      {cloud.recoveryCode && (
        <div className="cloud-choice" role="status">
          <p>请现在保存恢复码。忘记密码时可凭它重设密码；服务器只保存摘要，关闭后无法再次查看。</p>
          <code className="cloud-recovery-code">{cloud.recoveryCode}</code>
          <button
            className="ghost-button"
            onClick={() => {
              useCloudStore.setState({ recoveryCode: '' });
              enterHallWhenReady();
            }}
          >
            已另行保存
          </button>
        </div>
      )}
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
            if (mode === 'recover') await cloud.recover(username, recoveryInput, password);
            else await cloud.authenticate(mode, username, password);
            const current = useCloudStore.getState();
            if (current.error) return;
            setPassword('');
            setRecoveryInput('');
            if (
              current.status === 'choosing' &&
              current.pending?.account &&
              !current.hasLocalCopy &&
              !current.localUser
            )
              await chooseProgress('download');
            else enterHallWhenReady();
          }}
        >
          <div className="cloud-actions" role="group" aria-label="登录或注册">
            <button
              type="button"
              className="ghost-button"
              aria-pressed={mode === 'login'}
              disabled={locked}
              onClick={() => setMode('login')}
            >
              登录
            </button>
            <button
              type="button"
              className="ghost-button"
              aria-pressed={mode === 'recover'}
              disabled={locked}
              onClick={() => setMode('recover')}
            >
              恢复码找回
            </button>
            <button
              type="button"
              className="ghost-button"
              aria-pressed={mode === 'register'}
              disabled={locked}
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
              {mode === 'recover' ? '新密码' : '密码'}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={12}
                maxLength={128}
                required
                disabled={locked}
                placeholder="至少12位"
              />
            </label>
            {mode === 'recover' && (
              <label>
                恢复码
                <input
                  value={recoveryInput}
                  onChange={(event) => setRecoveryInput(event.target.value)}
                  autoComplete="off"
                  maxLength={100}
                  required
                  disabled={locked}
                />
              </label>
            )}
            <button className="gold-button" disabled={locked}>
              {cloud.busy
                ? '处理中…'
                : mode === 'login'
                  ? '登录云账号'
                  : mode === 'recover'
                    ? '重设密码并登录'
                    : '注册云账号'}
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
              ? ` · 最近云存档 ${new Date(cloud.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong' })}`
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
                    onClick={() => void chooseProgress('download')}
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
                      onClick={() => void chooseProgress('migrate')}
                    >
                      迁移当前本地账号
                    </button>
                    <button
                      className="ghost-button"
                      disabled={locked}
                      onClick={() => void chooseProgress('new')}
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
                  onClick={() => void chooseProgress('resume')}
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
                  onClick={() => void chooseProgress('download')}
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
                      enterHallWhenReady();
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
          {authenticated && (
            <details className="cloud-choice">
              <summary>账号安全与注销</summary>
              <p className="muted">
                修改密码、更新恢复码、撤销其它设备都需要当前密码。恢复码应离线保存。
              </p>
              <div className="account-forms">
                <label>
                  当前密码
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    maxLength={128}
                    disabled={locked}
                  />
                </label>
                <label>
                  新密码
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    maxLength={128}
                    disabled={locked}
                  />
                </label>
              </div>
              <div className="cloud-actions">
                <button
                  className="ghost-button"
                  disabled={locked || newPassword.length < 12 || currentPassword.length < 12}
                  onClick={async () => {
                    await cloud.manageSecurity('password', currentPassword, newPassword);
                    setCurrentPassword('');
                    setNewPassword('');
                  }}
                >
                  修改密码
                </button>
                <button
                  className="ghost-button"
                  disabled={locked || currentPassword.length < 12}
                  onClick={async () => {
                    await cloud.manageSecurity('recovery-code', currentPassword);
                    setCurrentPassword('');
                  }}
                >
                  重新生成恢复码
                </button>
                <button
                  className="ghost-button"
                  disabled={locked || currentPassword.length < 12}
                  onClick={async () => {
                    await cloud.manageSecurity('sessions/revoke', currentPassword);
                    setCurrentPassword('');
                  }}
                >
                  退出其它设备
                </button>
              </div>
              <details>
                <summary>永久注销云账号</summary>
                <p>
                  注销将永久删除服务器账号、云档、远征奖励和验证成绩，无法通过恢复码找回。操作前会在本机保留替换备份，也可先导出存档。
                </p>
                <label>
                  输入账号名确认
                  <input
                    value={deleteName}
                    onChange={(event) => setDeleteName(event.target.value)}
                    autoComplete="off"
                    disabled={locked}
                  />
                </label>
                <button
                  className="outline-button"
                  disabled={
                    locked || currentPassword.length < 12 || deleteName !== cloud.user?.username
                  }
                  onClick={async () => {
                    await cloud.deleteAccount(currentPassword, deleteName);
                    setCurrentPassword('');
                    setDeleteName('');
                  }}
                >
                  永久注销并返回访客
                </button>
              </details>
            </details>
          )}
          {cloud.securityNotice && <p role="status">{cloud.securityNotice}</p>}
        </>
      )}
      <FeedbackForm />
    </section>
  );
}

export function FeedbackForm() {
  const [feedback, setFeedback] = useState('');
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <details className="cloud-choice">
      <summary>提交问题与建议</summary>
      <p className="muted">
        请说明遇到的问题、设备和复现步骤；不要填写密码或恢复码。反馈保留 30 天。
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setFeedbackStatus('正在提交…');
          try {
            const response = await apiRequest<{ id: string }>('/feedback', 'POST', {
              category: 'bug',
              message: feedback,
            });
            setFeedbackStatus(`已提交，编号 ${response.id.slice(0, 8)}`);
            setFeedback('');
          } catch (error) {
            setFeedbackStatus(
              error instanceof Error ? error.message : '暂时无法提交，请稍后重试。',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          问题说明
          <textarea
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            minLength={5}
            maxLength={2000}
            required
            style={{ width: '100%', minHeight: 90 }}
          />
        </label>
        <button className="ghost-button" disabled={busy || feedback.trim().length < 5}>
          发送反馈
        </button>
      </form>
      {feedbackStatus && <p role="status">{feedbackStatus}</p>}
    </details>
  );
}
