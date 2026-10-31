import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
export function VirtualJoystick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointer = useRef<number | null>(null);
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return;
    const box = e.currentTarget.getBoundingClientRect();
    let x = e.clientX - box.left - box.width / 2,
      y = e.clientY - box.top - box.height / 2;
    const length = Math.hypot(x, y),
      radius = box.width * 0.3;
    if (length > radius) {
      x = (x / length) * radius;
      y = (y / length) * radius;
    }
    setOffset({ x, y });
    onMove(x / radius, y / radius);
  };
  const stop = () => {
    pointer.current = null;
    setOffset({ x: 0, y: 0 });
    onMove(0, 0);
  };
  return (
    <div
      className="virtual-joystick"
      role="group"
      aria-label="虚拟摇杆，拖动控制移动"
      onPointerDown={(e) => {
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
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
