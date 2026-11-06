import { DEFAULT_KEYS } from '../core/preferences';
import type { GamePreferences, InputAction } from '../core/types';

export function keyLabel(code: string) {
  const labels: Record<string, string> = {
    Space: '空格',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    ShiftLeft: '左 Shift',
    ShiftRight: '右 Shift',
  };
  return labels[code] ?? code.replace(/^Key/, '').replace(/^Digit/, '');
}

export function actionKey(preferences: GamePreferences | undefined, action: InputAction) {
  return keyLabel(preferences?.keyBindings[action] ?? DEFAULT_KEYS[action]);
}
