export interface NpcArt {
  src: string;
  description: string;
}

/** Original service characters; each NPC has its own silhouette and equipment. */
export const NPC_ART: Record<string, NpcArt> = {
  mentor: { src: '/assets/npcs/mentor.svg', description: '戴星纹高帽、捧发光魔法书的星语导师' },
  cube: { src: '/assets/npcs/cube.svg', description: '遮脸长袍、双手托起悬浮棱晶的遗物守望者' },
  chronicler: {
    src: '/assets/npcs/chronicler.svg',
    description: '戴文官帽、手持羽笔与远征卷轴的记录官',
  },
  smith: { src: '/assets/npcs/smith.svg', description: '身穿厚皮围裙、肩扛重锤的粗壮铁匠' },
  mia: { src: '/assets/npcs/mia.svg', description: '戴兜帽、佩货袋与金币的秘藏商人米娅' },
  keeper: { src: '/assets/npcs/keeper.svg', description: '穿宽背心、持黄铜钥匙与木箱的仓库管理员' },
  tamer: {
    src: '/assets/npcs/tamer.svg',
    description: '戴鹿角、披叶纹斗篷并带着小狐狸的荒野契约师',
  },
};
