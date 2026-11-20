# 秘境精细像素美术

四地貌分别使用苔岩与灰绿泥、墓砖与青铁、焦灰与冷赭、暗紫石与微青蚀痕。新纹理以小色块和有限抖动压低对比，让战场剪影、紫晶、药瓶和朱砂预警分开。林地路碑、墓园石棺、熔火炉门和虚空残拱安排在通路外侧。有限的环境微粒从地标逸出，减少动态模式关闭微粒。

| 资产 | 发布地址 | 大小与顺序 |
| --- | --- | --- |
| 地貌 | `public/assets/maps/painted/*-floors.webp` | 每地貌 2304×768，三格独立镜像平铺，按层选择道路与底地。每张约 198–315 KiB |
| 敌人 | `public/assets/monsters/painted/bestiary.webp` | 1152×1152，6×6，24 只普通敌人、8 位首领、盗宝者与训练靶，按既有怪物 ID 顺序 |
| 圣坛和地图摆件 | `public/assets/maps/painted/props.webp` | 768×768，4×4，前四格为电击、威能、疾风、引导圣坛，接续地景、灯纹地砖与路碑石棺 |
| 拾取物 | `public/assets/maps/painted/loot.webp` | 384×96，4×1，背袋、铸币、紫晶、治疗瓶 |
| 专属施法 | `public/assets/skills/painted/cast-*.webp` | 每职业 640×320，4×2，40 格依 `CAST_ART` 映射 |
| 共用效果 | `public/assets/skills/painted/shared.webp` | 640×800，4×5，依 `EFFECT_CELLS`、`GROUND_CELLS` 串联 |

敌人的脚点固定在单格高度约 95.6%。步态由移动距离驱动，足迹在落脚时出现。攻击沿真实预警方向预备，打击时前探，受击时短振并激起碎屑，死亡后倾倒下沉。召唤物仍使用同一怪物帧接口。

技能独立绘制飞行弹体、地面持续标记或施法标记。武器轨迹、元素命中、治疗和爆发使用各自的扩张、挪移和衰减时序。危险区域边界按战斗判定单独绘制。组队客机使用同一资源映射渲染序列化施法与效果事件。

最终像素原画由内置 ImageGen 生成。敌人、摆件和特效使用此前版的图集作坐标、姿势与身份参考，在格内重绘色阶和轮廓。地表沿用 `scripts/prepare-ground-art.ts` 的三变体镜像流程，传入最终原画即生成当前发布版。透明剪影按网格裁切和整理脚点，用 Sharp 进行最近邻缩放与 WebP 转码。以下是最终生成提示词。

## 四地貌地表

```text
Use case: stylized-concept.
Asset type: opaque production terrain atlas for original game 雾隐. Exactly square atlas of four equal square cells with no gutters or labels. Draw unmistakable high-detail original 32-bit pixel art. Use a small logical pixel grid of approximately 200 by 200 per quadrant, carefully hand-arranged angular clusters, restrained checker dithering only in transition, disciplined 4–7-value mineral hues, flat overhead orthographic terrain. Dark generous matte surfaces with sparse seams and tiny wear, low contrast for battle visibility. No perspective, lighting pools, large shapes painted as danger symbols, no people or background elements. Top left: desaturated spruce slate soil and gently chipped moss-covered slabs, fine green grey moss. Top right: subdued slate-blue crypt pavers and small traces of weathering, faded gray mortar. Bottom left: near-chalk-brown charcoal basalt slabs with small faded copper ochre residues, no liquid lava or saturated red. Bottom right: dark indigo charcoal-violet old temple slabs with shallow classically engraved lines and low teal patina. Precise hard cell seams at 50% of width and 50% height. No signs, borders, typography, props, characters, lighting effects or watermark. All differences appear through hand-drawn material and individual palette.
```

## 普通敌人上半表

