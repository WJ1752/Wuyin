import { useEffect, useRef, useState } from 'react';
import type { CoopRoom } from '../core/coopRoom';
import { SETS } from '../data/sets';
import { BUILD_GUIDES } from '../data/buildGuides';
import { SKILLS } from '../data/skillTrees';
import { useGameStore } from '../state/gameStore';
import { apiRequest, useCloudStore } from '../state/cloudStore';
import { ItemIcon } from './AssetIcon';
import { CombatReport } from './CombatReport';
import { useDialog } from './useDialog';
import { Crown, Swords, X } from './PixelIcons';
import './coop.css';
import './player-experience.css';
import './secondary-pixel.css';

export function TrialPanel({
  onClose,
  onStart,
  onAccount,
}: {
  onClose: () => void;
  onStart: (room: CoopRoom) => void;
  onAccount?: () => void;
}) {
  const save = useGameStore((state) => state.save);
  const lab = useGameStore((state) => state.labBackup);
  const transition = useGameStore((state) => state.cloudTransition);
  const cloud = useCloudStore();
  const [room, setRoom] = useState<CoopRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const active = useRef(true);
  const operating = useRef(false);
  const revision = useRef(0);
  const handedOff = useRef(false);
  const canPlay = cloud.status === 'online' && !lab && !transition;
  const previousResult = room?.snapshot?.results?.[room.selfId];
  const close = async () => {
    if (operating.current || handedOff.current) return;
    operating.current = true;
    revision.current++;
    setBusy(true);
    try {
      if (cloud.status === 'online') await apiRequest('/trials/leave', 'POST', {});
    } catch {
      if (active.current) useGameStore.getState().setNotice('试炼连接已断开，已返回营地。');
    } finally {
      operating.current = false;
      if (active.current) onClose();
    }
  };
  const dialog = useDialog(true, () => void close());
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!canPlay) {
      revision.current++;
      setRoom(null);
      setLoading(false);
      return;
    }
    const request = ++revision.current;
    setLoading(true);
    setError('');
    void apiRequest<{ room: CoopRoom | null }>('/trials/state')
      .then((response) => {
        if (active.current && request === revision.current) {
          setRoom(response.room);
          if (response.room?.status === 'aborted')
            setError(response.room.reason ?? '上次试炼已中止，可重新挑战。');
        }
      })
      .catch((e) => {
        if (active.current && request === revision.current)
          setError(e instanceof Error ? e.message : '无法读取试炼状态。');
      })
      .finally(() => {
        if (active.current && request === revision.current) setLoading(false);
      });
    return () => {
      if (request === revision.current) revision.current++;
    };
  }, [canPlay, cloud.user?.id, reload]);
  const start = async (setId: string) => {
    if (operating.current || !canPlay || loading || handedOff.current) return;
    operating.current = true;
    revision.current++;
    const userId = cloud.user?.id;
    setBusy(true);
    setError('');
    try {
      const response = await apiRequest<{ room: CoopRoom }>('/trials/start', 'POST', { setId });
      if (!active.current || userId !== useCloudStore.getState().user?.id) return;
      if (response.room.hostId !== 'server' || response.room.status !== 'playing')
        throw new Error('试炼尚未就绪，请稍后重试。');
      handedOff.current = true;
      onStart(response.room);
    } catch (e) {
      if (active.current) setError(e instanceof Error ? e.message : '试炼启动失败，请重试。');
    } finally {
      operating.current = false;
      if (active.current) setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop coop-backdrop">
      <section
        className="coop-panel trial-panel"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="trial-title"
        tabIndex={-1}
      >
        <header className="coop-heading">
          <div>
            <span className="eyebrow">THE WATCHER'S TRIAL · VERIFIED</span>
            <h2 id="trial-title">守望者验证试炼</h2>
          </div>
          <button
            className="icon-button"
            aria-label="结束试炼并关闭"
            disabled={busy}
            onClick={() => void close()}
          >
            <X />
          </button>
        </header>
        <div className="trial-intro">
          <Crown size={28} />
          <p>
            以统一的 100 级官方流派配装挑战第 150
            层。战斗由服务器推演，比较同一流派下的走位与施法，用最优通关时间参与验证挑战榜。
          </p>
          <p className="muted">
            使用独立试炼角色，不读取你的装备，也不发放成长收益。原角色的装备、货币和进度保留。
          </p>
        </div>
        {error && (
          <div className="coop-error" role="alert">
            <p>{error}</p>
            <button
              className="ghost-button"
              disabled={!canPlay || busy || loading}
              onClick={() => setReload((value) => value + 1)}
            >
              重新检查试炼状态
            </button>
          </div>
        )}
        {loading && <p role="status">正在检查上次的试炼…</p>}
        {!canPlay && (
          <div className="operation-review">
            <p>
              {lab
                ? '请先结束流派演武，回到开荒营地后参与。'
                : transition
                  ? '正在切换角色档案，请稍候。'
                  : '登录服务器账号后即可参与，无需上传当前配装。'}
            </p>
            {onAccount && !lab && !transition && (
              <button className="gold-button" onClick={onAccount}>
                前往账号登录
              </button>
            )}
          </div>
        )}
        {room?.status === 'playing' ? (
          <div className="operation-review">
            <h3>有一场进行中的试炼</h3>
            <p>重新连接后继续同一场战斗，服务器计时持续进行。</p>
            <div className="button-row">
              <button
                className="gold-button"
                disabled={busy || !canPlay}
                onClick={() => {
                  handedOff.current = true;
                  onStart(room);
                }}
              >
                继续试炼
              </button>
              <button
                className="ghost-button"
                disabled={busy}
                onClick={async () => {
                  if (operating.current) return;
                  operating.current = true;
                  setBusy(true);
                  try {
                    await apiRequest('/trials/leave', 'POST', {});
                    if (active.current) setRoom(null);
                  } catch (e) {
                    if (active.current) setError(e instanceof Error ? e.message : '无法结束试炼。');
                  } finally {
                    operating.current = false;
                    if (active.current) setBusy(false);
                  }
                }}
              >
                结束本次试炼
              </button>
            </div>
          </div>
        ) : (
          <div className="trial-builds">
            {SETS.filter((entry) => entry.classId === save.classId).map((entry) => (
              <article className="card" key={entry.id}>
                <ItemIcon item={{ slot: 'head', setId: entry.id }} size={48} />
                <h3>{entry.name}</h3>
                <p>
                  {BUILD_GUIDES[entry.id].style} · 核心：
                  {SKILLS.find((skill) => skill.id === entry.skillId)?.name}
                </p>
                <p className="muted">{BUILD_GUIDES[entry.id].tip}</p>
                <button
                  className="gold-button"
                  disabled={!canPlay || busy || loading}
                  onClick={() => void start(entry.id)}
                >
                  <Swords size={16} /> {busy ? '正在进入…' : '以此流派挑战'}
                </button>
              </article>
            ))}
          </div>
        )}
        {room?.status === 'finished' && previousResult && (
          <section className="card">
            <h3>{previousResult.won ? '上次验证试炼已通关' : '上次验证试炼未通关'}</h3>
            <p>
              用时 {previousResult.seconds.toFixed(1)} 秒 · 击败 {previousResult.kills}{' '}
              个敌人。成功战绩已由服务器记录。
            </p>
            {previousResult.stats && (
              <CombatReport stats={previousResult.stats} failed={!previousResult.won} />
            )}
          </section>
        )}
      </section>
    </div>
  );
}
