import type { GamePreferences, InputAction } from './types';

export const DEFAULT_KEYS: Record<InputAction, string> = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  movement: 'Space',
  skill1: 'Digit1',
  skill2: 'Digit2',
  skill3: 'Digit3',
  skill4: 'Digit4',
  skill5: 'Digit5',
  skill6: 'Digit6',
};
export const DEFAULT_PREFERENCES: GamePreferences = {
  musicVolume: 1,
  sfxVolume: 1,
  screenShake: true,
  damageNumbers: 'all',
  effects: 'full',
  quality: 'high',
  fontScale: 1,
  colorAssist: false,
  keyBindings: {},
};
export function getPreferences(input?: Partial<GamePreferences>): GamePreferences {
  return { ...DEFAULT_PREFERENCES, ...input, keyBindings: { ...input?.keyBindings } };
}
export function validatePreferences(input: unknown): GamePreferences {
  if (input === undefined) return getPreferences();
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new Error('偏好设置无效。');
  const p = getPreferences(input as Partial<GamePreferences>);
  if (
    ![p.musicVolume, p.sfxVolume].every((v) => Number.isFinite(v) && v >= 0 && v <= 1) ||
    typeof p.screenShake !== 'boolean' ||
    typeof p.colorAssist !== 'boolean' ||
    !['all', 'critical', 'off'].includes(p.damageNumbers) ||
    !['full', 'reduced'].includes(p.effects) ||
    !['high', 'low'].includes(p.quality) ||
    ![1, 1.15, 1.3].includes(p.fontScale)
  )
    throw new Error('偏好设置无效。');
  if (
    !(input as GamePreferences).keyBindings ||
    typeof (input as GamePreferences).keyBindings !== 'object' ||
    Array.isArray((input as GamePreferences).keyBindings)
  )
    throw new Error('按键设置无效。');
  for (const [action, code] of Object.entries(p.keyBindings)) {
    if (
      !Object.hasOwn(DEFAULT_KEYS, action) ||
      typeof code !== 'string' ||
      !/^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|[A-Z][a-z]{1,12})$/.test(
        code,
      ) ||
      [
        'Escape',
        'Tab',
        'Enter',
        'MetaLeft',
        'MetaRight',
        'ControlLeft',
        'ControlRight',
        'AltLeft',
        'AltRight',
      ].includes(code)
    )
      throw new Error('按键设置无效。');
  }
  const effective = Object.values({ ...DEFAULT_KEYS, ...p.keyBindings });
  if (new Set(effective).size !== effective.length) throw new Error('每个操作需要使用不同按键。');
  return p;
}
