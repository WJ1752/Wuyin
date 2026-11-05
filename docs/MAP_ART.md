# 营地与秘境地图

## 当前像素地图

营地背景沿用中央传送门与外围七处服务的布局。冷色石面、深青树林及局部灯火与怪物、圣坛的限色像素画风配合。交互点由 `npcHall.ts` 统一定位。

150 层秘境沿用每五层轮换的森林、墓园、熔火和虚空主题。每个主题一张三格地表图集，进入秘境时只预载当前主题。每层组合两种地表，绘制曲径、岔道、十字广场、环道或带侧庭的长廊。道路宽度、朝向和摆件位置取自楼层专用随机种子，单人和组队进入同层时看到相同的地形。道路用于视觉分区，战场仍可自由通行。

以下为早期素材和布局记录。

## 第三版：中央传送门与外围服务

当时主城使用 `public/assets/maps/watchers-camp-v3.png`，1296×1216、不透明 PNG；使用内置 imagegen 编辑第二版，沿用同一精细像素风。传送门、符文广场与南北道路留空，移除中央篝火，七处服务建筑沿外围排布。`HALL_LAYOUT` 统一传送门、出生点、留白区、道路与行走边界；七名NPC脚点和朝广场侧的接近点由 `npcHall.ts` 定义。

| 服务 | 门前脚点 (x,y) | 接近点 (x,y) |
| --- | --- | --- |
| 技能 | .20,.35 | .28,.38 |
| 魔盒 | .80,.35 | .72,.38 |
| 铁匠 | .15,.58 | .25,.58 |
| 榜单 | .85,.60 | .75,.60 |
| 仓库 | .22,.82 | .30,.82 |
| 秘藏 | .84,.80 | .75,.80 |
| 伙伴 | .74,.91 | .66,.92 |

传送门落点为 (.50,.28)，玩家从 (.50,.85) 出生。中央留白区 x=.34–.66、y=.18–.76，主路 x=.41–.59。主城舞台固定1296:1216比例，角色与背景共用坐标；摇杆和交互按钮位于地图外独立操作带。传送门没有悬浮标题遮挡，可点击打开既有单人/组队远征选择。NPC保留完整人物点击框，脚底保持在脚点，标签不参与坐标高度。

本版完整生成提示词（参考图为第二版营地）：

> Use case: precise-object-edit. Edit the supplied existing detailed pixel-art fantasy camp background into a deliberately PLANNED PLAYABLE TOWN LAYOUT, preserving the original exact sophisticated pixel-art rendering, fine texture, teal forest at night, warm brass lanterns, aged masonry and cozy dark fantasy timber architecture. Output a full game map background only, landscape nearly square 1296x1216. No UI, no writing, no people, no creatures. The most important change: keep the CENTER clearly EMPTY OF SERVICE BUILDINGS and props, reserve an obvious broad open PORTAL PLAZA, with a turquoise glowing stone arch portal occupying centered x50%, footpoint y43%, top around y20%, and its unobstructed circular rune landing platform centered at x50% y48%. No campfire in the center. The entire rectangle x34%-66%, y29%-66% is the open portal plaza; no market stands, characters, lantern posts or foreground roofs can overlap the portal/approach. A straight wide empty stone avenue x41%-59% runs from the bottom entrance to the portal landing platform, fully walkable, with side branches to service entrances. Service buildings must all be placed ALONG THE OUTER EDGES, oriented toward the open center, exactly SEVEN distinct service nooks, with empty ground reserved immediately in front of each where separate NPC sprites will later stand. Precise normalized NPC footpoint marks (DO NOT draw marks): upper left wizard/book cottage entrance at (19%,30%); upper right teal relic-workshop altar entrance at (80%,30%); middle left blacksmith forge entrance at (15%,53%); middle right chronicler map desk/canopy entrance at (85%,53%); lower left warehouse and crates entrance at (18%,80%); lower right burgundy treasure merchant stall entrance at (84%,76%); bottom right of avenue animal-tamer small leafy stable entrance at (69%,90%). Buildings should sit immediately BEHIND these footpoints and must not cover the empty ground there. Keep all seven entrances recognizable and separated from each other, not merged. Place the stable small and along bottom-right perimeter, entirely right of x61%. Around the outermost edge keep dense detailed pine forest, crumbling walls and subtle lanterns. Broad quiet gray-green paving in central open areas provides excellent contrast for later player sprites. Coherent elevated 3/4 game map view. NO central campfire, NO NPC baked into image, NO labels, NO text, NO UI, NO border. Match all existing asset fidelity, don't simplify into flat vector or coarse pixel blocks.

最终定位按生成图的实际建筑门前地面校准，以上表格与 `npcHall.ts` 为准。

## 第二版素材记录

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

## 旧版四主题战斗地表

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
