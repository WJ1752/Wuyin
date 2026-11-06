export const TOUCH_DRAG_RADIUS = 28;

export const pointerDragRadius = (pointerType: string) =>
  pointerType === 'touch' ? TOUCH_DRAG_RADIUS : 65;
