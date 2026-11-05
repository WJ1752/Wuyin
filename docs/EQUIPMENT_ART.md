# 装备外观审计

游戏按外观键识别装备。实装图集包含 221 个非空像素格，主手、副手、头、胸、手、腿、脚和饰品均可显示。背包、装备槽与地面掉落复用同一格；组队掉落帧传递经目录校验的外观键。旧帧有槽位时回退到该部位的普通外观，仅有物品类型时显示通用标记。

| 来源 | 核对结果 | 共用规则 |
|---|---|---|
| 普通装备 | 7 个系列 × 8 个部位，56 种 | 同槽同系列的不同等级和词条复用外观 |
| 套装 | 15 套 × 5 个实际护甲部位，75 件 | 图集另含主手、副手、饰品的 45 个预留格 |
| 传奇 | 45 个目录条目，45 个外观键 | 太古版本沿用该件传奇的形状 |
| 合计 | 176 个实际目录组合，另有 45 个预留格 | 外观数量与随机生成的物品实例数分别统计 |

装备美术以 A 版面板为参照重绘了 25 种轮廓，覆盖弓弩、骨镰、双斧、锤杖、法器、皮甲、钢盔和首饰等。钢、皮和木保留本色，角上的像素徽记表示系列、套装或传奇身份。装备图标仅用于识别物品。职业原画自带服装和武器，穿戴物品不改变角色图像。亮色光柱保留给传奇、套装与太古掉落。

源图在 `public/assets/maps/equipment-shapes.png`。运行 `pnpm exec tsx scripts/generate-equipment-atlas.ts` 可按稳定目录重建游戏图集。下表中的套装八槽是渲染覆盖数，实际掉落的五槽是头、胸、手、腿和脚。

## 自动核对清单（45 传奇，15 套装）

### 普通装备

| 系列 | 部位覆盖 | 组合数 |
|---|---|---:|
| common（旅人） | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| uncommon（守望） | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| rare（暮色） | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| epic（幽影） | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| legendary（圣遗） | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| set（契约） | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| primal（永恒） | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |

### 套装

| ID | 名称 | 职业 | 部位覆盖 | 可掉落槽位数 |
|---|---|---|---|---:|
| stormcaller | 风暴召唤者 | ranger | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| marauder | 掠夺者战甲 | ranger | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| frost_hunter | 极寒猎手 | ranger | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| wasteland | 荒原狂风 | barbarian | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| earthbreaker | 大地裂变 | barbarian | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| immortal_thorns | 不朽荆棘 | barbarian | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| tal_rasha | 塔拉夏元素 | sorcerer | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| delsere | 德尔西尼冰霜 | sorcerer | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| vyr | 维尔御法者 | sorcerer | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| rathma | 拉斯玛骨爆 | necromancer | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| trang_oul | 塔格奥毒镰 | necromancer | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| inarius | 伊纳瑞斯圣骨 | necromancer | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| shadow_blades | 暗影利刃 | druid | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| wild_vines | 荒野毒藤 | druid | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| storm_wolf | 风暴狼神 | druid | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |

### 传奇

| ID | 名称 | 部位 | 职业限制 | 图标映射 |
|---|---|---|---|---|
| oraviel | 奥拉维尔之手 | 护手 | 通用 | 已映射 |
| immortal_armor | 不灭战铠 | 胸甲 | 通用 | 已映射 |
| olda | 奥尔达之裤 | 护腿 | 通用 | 已映射 |
| sacred_walkers | 神圣行者战靴 | 战靴 | 通用 | 已映射 |
| aquila | 天鹰胸甲 | 胸甲 | 通用 | 已映射 |
| elements | 元素嘉年华之戒 | 首饰 | 通用 | 已映射 |
| zodiac | 黄道黑曜石之戒 | 首饰 | 通用 | 已映射 |
| berserker_charm | 狂暴者护符 | 首饰 | 通用 | 已映射 |
| nemesis | 复仇者护腕 | 护手 | 通用 | 已映射 |
| squirt | 斯奎特的项链 | 首饰 | 通用 | 已映射 |
| dawn | 黎明手弩 | 主手武器 | ranger | 已映射 |
| yang | 沃杨强弓 | 主手武器 | ranger | 已映射 |
| dead_mans | 亡者遗物箭袋 | 副手 | ranger | 已映射 |
| ninth_satchel | 第九哨站箭匣 | 副手 | ranger | 已映射 |
| froststring | 霜语长弓 | 主手武器 | ranger | 已映射 |
| ravenwing | 渡鸦之翼 | 副手 | ranger | 已映射 |
| windforce | 风之力 | 主手武器 | ranger | 已映射 |
| bulkathos | 布尔凯索双刀 | 主手武器 | barbarian | 已映射 |
| judgment | 审判之锤 | 主手武器 | barbarian | 已映射 |
| lamentation | 哀恸之刃 | 主手武器 | barbarian | 已映射 |
| gavel | 毁灭木槌 | 副手 | barbarian | 已映射 |
| pride | 卡修斯之傲 | 副手 | barbarian | 已映射 |
| oathkeeper | 守誓者 | 主手武器 | barbarian | 已映射 |
| shield_of_ancients | 先祖壁垒 | 副手 | barbarian | 已映射 |
| grand_vizier | 大维兹尔之杖 | 主手武器 | sorcerer | 已映射 |
| endless_depths | 无尽深渊法珠 | 副手 | sorcerer | 已映射 |
| deathwish | 绝命法杖 | 主手武器 | sorcerer | 已映射 |
| etched_sigil | 蚀刻符印 | 副手 | sorcerer | 已映射 |
| serpent_spark | 蛇影雷杖 | 主手武器 | sorcerer | 已映射 |
| winterglass | 凛冬之镜 | 副手 | sorcerer | 已映射 |
| cosmic_strand | 星界之丝 | 副手 | sorcerer | 已映射 |
| jesseth | 杰瑟斯骨镰 | 主手武器 | necromancer | 已映射 |
| corroded_fang | 腐蚀之牙 | 主手武器 | necromancer | 已映射 |
| reilena | 莱莲娜影镰 | 主手武器 | necromancer | 已映射 |
| nayr | 奈尔的黑镰 | 主手武器 | necromancer | 已映射 |
| bone_relic | 碎骨圣匣 | 副手 | necromancer | 已映射 |
| bloodtide | 血潮之灯 | 副手 | necromancer | 已映射 |
| funerary_pick | 丧葬之镰 | 主手武器 | necromancer | 已映射 |
| greenstone | 格林斯通刀扇匕首 | 主手武器 | druid | 已映射 |
| venom_source | 剧毒之源图腾 | 副手 | druid | 已映射 |
| moonfang | 月之獠牙 | 主手武器 | druid | 已映射 |
| stormheart | 风暴之心 | 副手 | druid | 已映射 |
| plaguebranch | 瘟疫枝杈 | 副手 | druid | 已映射 |
| shadowfang | 暗影之牙 | 主手武器 | druid | 已映射 |
| earthward | 地脉守卫 | 副手 | druid | 已映射 |
