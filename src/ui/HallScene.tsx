import { HALL_LAYOUT } from '../data/npcHall';

/** Background and actors share one fixed world plane and one camera transform. */
export function HallScene() {
  return (
    <img
      className="town-scene hall-scene"
      src="assets/maps/watchers-camp-v3.png"
      width={HALL_LAYOUT.world.width}
      height={HALL_LAYOUT.world.height}
      alt="暮林守望者营地：中央传送门、空旷符文广场和南北石道，七处服务建筑与居民沿外围分布"
      draggable={false}
      style={{ objectFit: 'fill', opacity: 1, imageRendering: 'pixelated' }}
    />
  );
}
