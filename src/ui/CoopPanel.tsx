import { useEffect, useRef, useState } from 'react';
import type { CoopReward, CoopRoom } from '../core/coopRoom';
import { CLASSES } from '../data/classes';
import { getCampaignChapter, getRiftOpportunity } from '../data/campaign';
import { coopBalance } from '../data/coopBalance';
import { STAGES } from '../data/stages';
import { apiRequest, useCloudStore } from '../state/cloudStore';
import { useGameStore } from '../state/gameStore';
import { getCharacterArt } from '../data/characterArt';
import { Compass, Crown, Swords, X } from './PixelIcons';
import { useDialog } from './useDialog';
import './coop.css';
import './secondary-pixel.css';

export function CoopPanel({
  onClose,
  onStart,
  onSolo,
  onAccount,
  expedition = false,
}: {
  onClose: () => void;
  onStart: (room: CoopRoom) => void;
  onSolo: () => void;
  onAccount: () => void;
  expedition?: boolean;
}) {
  const cloud = useCloudStore();
  const save = useGameStore((state) => state.save);
  const characters = useGameStore(
    (state) => state.accounts.find((account) => account.id === state.activeAccountId)?.characters,
  );
  const lab = useGameStore((state) => state.labBackup);
  const cloudTransition = useGameStore((state) => state.cloudTransition);
  const selectStage = useGameStore((state) => state.selectStage);
  const [room, setRoom] = useState<CoopRoom | null>(null);
  const [rewards, setRewards] = useState<CoopReward[]>([]);
  const [code, setCode] = useState('');
  const [stageDraft, setStageDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [roomError, setRoomError] = useState('');
  const [rewardsUnavailable, setRewardsUnavailable] = useState(false);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);
  const active = useRef(true);
  const operating = useRef(false);
  const revision = useRef(0);
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;
  const connectedAccount =
    !!cloud.user && cloud.user.id === cloud.localUser?.id && cloud.status !== 'expired' && !lab;
  const canOnline = connectedAccount && cloud.status === 'online' && !cloudTransition;
  const canClaim =
    connectedAccount && !cloudTransition && ['online', 'offline'].includes(cloud.status);
  const close = () => {
    if (operating.current || started.current) return;
    revision.current++;
    onClose();
  };
  const commitStage = (offset = 0) => {
    const current = useGameStore.getState().save.selectedStage;
    const next = (stageDraft ? Number(stageDraft) : current) + offset;
    if (next !== current) selectStage(next);
    setStageDraft(null);
    return useGameStore.getState().save.selectedStage;
  };
  const playSolo = () => {
    if (operating.current || started.current || cloudTransition) return;
    commitStage();
    revision.current++;
    onSolo();
  };
  const leave = async () => {
    if (!room || operating.current || started.current) return;
    operating.current = true;
    revision.current++;
    setBusy(true);
    setError('');
    try {
      await apiRequest('/coop/leave', 'POST', { runId: room.runId });
      if (active.current) {
        setRoom(null);
        setRoomError('');
        setCopied(false);
      }
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : '暂时无法离开队伍，请重试。');
    } finally {
      operating.current = false;
      if (active.current) setBusy(false);
    }
  };
  const dialog = useDialog(true, close);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!connectedAccount) {
      setRoom(null);
      setRewards([]);
      setRoomError('');
      setRewardsUnavailable(false);
      return;
    }
    let cancelled = false;
    let roomTimer: ReturnType<typeof setTimeout> | undefined;
    let rewardTimer: ReturnType<typeof setTimeout> | undefined;
    const isCurrent = (before: number) =>
      !cancelled &&
      active.current &&
      !operating.current &&
      !started.current &&
      before === revision.current;
    const pollRoom = async () => {
      const before = revision.current;
      try {
        if (operating.current) return;
        const response = await apiRequest<{ room: CoopRoom | null }>('/coop/room');
        if (!isCurrent(before)) return;
        setRoom(response.room);
        setRoomError(
          response.room?.status === 'aborted'
            ? (response.room.reason ?? '本次远征已结束，请离队重新组建。')
            : '',
        );
        if (response.room?.status === 'playing' && !useGameStore.getState().cloudTransition) {
          started.current = true;
          onStartRef.current(response.room);
        }
      } catch (e) {
        if (isCurrent(before)) setRoomError(e instanceof Error ? e.message : '无法连接队伍服务。');
      } finally {
        if (!cancelled && active.current && !started.current)
          roomTimer = setTimeout(pollRoom, 1500);
      }
    };
    const pollRewards = async () => {
      const before = revision.current;
      try {
        if (operating.current) return;
        const pending = await apiRequest<{ rewards: CoopReward[] }>('/coop/results');
        if (!Array.isArray(pending.rewards)) throw new Error('远征奖励响应无效。');
        if (!isCurrent(before)) return;
        setRewards(pending.rewards);
        setRewardsUnavailable(false);
      } catch {
        if (isCurrent(before)) setRewardsUnavailable(true);
      } finally {
        if (!cancelled && active.current && !started.current)
          rewardTimer = setTimeout(pollRewards, 5000);
      }
    };
    void pollRoom();
    void pollRewards();
    return () => {
      cancelled = true;
      clearTimeout(roomTimer);
      clearTimeout(rewardTimer);
    };
  }, [connectedAccount, cloud.user?.id]);
  const action = async (path: string, body: unknown) => {
    if (operating.current || started.current || !canOnline) return;
    operating.current = true;
    revision.current++;
    const userId = cloud.user?.id;
    setBusy(true);
    setError('');
    try {
      if (['create', 'join', 'ready'].includes(path)) {
        await useCloudStore.getState().sync();
        const current = useCloudStore.getState();
        if (current.status !== 'online' || current.dirty)
          throw new Error(current.error || '请完成云端存档同步后再组队。');
      }
      const response = await apiRequest<{ room: CoopRoom }>(`/coop/${path}`, 'POST', body);
      if (!active.current || useCloudStore.getState().user?.id !== userId) return;
      setRoom(response.room);
      if (response.room.status === 'playing' && !started.current) {
        started.current = true;
        onStartRef.current(response.room);
      }
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : '组队操作失败，请重试。');
    } finally {
      operating.current = false;
      if (active.current) setBusy(false);
    }
  };
  const self = room?.members.find((member) => member.id === room.selfId);
  const host = room?.selfId === room?.hostId;
  const balance = coopBalance(room?.members.length ?? 1);
  const previewStage =
    room?.stage ??
    Math.min(save.highestStage, Math.max(1, Number(stageDraft ?? save.selectedStage)));
  const stage = STAGES[previewStage - 1];
  const chapter = lab ? undefined : getCampaignChapter(previewStage);
  const opportunity = lab ? undefined : getRiftOpportunity(previewStage);
  return (
    <div className="modal-backdrop coop-backdrop">
      <div
        className="coop-panel"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label="远征队伍"
        tabIndex={-1}
      >
        <header className="coop-heading">
          <div>
            <h2>{room ? '守望者集结' : expedition ? '选择远征方式' : '结伴踏入迷雾'}</h2>
          </div>
          <button className="icon-button" aria-label="关闭远征" disabled={busy} onClick={close}>
            <X />
          </button>
        </header>
        {error && (
          <p className="coop-error" role="alert">
            {error}
          </p>
        )}
        {expedition && !room && (
          <section className="expedition-brief" aria-label="本次远征">
            <header>
              <h3>{chapter?.title ?? stage?.name}</h3>
              <small>
                第 {previewStage} 层 · 已解锁至第 {save.highestStage} 层
              </small>
            </header>
            {chapter && <p>{chapter.objective}</p>}
            {opportunity && (
              <aside className="expedition-opportunity" aria-label="战场捷径">
                <strong>{opportunity.name}</strong>
                <b>秘境进度 +{opportunity.bonus}%</b>
                <p>{opportunity.hint}</p>
              </aside>
            )}
            <div className="coop-stage-picker">
              <label htmlFor="coop-expedition-stage">挑战层数</label>
              <div>
                <button
                  type="button"
                  aria-label="降低挑战层数"
                  disabled={cloudTransition || !!lab || busy || previewStage <= 1}
                  onClick={() => commitStage(-1)}
                >
                  −
                </button>
                <input
                  id="coop-expedition-stage"
                  aria-label="选择已解锁挑战层数"
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  value={stageDraft ?? save.selectedStage}
                  disabled={cloudTransition || !!lab || busy}
                  onChange={(event) => setStageDraft(event.target.value.replace(/\D/g, ''))}
                  onBlur={() => commitStage()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                />
                <span>层</span>
                <button
                  type="button"
                  aria-label="提高挑战层数"
                  disabled={cloudTransition || !!lab || busy || previewStage >= save.highestStage}
                  onClick={() => commitStage(1)}
                >
                  ＋
                </button>
              </div>
            </div>
            <button className="coop-solo" disabled={busy || cloudTransition} onClick={playSolo}>
              <Compass size={28} />
              <span>
                <strong>{!lab && save.pendingLoot?.length ? '整理保留战利品' : '独自远征'}</strong>
                <small>
                  第 {previewStage} 层 ·{' '}
                  {previewStage === 1 ? '点敌集火，拖动移动' : '单人远征 · 可暂停'}
                </small>
              </span>
              <span>→</span>
            </button>
          </section>
        )}
        {roomError && (
          <p className="coop-error" role="status">
            {roomError}
          </p>
        )}
        {rewardsUnavailable && <p className="muted">远征奖励暂时无法读取，正在重试。</p>}
        {rewards.length > 0 && (
          <section className="cloud-choice" aria-label="待领取远征奖励">
            <h3>远征奖励待领取</h3>
            <p className="muted">
              通关结果已在服务器保存。掉线或服务重启后仍可领取，每次远征仅结算一次。
            </p>
            {rewards.map((reward) => {
              const character = characters?.find((entry) => entry.id === reward.characterId);
              return (
                <div className="coop-actions" key={reward.runId}>
                  <span>
                    {character?.name ?? '原角色当前未找到'} · 第 {reward.result.stage} 层 ·{' '}
                    {reward.result.won ? '通关' : '挑战结束'} · {reward.result.items.length}{' '}
                    件战利品
                  </span>
                  {character && (
                    <button
                      className="gold-button"
                      data-sound="equip"
                      disabled={busy || !canClaim}
                      onClick={async () => {
                        if (operating.current) return;
                        operating.current = true;
                        revision.current++;
                        setBusy(true);
                        setError('');
                        try {
                          await useCloudStore.getState().claimCoopReward(reward.runId);
                          if (active.current)
                            setRewards((previous) =>
                              previous.filter((entry) => entry.runId !== reward.runId),
                            );
                        } catch (e) {
                          if (active.current)
                            setError(e instanceof Error ? e.message : '奖励领取失败，可稍后重试。');
                        } finally {
                          operating.current = false;
                          if (active.current) setBusy(false);
                        }
                      }}
                    >
                      领取到原角色
                    </button>
                  )}
                </div>
              );
            })}
            {!canClaim && (
              <button className="ghost-button" disabled={busy} onClick={onAccount}>
                同步云端进度后领取
              </button>
            )}
          </section>
        )}
        {room ? (
          <>
            <div className="coop-room-code">
              <span>远征密令 · 第 {room.stage} 层</span>
              <strong>{room.code}</strong>
              <button
                className="text-button"
                onClick={() => {
                  if (!navigator.clipboard) {
                    setError('请手动选取并复制房间密令。');
                    return;
                  }
                  void navigator.clipboard
                    .writeText(room.code)
                    .then(() => {
                      if (active.current) setCopied(true);
                    })
                    .catch(() => {
                      if (active.current) setError('请手动选取并复制房间密令。');
                    });
                }}
              >
                {copied ? '已复制' : '复制密令'}
              </button>
            </div>
            <div className="coop-roster">
              {Array.from({ length: 4 }, (_, index) => {
                const member = room.members[index];
                return (
                  <div
                    className={`coop-member ${member ? 'occupied' : ''}`}
                    key={member?.id ?? index}
                  >
                    {member ? (
                      <>
                        <img
                          src={getCharacterArt(member.classId, member.config.equipment).src}
                          alt=""
                        />
                        <div>
                          <strong>
                            {member.name}
                            {member.id === room.selfId && '（你）'}
                          </strong>
                          <small>
                            {CLASSES.find((entry) => entry.id === member.classId)?.name} · Lv.
                            {member.level}
                          </small>
                        </div>
                        <span className="coop-ready">
                          {member.id === room.hostId ? (
                            <>
                              <Crown size={14} />
                              队长{!member.ready && ' · 未准备'}
                            </>
                          ) : member.ready ? (
                            '已准备'
                          ) : (
                            '未准备'
                          )}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="coop-empty">＋</span>
                        <small>等待旅人加入</small>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="coop-rules">
              {balance.players} 人远征 · 小怪生命 ×{balance.monsterHp.toFixed(1)} · 首领生命 ×
              {balance.bossHp.toFixed(1)} · 伤害 ×{balance.monsterDamage.toFixed(2)}
            </p>
            <p className="muted">
              层数由队长创建时确定，须所有成员已解锁。全部准备后出发，入塔后锁定阵容与数值。
            </p>
            <div className="coop-actions">
              {room.status === 'waiting' &&
                (host && self?.ready ? (
                  <button
                    className="gold-button"
                    disabled={busy || !canOnline || room.members.some((member) => !member.ready)}
                    onClick={() => void action('start', {})}
                  >
                    <Swords size={17} />
                    {busy ? '正在集结…' : `全队出发 · ${room.members.length}/4`}
                  </button>
                ) : (
                  <button
                    className="gold-button"
                    disabled={busy || !canOnline}
                    onClick={() => void action('ready', { ready: !self?.ready })}
                  >
                    {self?.ready ? '取消准备' : '准备就绪'}
                  </button>
                ))}
              <button className="outline-button" disabled={busy} onClick={() => void leave()}>
                {host ? '解散队伍' : '离开队伍'}
              </button>
            </div>
          </>
        ) : (
          <details className="coop-ways" open={expedition ? undefined : true}>
            <summary>与好友组队</summary>
            <div className="coop-intro">
              <Swords size={36} />
              <div>
                <h3>同一战场，共赴深塔</h3>
                <p>1–4 人共享魔物、首领与进度，独立装备掉落。使用密令邀请同服伙伴。</p>
              </div>
            </div>
            {canOnline ? (
              <div className="coop-create-join">
                <button
                  className="gold-button full-width"
                  disabled={busy}
                  onClick={() =>
                    void action('create', { stage: commitStage(), authority: 'server' })
                  }
                >
                  {busy ? '正在同步角色…' : `创建远征 · 第 ${save.selectedStage} 层`}
                </button>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void action('join', { code: code.trim().toUpperCase() });
                  }}
                >
                  <label htmlFor="coop-code">输入队长的六位房间密令</label>
                  <div>
                    <input
                      id="coop-code"
                      value={code}
                      maxLength={6}
                      minLength={6}
                      pattern="[0-9A-Fa-f]{6}"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="房间密令"
                      onChange={(event) => setCode(event.target.value.toUpperCase())}
                    />
                    <button
                      className="outline-button"
                      disabled={busy || !/^[0-9A-F]{6}$/.test(code.trim())}
                    >
                      加入队伍
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="coop-login">
                <p>
                  {lab
                    ? '请结束流派体验，返回自己的角色后再联机。'
                    : '登录并同步云端角色，即可创建或加入远征队伍。'}
                </p>
                {!lab && (
                  <button className="outline-button" disabled={busy} onClick={onAccount}>
                    账号与云端同步
                  </button>
                )}
              </div>
            )}
          </details>
        )}
        <details className="coop-footnote">
          <summary>联机规则与掉线重连</summary>
          <p>
            限时 300 秒 · 倒地 8 秒后半血复苏 · 全队倒地则失败
            <br />
            联机战斗持续进行，菜单与切出窗口不会暂停全队。任意成员离队将结束远征。
            <br />
            {room && room.authority !== 'server'
              ? '旧版房主模式：队长失联 30 秒或停止同步 20 秒后中止，刷新队长页面会安全中止。'
              : '服务器托管：可刷新并重连原战场，单人成员掉线不终止；全队离线 30 秒才中止。'}
            已完成奖励可在此补领。
          </p>
        </details>
      </div>
    </div>
  );
}