```text
Use case: style-transfer. Image 1 is the edit target and provides ONLY sprite identities, pose, viewing angle and exact cell coordinates. Redraw every sprite from scratch as very clearly visible finely crafted original 32-bit dark fantasy PIXEL ART for the original browser ARPG 雾隐. Think professional late-era 2D hand-drafted game sprites, crisp stepped silhouettes, deliberate small pixel clusters, selective single-pixel tertiary material texture, disciplined hue ramps of 4–6 colors per material. Pixel boundaries must visibly snap to a regular square grid; no photographic rendering, realistic texture scans, painted smooth gradients, volumetric renders or broad cartoon outlines. Approximate logical density 104x104 pixels per sprite, legible at 50–120 game pixels. Materials of charcoal blue, matte iron grey, subdued mineral fir, pale ivory and restrained tarnished brass. Thin cream/gray highlights on enemy silhouettes, avoid full-face pure blacks. No hot candy neon. Preserve exact cell order, count, camera, each silhouette and foot position from the template. Keep all pixels within their own cell with generous zero-alpha margins. True transparent RGBA; no backdrop, text, visible separators or floor.
4 columns by 3 rows. Twelve ordinary enemies, including the swordguard, skeletal bowman, corpse walker and poison tick in row 1. Preserve readable generous outline length and keep silhouettes distinct.
```

## 普通敌人下半表

```text
Use case: style-transfer. Image 1 is the edit target and provides ONLY sprite identities, pose, viewing angle and exact cell coordinates. Redraw every sprite from scratch as very clearly visible finely crafted original 32-bit dark fantasy PIXEL ART for the original browser ARPG 雾隐. Think professional late-era 2D hand-drafted game sprites, crisp stepped silhouettes, deliberate small pixel clusters, selective single-pixel tertiary material texture, disciplined hue ramps of 4–6 colors per material. Pixel boundaries must visibly snap to a regular square grid; no photographic rendering, realistic texture scans, painted smooth gradients, volumetric renders or broad cartoon outlines. Approximate logical density 104x104 pixels per sprite, legible at 50–120 game pixels. Materials of charcoal blue, matte iron grey, subdued mineral fir, pale ivory and restrained tarnished brass. Thin cream/gray highlights on enemy silhouettes, avoid full-face pure blacks. No hot candy neon. Preserve exact cell order, count, camera, each silhouette and foot position from the template. Keep all pixels within their own cell with generous zero-alpha margins. True transparent RGBA; no backdrop, text, visible separators or floor.
4 columns by 3 rows, twelve ordinary enemies. Upper-left thorn elemental, upper-right armoured fallen knight, middle-right single-eyed eldritch horror, lower-right coiled serpent. Retain all silhouettes and frame them completely.
```

## 首领、盗宝者和训练靶

```text
Use case: style-transfer. Image 1 is the edit target and provides ONLY sprite identities, pose, viewing angle and exact cell coordinates. Redraw every sprite from scratch as very clearly visible finely crafted original 32-bit dark fantasy PIXEL ART for the original browser ARPG 雾隐. Think professional late-era 2D hand-drafted game sprites, crisp stepped silhouettes, deliberate small pixel clusters, selective single-pixel tertiary material texture, disciplined hue ramps of 4–6 colors per material. Pixel boundaries must visibly snap to a regular square grid; no photographic rendering, realistic texture scans, painted smooth gradients, volumetric renders or broad cartoon outlines. Approximate logical density 104x104 pixels per sprite, legible at 50–120 game pixels. Materials of charcoal blue, matte iron grey, subdued mineral fir, pale ivory and restrained tarnished brass. Thin cream/gray highlights on enemy silhouettes, avoid full-face pure blacks. No hot candy neon. Preserve exact cell order, count, camera, each silhouette and foot position from the template. Keep all pixels within their own cell with generous zero-alpha margins. True transparent RGBA; no backdrop, text, visible separators or floor.
4 columns by 3 rows. First eight sprites are towering one-phase bosses with a higher level of detail and broad readable geometry. Third row contains the leather-pack goblin, battered training target, woodland lantern milestone and low sarcophagus, in that order. Keep all the delicate effects within each equal cell.
```

## 圣坛、地景与拾取物

