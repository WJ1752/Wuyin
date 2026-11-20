# 装备外观审计

游戏按外观键识别装备。图集包含 231 个物件格，主手、副手、头、胸、手、腿、脚和饰品均可显示。背包、装备槽与地面掉落复用同一格。组队掉落帧传递经目录校验的外观键。旧帧有槽位时回退到该部位的普通外观，仅有物品类型时显示通用标记。

| 来源 | 核对结果 | 共用规则 |
|---|---|---|
| 普通装备 | 7 个系列 × 8 个部位，56 种 | 通用护甲、首饰和旧档普通主副手按系列与部位显示 |
| 职业主副手 | 5 个职业 × 2 个部位，10 种 | 新产出普通主副手按所属职业佩戴，稀有度仍由颜色与名称区分 |
| 套装 | 15 套 × 5 个实际护甲部位，75 件 | 图集另含主手、副手、饰品的 45 个预留格 |
| 传奇 | 45 个目录条目，45 个外观键 | 太古版本沿用该件传奇的形状 |
| 合计 | 186 个实际目录组合，另有 45 个预留格 | 外观数量与随机生成的物品实例数分别统计 |

25 种手绘像素轮廓涵盖弓弩、骨镰、刀斧、锤杖、法器、皮甲、钢盔和首饰。钢、皮和木保留本色，角上的像素法印标识系列、套装与传奇。套装与传奇按稳定模板 ID 在读档时更新展示名。账号仓库可收纳所有职业的装备。

源图与生成提示词见 [界面美术](UI_ART.md)。运行 `pnpm exec tsx scripts/generate-equipment-atlas.ts` 可按稳定目录重建游戏图集。下表中的套装八槽是渲染覆盖数，实际掉落的五槽是头、胸、手、腿和脚。

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

### 职业主副手

| 职业 | 主手 | 副手 |
|---|---|---|
| 游侠 | 雾梢长弓 | 哨羽箭袋 |
| 野蛮人 | 铆脊战锤 | 界石圆盾 |
| 魔法师 | 折星法杖 | 棱镜法珠 |
| 魂灵师 | 渡骨长镰 | 巡冥提灯 |
| 德鲁伊 | 狼脊双刃 | 古根图腾 |

### 套装

| ID | 名称 | 职业 | 部位覆盖 | 图集槽位数 |
|---|---|---|---|---:|
| stormcaller | 长夜天巡 | ranger | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| marauder | 断关连弩卫 | ranger | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| frost_hunter | 雪脊猎团 | ranger | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| wasteland | 裂嶂风裔 | barbarian | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| earthbreaker | 赤脉砧卫 | barbarian | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| immortal_thorns | 荆碑铁誓 | barbarian | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| tal_rasha | 碎星仪环 | sorcerer | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| delsere | 寒镜星院 | sorcerer | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| vyr | 无昼辉冠 | sorcerer | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| rathma | 归名骨卫 | necromancer | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| trang_oul | 沼碑毒镰 | necromancer | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| inarius | 沉钟白骨 | necromancer | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| shadow_blades | 月隐双刃 | druid | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| wild_vines | 烬林根语 | druid | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |
| storm_wolf | 雷脊狼裔 | druid | 主手武器、副手、头盔、胸甲、护手、护腿、战靴、首饰 | 8 |

### 传奇

| ID | 名称 | 部位 | 职业限制 | 图标映射 |
|---|---|---|---|---|
| oraviel | 听刃手套 | 护手 | 通用 | 已映射 |
| immortal_armor | 不灭战铠 | 胸甲 | 通用 | 已映射 |
| olda | 血辙绑腿 | 护腿 | 通用 | 已映射 |
| sacred_walkers | 踏灰战靴 | 战靴 | 通用 | 已映射 |
| aquila | 巡崖羽甲 | 胸甲 | 通用 | 已映射 |
| elements | 六候轮戒 | 首饰 | 通用 | 已映射 |
| zodiac | 回钟墨晶戒 | 首饰 | 通用 | 已映射 |
| berserker_charm | 狂暴者护符 | 首饰 | 通用 | 已映射 |
| nemesis | 叩敌护腕 | 护手 | 通用 | 已映射 |
| squirt | 静灯项坠 | 首饰 | 通用 | 已映射 |
| dawn | 晨哨手弩 | 主手武器 | ranger | 已映射 |
| yang | 檐雨强弓 | 主手武器 | ranger | 已映射 |
| dead_mans | 绝哨箭袋 | 副手 | ranger | 已映射 |
| ninth_satchel | 第九哨站箭匣 | 副手 | ranger | 已映射 |
| froststring | 霜语长弓 | 主手武器 | ranger | 已映射 |
| ravenwing | 渡鸦之翼 | 副手 | ranger | 已映射 |
| windforce | 断崖鸣弓 | 主手武器 | ranger | 已映射 |
| bulkathos | 双誓山刃 | 主手武器 | barbarian | 已映射 |
| judgment | 审判之锤 | 主手武器 | barbarian | 已映射 |
| lamentation | 泣铁战刃 | 主手武器 | barbarian | 已映射 |
| gavel | 裂碑副槌 | 副手 | barbarian | 已映射 |
| pride | 立誓旧盾 | 副手 | barbarian | 已映射 |
| oathkeeper | 刻誓长刃 | 主手武器 | barbarian | 已映射 |
| shield_of_ancients | 先祖壁垒 | 副手 | barbarian | 已映射 |
| grand_vizier | 暮星秤杖 | 主手武器 | sorcerer | 已映射 |
| endless_depths | 沉潮法珠 | 副手 | sorcerer | 已映射 |
| deathwish | 禁式引杖 | 主手武器 | sorcerer | 已映射 |
| etched_sigil | 折空符珠 | 副手 | sorcerer | 已映射 |
| serpent_spark | 蛇影雷杖 | 主手武器 | sorcerer | 已映射 |
| winterglass | 凛冬之镜 | 副手 | sorcerer | 已映射 |
| cosmic_strand | 缝星法珠 | 副手 | sorcerer | 已映射 |
| jesseth | 归名骨镰 | 主手武器 | necromancer | 已映射 |
| corroded_fang | 酸雨龙牙镰 | 主手武器 | necromancer | 已映射 |
| reilena | 付影冥镰 | 主手武器 | necromancer | 已映射 |
| nayr | 饥岁黑镰 | 主手武器 | necromancer | 已映射 |
| bone_relic | 碎骨圣匣 | 副手 | necromancer | 已映射 |
| bloodtide | 逆潮提灯 | 副手 | necromancer | 已映射 |
| funerary_pick | 空冢长镰 | 主手武器 | necromancer | 已映射 |
| greenstone | 绿炉裂影匕 | 主手武器 | druid | 已映射 |
| venom_source | 剧毒之源图腾 | 副手 | druid | 已映射 |
| moonfang | 月之獠牙 | 主手武器 | druid | 已映射 |
| stormheart | 风暴之心 | 副手 | druid | 已映射 |
| plaguebranch | 瘟疫枝杈 | 副手 | druid | 已映射 |
| shadowfang | 暗影之牙 | 主手武器 | druid | 已映射 |
| earthward | 地脉守卫 | 副手 | druid | 已映射 |
