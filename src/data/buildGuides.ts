export interface BuildGuide {
  style: string;
  range: string;
  rotation: string;
  tip: string;
}

/** Shared by the build laboratory and the reproducible playability report. */
export const BUILD_GUIDES: Record<string, BuildGuide> = {
  stormcaller: {
    style: '箭雨覆盖',
    range: '中远距，围绕落点移动',
    rotation: '箭雨保持 AUTO，引怪进入落区；精英出现时开启复仇。',
    tip: '箭雨命中才能回能，怪群离开落区时及时调整路线。',
  },
  marauder: {
    style: '弹幕叠层',
    range: '中距，让箭矢穿过怪群',
    rotation: '连弩保持 AUTO 连续叠弹幕，翻滚手动补能或避险。',
    tip: '保留基础回能箭；额外开启其他核心会争用集中与施法时间。',
  },
  frost_hunter: {
    style: '冰霜穿透',
    range: '中远距，沿怪群射线移动',
    rotation: '元素箭 AUTO，追猎箭的寒冰分支先减速，再用冰矢穿群。',
    tip: '四件增伤依赖减速或冻结，目标分散与控制空窗会降低收益。',
  },
  wasteland: {
    style: '移动旋风',
    range: '近距，沿怪群边缘旋转',
    rotation: '旋风 AUTO，持续移动覆盖怪群；手动冲锋后4秒内四道龙卷全部追踪敌人。',
    tip: '成型续能依赖布尔凯索；未取得该传奇时仍需基础攻击回怒。',
  },
  earthbreaker: {
    style: '血球叠锤',
    range: '近距，主动拾取血球',
    rotation: '先祖之锤 AUTO，边打边捡生命血球叠裂变，再集中打精英。',
    tip: '不拾取血球就没有四件叠层；远距离空挥也无法维持怒气循环。',
  },
  immortal_thorns: {
    style: '护甲荆棘',
    range: '近距推进，战吼覆盖周围',
    rotation: '战吼 AUTO 引爆荆棘，基础攻击维持命中附带荆棘。',
    tip: '护甲也是伤害来源；战吼改手动后需要主动引爆。',
  },
  tal_rasha: {
    style: '连环陨石',
    range: '中远距，聚怪后轰炸',
    rotation: '陨石 AUTO，移动聚怪让连环落点重叠，传送留给避险。',
    tip: '散怪会削弱重叠命中；免费陨石补充主动施法空窗。',
  },
  delsere: {
    style: '冰球冻结',
    range: '中距，让冰球穿过目标',
    rotation: '冰封球 AUTO，寒冰新星冻结后利用传送刷新调整射线。',
    tip: '慢速冰球依赖路径与目标位置，刷新的传送仍需手动施放。',
  },
  vyr: {
    style: '死光升温',
    range: '中距，黑洞聚怪后持续命中',
    rotation: '执政官与电刑保持 AUTO，变身后连续死光叠层。',
    tip: '每次变身重置激光层数；基础技能改手动会中断自动死光。',
  },
  rathma: {
    style: '骸骨自爆',
    range: '带召唤物接近怪群',
    rotation: '号令骸骨 AUTO，等召唤物跟进后循环自爆，血步手动追敌。',
    tip: '自爆从召唤物当前位置结算，刚转火时需要留出跟随时间。',
  },
  trang_oul: {
    style: '毒镰叠层',
    range: '近距，同时扫过多个目标',
    rotation: '死亡镰刀 AUTO，连续叠毒触发五层新星；血步后4秒内毒镰额外叠层，再借传染清群。',
    tip: '强项是群体叠毒；保留骨刺回能，目标分散与单体战需要持续叠层。',
  },
  inarius: {
    style: '骨风暴环绕',
    range: '敌人保持在身边150范围内',
    rotation: '骨矛 AUTO，带骷髅军团近身推进，让敌人留在骨风暴内。',
    tip: '骨矛能射到远处，但风暴圈外无法获得四件核心增伤。',
  },
  shadow_blades: {
    style: '移动刀扇',
    range: '沿怪群边缘持续移动',
    rotation: '移动触发免费刀扇，利用飞刀往返穿刺；暗影步手动强化后续攻击。',
    tip: '停步会失去每0.8秒的免费刀扇；暗影步强化需玩家主动触发。',
  },
  wild_vines: {
    style: '毒藤传播',
    range: '中距，先给密集怪群上毒',
    rotation: '毒藤 AUTO，上毒后击杀传播，持续移动等待孢子与毒伤生效。',
    tip: '四件增伤先要中毒；单体首领没有小怪击杀带来的传播加速。',
  },
  storm_wolf: {
    style: '常驻狼爪',
    range: '近距追击，避开首领预警',
    rotation: '风暴爪击 AUTO，常驻狼形态中连续攻击，暗影步手动避险或强化。',
    tip: '核心槽默认手动以保证爪击频率；额外核心会争用攻击节奏。',
  },
};