```text
Use case: style-transfer. Image 1 is the edit target and provides ONLY sprite identities, pose, viewing angle and exact cell coordinates. Redraw every sprite from scratch as very clearly visible finely crafted original 32-bit dark fantasy PIXEL ART for the original browser ARPG 雾隐. Think professional late-era 2D hand-drafted game sprites, crisp stepped silhouettes, deliberate small pixel clusters, selective single-pixel tertiary material texture, disciplined hue ramps of 4–6 colors per material. Pixel boundaries must visibly snap to a regular square grid; no photographic rendering, realistic texture scans, painted smooth gradients, volumetric renders or broad cartoon outlines. Approximate logical density 104x104 pixels per sprite, legible at 50–120 game pixels. Materials of charcoal blue, matte iron grey, subdued mineral fir, pale ivory and restrained tarnished brass. Thin cream/gray highlights on enemy silhouettes, avoid full-face pure blacks. No hot candy neon. Preserve exact cell order, count, camera, each silhouette and foot position from the template. Keep all pixels within their own cell with generous zero-alpha margins. True transparent RGBA; no backdrop, text, visible separators or floor.
4 columns by 4 rows. Preserve specific identity of the four shrines and all terrain props. Final row must be leather pouch, copper coins, muted lilac diamond, squat dark scarlet health bottle with a pale cross. Keep even footpoints, and ensure potion and purple crystal can be distinguished by shape in a 20 pixel in-game icon.
```

## 游侠专属效果

```text
Use case: style-transfer.
Image 1 is the only edit target and supplies exact cell grid, skill identity, orientation and approximate silhouettes. Completely redraw each skill effect in crisp, immediately recognizable original 32-bit dark-fantasy PIXEL ART for the game 雾隐. Sharp regular square pixel edges, deliberate small clustered palette steps, individually drawn glowing pixel sparks and islands of dithered smoke on sparse alpha. Per-sprite density about 80–110 logical pixels, readily readable at 30–110 world pixels. Dark charcoal blue, restrained weathered brass, desaturated elemental highlights and sparse ivory glints. Maintain directional read and clear outlines. No smooth realistic painterly gradients, no neon mesh, no glossy 3D VFX. Keep all silhouettes within their exact cells, each on completely transparent RGB alpha with empty gutters. Do not add scenery, opaque background, lettering, symbols other than extant skill rune, borders or a checkerboard. Not a simple pixelation filter, actively articulate distinct pixel shapes by hand.
4 columns, 2 rows. Each bow projectile points right. Preserve ochre shaft, ember burst arrow, triple streak, blue-gray elemental prop, tumbling dust, falling arrows, a flying raven and amber vengeance crest in the exact given positions.
```

## 野蛮人专属效果

```text
Use case: style-transfer.
Image 1 is the only edit target and supplies exact cell grid, skill identity, orientation and approximate silhouettes. Completely redraw each skill effect in crisp, immediately recognizable original 32-bit dark-fantasy PIXEL ART for the game 雾隐. Sharp regular square pixel edges, deliberate small clustered palette steps, individually drawn glowing pixel sparks and islands of dithered smoke on sparse alpha. Per-sprite density about 80–110 logical pixels, readily readable at 30–110 world pixels. Dark charcoal blue, restrained weathered brass, desaturated elemental highlights and sparse ivory glints. Maintain directional read and clear outlines. No smooth realistic painterly gradients, no neon mesh, no glossy 3D VFX. Keep all silhouettes within their exact cells, each on completely transparent RGB alpha with empty gutters. Do not add scenery, opaque background, lettering, symbols other than extant skill rune, borders or a checkerboard. Not a simple pixelation filter, actively articulate distinct pixel shapes by hand.
4 columns, 2 rows. Keep distinct silhouettes for crossed axe blows, blunt smash, circular whirlwind, downward rock hammer, pointing-right iron hook, chant wave, directional charge wedge and rising bronze berserker arch.
```

## 魔法师专属效果

```text
Use case: style-transfer.
Image 1 is the only edit target and supplies exact cell grid, skill identity, orientation and approximate silhouettes. Completely redraw each skill effect in crisp, immediately recognizable original 32-bit dark-fantasy PIXEL ART for the game 雾隐. Sharp regular square pixel edges, deliberate small clustered palette steps, individually drawn glowing pixel sparks and islands of dithered smoke on sparse alpha. Per-sprite density about 80–110 logical pixels, readily readable at 30–110 world pixels. Dark charcoal blue, restrained weathered brass, desaturated elemental highlights and sparse ivory glints. Maintain directional read and clear outlines. No smooth realistic painterly gradients, no neon mesh, no glossy 3D VFX. Keep all silhouettes within their exact cells, each on completely transparent RGB alpha with empty gutters. Do not add scenery, opaque background, lettering, symbols other than extant skill rune, borders or a checkerboard. Not a simple pixelation filter, actively articulate distinct pixel shapes by hand.
4 columns, 2 rows. Preserve branching lightning, original pointed violet dart, descending molten stone, ice orb, vertical rift, violet vortex, frost shatter circle and standing invocation crown. Sharp luminous clusters and no semiopaque field outside the effects.
```

