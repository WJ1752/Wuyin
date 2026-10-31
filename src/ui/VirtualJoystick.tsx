import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
export function VirtualJoystick({
  onMove,
  disabled = false,
}: {
  onMove: (x: number, y: number) => void;
  disabled?: boolean;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointer = useRef<number | null>(null);
  const surface = useRef<HTMLDivElement>(null);
  const moveCallback = useRef(onMove);
  moveCallback.current = onMove;
  const stop = useCallback(() => {
    const id = pointer.current;
    pointer.current = null;
    if (id !== null && surface.current?.hasPointerCapture(id))
      surface.current.releasePointerCapture(id);
    setOffset({ x: 0, y: 0 });
    moveCallback.current(0, 0);
  }, []);
  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stop();
    };
    window.addEventListener('blur', stop);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', stop);
      document.removeEventListener('visibilitychange', onVisibility);
      moveCallback.current(0, 0);
    };
  }, [stop]);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled || pointer.current !== e.pointerId) return;
    const box = e.currentTarget.getBoundingClientRect();
    let x = e.clientX - box.left - box.width / 2,
      y = e.clientY - box.top - box.height / 2;
    const length = Math.hypot(x, y),
      radius = Math.max(1, box.width * 0.3);
    if (length > radius) {
      x = (x / length) * radius;
      y = (y / length) * radius;
    }
    setOffset({ x, y });
    // A small resting dead zone prevents a light touch from causing continuous drift.
    const strength = Math.min(1, length / radius);
    const scaled = Math.max(0, (strength - 0.12) / 0.88);
    moveCallback.current(
      length ? (x / Math.max(1, Math.hypot(x, y))) * scaled : 0,
      length ? (y / Math.max(1, Math.hypot(x, y))) * scaled : 0,
    );
  };
  return (
    <div
      ref={surface}
      className="virtual-joystick"
      role="group"
      aria-label="虚拟摇杆，拖动控制移动"
      aria-disabled={disabled}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0 || pointer.current !== null) return;
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={(e) => {
        if (pointer.current === e.pointerId) stop();
      }}
      onPointerCancel={(e) => {
        if (pointer.current === e.pointerId) stop();
      }}
      onLostPointerCapture={(e) => {
        if (pointer.current === e.pointerId) stop();
      }}
    >
      <div className="joystick-ring" />
      <span
        className="joystick-thumb"
        style={{ transform: `translate(${offset.x}px,${offset.y}px)` }}
      >
        ✥
      </span>
      <small>移动</small>
    </div>
  );
}
