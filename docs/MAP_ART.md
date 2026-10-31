# 暮林营地地图重绘

2026-11-01 使用内置 `image_gen` 重绘营地环境，参考原职业 ranger.png 的高精度 Q 版暗黑幻想像素画风，并保留原大厅功能区布局。正式素材为 `public/assets/maps/watchers-camp-v2.png`，1296×1216、不透明 PNG；项目已保存本地副本，不依赖生成工具路径。

`HallScene.tsx` 直接展示该地图，复用原有 CSS 场景层。图片完整填充原有地面坐标系，不使用 cover 裁切；NPC、点击移动与交互位置继续使用 `src/data/npcHall.ts` 的归一坐标。建筑面向各自的 NPC 站位，中央石路保留通行区域。地图不烘焙人物、名字、交互按钮或伙伴，不会与运行时贴图重叠。

视觉检查：本轮确认画面具备独立书屋、符文祭坛、记录站、铁匠铺、紫色秘藏摊、仓库与兽栏，木梁、石路、植被和材质细节与职业像素贴图精度一致；七处 NPC 落脚点均位于建筑前方地面。实际窗口缩放、NPC 覆盖与触控操作由集成验收统一检查。

## 生成提示词

```text
Use case: style-transfer.
Asset type: production raster background for the existing Mist Continent RPG camp map, replacing only the background art.
Input image 1 (ranger.png) is the STYLE REFERENCE: richly shaded, crisp high-resolution chibi fantasy pixel art with warm gold trim, jade/teal shadows, brown wood, nuanced layered texture, clean dark outlines. Input image 2 (hall-desktop.jpg) is the COMPOSITION REFERENCE ONLY: extract the idea of its town map and redraw that map at much higher fidelity. Do not reproduce the UI, people, signs or labels.
Output exactly one complete near-square 16:15 camp environment image, approximately 1280x1200, edge-to-edge opaque. This is a top-down three-quarter RPG game map, not an illustration poster. Orthographic camera, straight vertical architecture, consistent ground plane. The whole map must fit without cropping.
Scene: a sheltered dark-fantasy forest encampment at twilight, surrounded by richly textured deep pine woods, crumbling mossy stone walls, amber lanterns, small welcoming buildings with aged jade roof shingles. Beautiful layered pixel shading, visible individual cobblestones, carved wooden beams, foliage, brass/bronze details, magical cyan crystal glow. Sophisticated pixel art matching the ranger asset, absolutely not simplified vector shapes, not low-detail SVG, not blocky placeholder art.
Composition and ground-plane alignment are functional requirements. Coordinates are normalized from the image's top-left; these are EMPTY NPC foot positions, with the relevant building BEHIND them, not covering them:
- book-filled skill mentor cottage behind (0.23, 0.42), its entrance around (0.23,0.37);
- small teal relic pedestal/ruined rune arch behind (0.49,0.39), magical core around (0.49,0.27);
- expedition recorder's pavilion with scrolls behind (0.77,0.42), entrance around (0.77,0.37);
- ember forge workshop, glowing furnace and anvil behind (0.13,0.66), front around (0.13,0.60);
- plum canvas treasure market stall, chest and hanging trinkets behind (0.87,0.66), front around (0.87,0.60);
- wood-and-stone storage shed with crates behind (0.27,0.88), front around (0.27,0.82);
- rustic companion stable with open fenced pen behind (0.73,0.88), front around (0.73,0.82).
Keep those seven exact foot positions on clear ground, each with enough room for an overlaid chibi NPC. No people or animals painted into this background.
Keep a broad OPEN cobbled plaza at x=0.35–0.65, y=0.42–0.94, and connecting open stone paths to every NPC. Small warm campfire at (0.50,0.57), leaving the main player standing area (0.50,0.68) clear. Do not fill the center with buildings.
Far upper 20% is forest canopy, ruined ramparts and a little atmosphere, so game caption can overlay. Deep moody atmosphere yet playable ground is readable, retain detail in dark areas, gold-orange lights balanced by muted teal.
Constraints: NO TEXT, no letters, no numbers, no logos, no interface, no borders, no UI frames, no characters, no people, no animals, no perspective vanishing point, no sky horizon. Production game environment only.
```

## 四主题战斗地表

`public/assets/maps/rift-ground-atlas-v2.png` 为内置 `image_gen` 按同一 ranger 画风生成的1254×1254不透明四格图集。象限依次对应现有主题ID：左上幽暗密林、右上荒芜墓园、左下熔火地狱、右下虚空圣殿。没有改变原有150层主题配置。

`MapGenerator.ts` 使用 Pixi `Assets` 只加载一次，按图像实际宽高各一半切出独立 `Texture`，以 `TilingSprite` 绘制地表并降低亮度，让人物、怪物和红色预警更清晰；树木、墓碑、岩石、晶石沿用现有道具绘制。`GameEngine.init` 在创建地图前预加载。贴图加载失败保留旧程序地表，场景坐标、碰撞与战斗机制不变。

图集生成提示词：

```text
Use case: style-transfer.
Asset type: high-detail RPG battlefield ground texture atlas, 2 by 2 square cells, production game terrain only.
Input ranger.png is only the STYLE reference: crisp richly layered chibi fantasy pixel-art rendering, many carefully placed pixel clusters, dark outlines, warm detailed material shading. Match its high fidelity, avoid coarse vector blocks.
Output one exactly square 2048x2048 opaque image. It consists of FOUR EQUAL SQUARE texture cells in an exact 2x2 arrangement, dividing at x=50% and y=50%, with NO gaps, NO padding, NO borders, NO labels, NO text. Each quadrant must remain entirely within its exact rectangle. Do not blend the four quadrants together. This is a texture atlas extracted by code.
CAMERA: strictly overhead FLAT seamless ground texture. No isometric elevation, no horizon, no foreground objects. Each quadrant is a different seamless repeating terrain: opposite edges within each individual cell should connect naturally. Small irregular stones and cracks have consistent size in all quadrants. Rich fine pixel-art material details, not large square paving blocks.
TOP LEFT (theme 0, dark forest): very dark jade and muted olive flagstones, worn irregular cobbles, little patches of moss, fine grass between joints, a few tiny fallen leaves. Forest ruin walking ground. Keep overall brightness low.
TOP RIGHT (theme 1, forgotten graveyard): very dark slate blue-gray old cemetery paving, uneven weathered flagstones, subtle dirt, small bone-like stone fragments and cold desaturated lichen, fine cracks. No graves or standing tombstones.
BOTTOM LEFT (theme 2, cinder depths): deep charcoal and muted red-brown volcanic rock and ash, worn fragmented basalt slabs, small thin restrained ember-orange fissures occupying under 3% of area. Do not fill with bright lava. Traversable flat volcanic terrain.
BOTTOM RIGHT (theme 3, void sanctuary): deep midnight indigo and desaturated plum ancient temple flagstones, fractured fine-grain marble, subtle violet mineral veins and a few faded geometric carvings, restrained purple glints under 2% of area. Flat walkable ground, no glowing central magic circle.
Gameplay readability is critical: all four textures are DARK LOW-CONTRAST backgrounds so bright players, enemies and red danger circles remain clearly visible. Do not include a bright central focus in any quadrant. Realistic fine material variation within stylized pixel-art, excellent texture quality but restrained visual noise. NO characters, no enemies, no animals, no weapons, no buildings, no trees, no pillars, no UI, no symbols resembling text, no decorative frame, no circles, no big objects. Texture-only asset.
```
