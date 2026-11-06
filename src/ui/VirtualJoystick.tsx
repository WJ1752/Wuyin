import { useEffect, useState } from 'react';
import { TOUCH_DRAG_RADIUS } from '../core/pointerMovement';
import './floating-joystick.css';

interface TouchStick {
  pointerId: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

export function VirtualJoystick({ disabled = false }: { disabled?: boolean }) {
  const [stick, setStick] = useState<TouchStick | null>(null);

  useEffect(() => {
    if (disabled) {
      setStick(null);
      return;
    }
    let activePointer: number | null = null;
    const clear = () => {
      activePointer = null;
      setStick(null);
    };
    const start = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !event.isPrimary || activePointer !== null) return;
      const target = event.target;
      if (
        !(target instanceof Element) ||
        target.closest('button,input,select,summary,dialog,[role="dialog"]')
      )
        return;
      if (!target.closest('.hall-map,.combat-canvas')) return;
      activePointer = event.pointerId;
      setStick({ pointerId: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0 });
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== activePointer) return;
      setStick((current) => {
        if (!current || current.pointerId !== event.pointerId) return current;
        let dx = event.clientX - current.x;
        let dy = event.clientY - current.y;
        const distance = Math.hypot(dx, dy);
        if (distance > TOUCH_DRAG_RADIUS) {
          dx = (dx / distance) * TOUCH_DRAG_RADIUS;
          dy = (dy / distance) * TOUCH_DRAG_RADIUS;
        }
        return { ...current, dx, dy };
      });
    };
    const end = (event: PointerEvent) => {
      if (event.pointerId === activePointer) clear();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') clear();
    };
    window.addEventListener('pointerdown', start);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      activePointer = null;
    };
  }, [disabled]);

  if (!stick) return null;
  return (
    <div className="floating-joystick" style={{ left: stick.x, top: stick.y }} aria-hidden="true">
      <span
        className="floating-joystick-thumb"
        style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }}
      />
    </div>
  );
}
