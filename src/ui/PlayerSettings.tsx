import { useEffect, useState } from 'react';
import type { GamePreferences } from '../core/types';
import { DEFAULT_KEYS, getPreferences } from '../core/preferences';
import { useGameStore } from '../state/gameStore';
import './player-experience.css';
import { keyLabel } from './inputLabels';
import './secondary-pixel.css';

const ACTIONS = [
  ['up', '向上移动'],
  ['down', '向下移动'],
  ['left', '向左移动'],
  ['right', '向右移动'],
  ['skill1', '技能 1'],
  ['skill2', '技能 2'],
  ['skill3', '技能 3'],
  ['skill4', '技能 4'],
  ['skill5', '技能 5'],
  ['skill6', '技能 6'],
  ['movement', '位移技能'],
] as const;
type BindingAction = (typeof ACTIONS)[number][0];

export function PlayerSettings() {
  const save = useGameStore((state) => state.save);
  const preferences = getPreferences(save.preferences);
  const bindings = { ...DEFAULT_KEYS, ...preferences.keyBindings };
  const [capturing, setCapturing] = useState<BindingAction | null>(null);
  const [message, setMessage] = useState('');
  const [gamepad, setGamepad] = useState('');
  const update = (patch: Partial<GamePreferences>) => {
    const current = useGameStore.getState();
    current.updateSettings({
      preferences: { ...getPreferences(current.save.preferences), ...patch },
    });
  };
  useEffect(() => {
    const inspect = () => {
      const pad = Array.from(navigator.getGamepads?.() ?? []).find((entry) => entry?.connected);
      setGamepad(pad?.id ?? '');
    };
    inspect();
    const timer = window.setInterval(inspect, 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!capturing) return;
    const capture = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === 'Escape') {
        setCapturing(null);
        setMessage('已取消改键。');
        return;
      }
      if (event.repeat || event.isComposing) return;
      if (
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        !/^(Key[A-Z]|Digit[0-9]|Space)$/.test(event.code)
      ) {
        setMessage('请选择字母、数字或空格；方向键、Esc 和 Tab 保留用于通用操作。');
        return;
      }
      const current = useGameStore.getState();
      const prefs = getPreferences(current.save.preferences);
      const effective = { ...DEFAULT_KEYS, ...prefs.keyBindings };
      const duplicate = ACTIONS.find(
        ([action]) => action !== capturing && effective[action] === event.code,
      );
      if (duplicate) {
        setMessage(
          `${keyLabel(event.code)} 已用于「${duplicate[1]}」，请先修改该操作或选择其他按键。`,
        );
        return;
      }
      current.updateSettings({
        preferences: {
          ...prefs,
          keyBindings: { ...prefs.keyBindings, [capturing]: event.code },
        },
      });
      setMessage(
        `已将${ACTIONS.find(([action]) => action === capturing)?.[1]}设为 ${keyLabel(event.code)}。`,
      );
      setCapturing(null);
    };
    window.addEventListener('keydown', capture, true);
    return () => window.removeEventListener('keydown', capture, true);
  }, [capturing]);

  return (
    <>
      <section className="card preferences-panel">
        <h3>声音与战斗表现</h3>
        {(
          [
            ['musicVolume', '音乐音量'],
            ['sfxVolume', '音效音量'],
          ] as const
        ).map(([id, label]) => (
          <label className="setting-row" key={id}>
            <span>{label}</span>
            <input
              type="range"
              min="0"
              max="1"
              step=".05"
              value={preferences[id]}
              onChange={(event) => update({ [id]: Number(event.target.value) })}
            />
            <b>{Math.round(preferences[id] * 100)}%</b>
          </label>
        ))}
        <p className="muted">音乐和音效受主音量与静音共同控制。</p>
        <label className="setting-row">
          <span>屏幕震动</span>
          <input
            type="checkbox"
            checked={preferences.screenShake}
            onChange={(event) => update({ screenShake: event.target.checked })}
          />
        </label>
        <label className="setting-row">
          <span>伤害数字</span>
          <select
            className="system-select"
            value={preferences.damageNumbers}
            onChange={(event) =>
              update({ damageNumbers: event.target.value as GamePreferences['damageNumbers'] })
            }
          >
            <option value="all">全部显示</option>
            <option value="critical">仅暴击与重要状态</option>
            <option value="off">隐藏伤害数字，保留状态提示</option>
          </select>
        </label>
        <label className="setting-row">
          <span>装饰特效</span>
          <select
            className="system-select"
            value={preferences.effects}
            onChange={(event) =>
              update({ effects: event.target.value as GamePreferences['effects'] })
            }
          >
            <option value="full">完整</option>
            <option value="reduced">精简 · 突出敌方预警</option>
          </select>
        </label>
        <label className="setting-row">
          <span>渲染品质</span>
          <select
            className="system-select"
            value={preferences.quality}
            onChange={(event) =>
              update({ quality: event.target.value as GamePreferences['quality'] })
            }
          >
            <option value="high">精细</option>
            <option value="low">省电 · 降低分辨率与装饰密度</option>
          </select>
        </label>
        <p className="muted">战斗表现选项在下一场远征应用；敌方攻击判定与预警范围保持一致。</p>
      </section>
      <section className="card preferences-panel">
        <h3>文字与辨识</h3>
        <label className="setting-row">
          <span>菜单文字</span>
          <select
            className="system-select"
            value={preferences.fontScale}
            onChange={(event) =>
              update({ fontScale: Number(event.target.value) as GamePreferences['fontScale'] })
            }
          >
            <option value={1}>标准</option>
            <option value={1.15}>放大 15%</option>
            <option value={1.3}>放大 30%</option>
          </select>
        </label>
        <label className="setting-row">
          <span>色弱辅助 · 蓝橙区分与高对比</span>
          <input
            type="checkbox"
            checked={preferences.colorAssist}
            onChange={(event) => update({ colorAssist: event.target.checked })}
          />
        </label>
        <p className="preferences-sample">
          预览：<span className="positive">↑ 属性提升</span> ·{' '}
          <span className="negative">↓ 属性降低</span>。 装备品质仍同时显示名称，不只依赖颜色。
        </p>
      </section>
      <section className="card preferences-panel">
        <div className="section-heading">
          <h3>键盘操作</h3>
          <button
            className="ghost-button"
            onClick={() => {
              update({ keyBindings: getPreferences().keyBindings });
              setCapturing(null);
              setMessage('已恢复默认按键。');
            }}
          >
            恢复默认
          </button>
        </div>
        <p className="muted">
          点击按键后，按新的字母、数字或空格。Esc 取消改键；方向键移动和 Esc 暂停始终可用。
        </p>
        <div className="keybinding-grid">
          {ACTIONS.map(([action, label]) => (
            <label key={action}>
              <span>{label}</span>
              <button
                className={capturing === action ? 'gold-button' : 'outline-button'}
                aria-label={`修改${label}，当前${keyLabel(bindings[action])}`}
                aria-pressed={capturing === action}
                onClick={() => {
                  setCapturing(capturing === action ? null : action);
                  setMessage('');
                }}
              >
                {capturing === action ? '请按键…' : keyLabel(bindings[action])}
              </button>
            </label>
          ))}
        </div>
        {(capturing || message) && (
          <p role="status" className="operation-review">
            {message || '等待按键，Esc 取消。'}
          </p>
        )}
      </section>
      <section className="card preferences-panel">
        <h3>手柄操作</h3>
        <p className="gamepad-status">
          {gamepad ? `已连接：${gamepad}` : '未检测到手柄。连接后先按一下手柄按钮。'}
        </p>
        <p>
          左摇杆移动；标准映射的 A / ×、B / ○、X / □、Y / △、LB / L1、RB / R1 分别施放战斗栏第 1–6
          个技能。
        </p>
        <p className="muted">
          菜单可用屏幕按钮或键盘 Esc 打开；菜单与营地系统支持鼠标、触摸及键盘操作。
        </p>
      </section>
    </>
  );
}
