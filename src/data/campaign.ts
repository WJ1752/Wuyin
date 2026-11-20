export const CAMPAIGN_CHAPTERS = [
  {
    stage: 1,
    theme: 0,
    bossId: 'grave_king',
    title: '雾门初开',
    objective: '收集紫色进度球召出守墓君王，及时走出他标记的圆形震荡区域。',
    report: [
      '守墓君王倒下时，你的旧铜铃自行响了。回营再摇响它，地图上浮出一条穿过墓园的石路。',
      '岚认出那是守望者过去的归路。去墓园找一找，那里也许还有一盏旧路灯。',
    ],
  },
  {
    stage: 8,
    theme: 1,
    bossId: 'winter_wyrm',
    title: '墓灯回响',
    objective: '横向避开骨龙的扇形冰息，趁它转身时靠近输出。',
    report: [
      '骨龙倒下，冻土露出一截铜灯座。你擦去冰霜，认出了营地石门上同样的刻痕。',
      '岚说灯芯来自余烬熔炉。要让灯再次照出归路，得先取回被熔炉暴君夺走的炉火。',
    ],
  },
  {
    stage: 16,
    theme: 2,
    bossId: 'cinder_lord',
    title: '余烬铸灯',
    objective: '留意熔炉暴君在半血后的第二道扇形烈焰。',
    report: [
      '铁匠用带回的炉火修复了铜灯。灯亮起来的瞬间，雾里浮出一道通往圣殿的门。',
      '岚请你循灯前行。圣殿深处每响一次钟，营地外的路就会被吞掉一截。',
    ],
  },
  {
    stage: 31,
    theme: 3,
    bossId: 'void_abbess',
    title: '雾钟圣殿',
    objective: '侧向离开圣女的直线死光，在她瞬移后重新找准位置。',
    report: [
      '圣女倒下，钟声却从圣殿更深处传来。掌中的铜铃跟着颤动，你看清了雾后盘踞的巨影。',
      '回营穿上为你准备的套装部件，再登上第五十层。只要关掉雾的源头，守望者就能把灯送回旧路。',
    ],
  },
  {
    stage: 50,
    theme: 3,
    bossId: 'mist_devourer',
    title: '长夜尽头',
    objective: '吞雾者濒死时会狂暴，留好位移，走出扩大的虚空预警。',
    report: [
      '吞雾者的身躯散去，钟声停了。你举起铜灯，看见石路从脚下延伸，一直通向依稀亮着灯的营地。',
      '天亮时，岚把一盏灯悬在旧路的第一座石柱上。远处陆续有灯应答。失散的人终于有路可走了。',
    ],
  },
] as const;

export const CAMPAIGN_FINALE = CAMPAIGN_CHAPTERS[CAMPAIGN_CHAPTERS.length - 1];
export type CampaignChapter = (typeof CAMPAIGN_CHAPTERS)[number];

export function getCampaignChapter(stage: number) {
  return CAMPAIGN_CHAPTERS.find((chapter) => chapter.stage === stage);
}

export function getNextCampaignChapter(clearedStage: number) {
  return CAMPAIGN_CHAPTERS.find((chapter) => chapter.stage > clearedStage);
}
