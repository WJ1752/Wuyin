/** Background and actors share normalized coordinates; filling the plane avoids cropping service entrances. */
export function HallScene() {
  return (
    <img
      className="town-scene hall-scene"
      src="assets/maps/watchers-camp-v3.png"
      width={1296}
      height={1216}
      alt="暮林守望者营地：中央传送门、空旷符文广场和南北石道，七处服务建筑与居民沿外围分布"
      draggable={false}
      style={{ objectFit: 'fill', opacity: 1, imageRendering: 'pixelated' }}
    />
  );
}