## 魂灵师专属效果

```text
Use case: style-transfer.
Image 1 is the only edit target and supplies exact cell grid, skill identity, orientation and approximate silhouettes. Completely redraw each skill effect in crisp, immediately recognizable original 32-bit dark-fantasy PIXEL ART for the game 雾隐. Sharp regular square pixel edges, deliberate small clustered palette steps, individually drawn glowing pixel sparks and islands of dithered smoke on sparse alpha. Per-sprite density about 80–110 logical pixels, readily readable at 30–110 world pixels. Dark charcoal blue, restrained weathered brass, desaturated elemental highlights and sparse ivory glints. Maintain directional read and clear outlines. No smooth realistic painterly gradients, no neon mesh, no glossy 3D VFX. Keep all silhouettes within their exact cells, each on completely transparent RGB alpha with empty gutters. Do not add scenery, opaque background, lettering, symbols other than extant skill rune, borders or a checkerboard. Not a simple pixelation filter, actively articulate distinct pixel shapes by hand.
4 columns, 2 rows. Order of bone spikes, drain thread, mourning scythe, bone spear, bone ring, curse rune, blood-step stroke and phantom souls ring is fixed. Moon-bone ivory and mineral greens. Keep the surrounding alpha completely clear.
```

## 德鲁伊专属效果

```text
Use case: style-transfer.
Image 1 is the only edit target and supplies exact cell grid, skill identity, orientation and approximate silhouettes. Completely redraw each skill effect in crisp, immediately recognizable original 32-bit dark-fantasy PIXEL ART for the game 雾隐. Sharp regular square pixel edges, deliberate small clustered palette steps, individually drawn glowing pixel sparks and islands of dithered smoke on sparse alpha. Per-sprite density about 80–110 logical pixels, readily readable at 30–110 world pixels. Dark charcoal blue, restrained weathered brass, desaturated elemental highlights and sparse ivory glints. Maintain directional read and clear outlines. No smooth realistic painterly gradients, no neon mesh, no glossy 3D VFX. Keep all silhouettes within their exact cells, each on completely transparent RGB alpha with empty gutters. Do not add scenery, opaque background, lettering, symbols other than extant skill rune, borders or a checkerboard. Not a simple pixelation filter, actively articulate distinct pixel shapes by hand.
4 columns, 2 rows. Retain all shapes and positions of fir claw marks, steel throwing knife, fan of spreading blades, thorn vines, shadow trail, twin winding gusts, earthy stone crest and distinctive cyan wolf-shaped invocation.
```

## 共用战斗效果

```text
Use case: style-transfer.
Image 1 is the only edit target and supplies exact cell grid, skill identity, orientation and approximate silhouettes. Completely redraw each skill effect in crisp, immediately recognizable original 32-bit dark-fantasy PIXEL ART for the game 雾隐. Sharp regular square pixel edges, deliberate small clustered palette steps, individually drawn glowing pixel sparks and islands of dithered smoke on sparse alpha. Per-sprite density about 80–110 logical pixels, readily readable at 30–110 world pixels. Dark charcoal blue, restrained weathered brass, desaturated elemental highlights and sparse ivory glints. Maintain directional read and clear outlines. No smooth realistic painterly gradients, no neon mesh, no glossy 3D VFX. Keep all silhouettes within their exact cells, each on completely transparent RGB alpha with empty gutters. Do not add scenery, opaque background, lettering, symbols other than extant skill rune, borders or a checkerboard. Not a simple pixelation filter, actively articulate distinct pixel shapes by hand.
4 columns, 5 rows. Keep all twenty shapes and positions without moving any cell. Preserve directional projectile design, silver and ivory for the 12 reusable tintable impact/projectile shapes. Floor effects below them stay low contrast. Glass red inward shapes and the red directional floor line/cone in the last two rows are hostile warnings, keep cinnabar accents specific to those three cells. Retain the slender pale loot ray and small crystal glimmer in the last two cells. Do not turn FX into flat icons.
```
