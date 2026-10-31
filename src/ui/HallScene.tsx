/** Background and actors share normalized coordinates; filling the plane avoids cropping service entrances. */
export function HallScene() {
  return (
    <img
      className="town-scene hall-scene"
      src="assets/maps/watchers-camp-v2.png"
      width={1296}
      height={1216}
      alt="暮林守望者营地：松林石墙、星语书屋、符文祭坛、远征记录站、熔炉工坊、秘藏摊、共享仓库与伙伴兽栏，围绕篝火及开阔石路"
      draggable={false}
      style={{ objectFit: 'fill', opacity: 1, imageRendering: 'pixelated' }}
    />
  );
}
