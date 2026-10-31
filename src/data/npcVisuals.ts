export interface NpcArt {
  src: string;
  description: string;
  column: number;
  row: number;
}

export const NPC_ATLAS = './assets/npcs/watchers-v2.png';

/** Original service characters; each NPC has its own silhouette and equipment. */
export const NPC_ART: Record<string, NpcArt> = {
  mentor: { src: NPC_ATLAS, column: 0, row: 0, description: '戴星纹高帽、捧发光魔法书的星语导师' },
  cube: {
    src: NPC_ATLAS,
    column: 1,
    row: 0,
    description: '遮脸长袍、双手托起悬浮棱晶的遗物守望者',
  },
  chronicler: {
    src: NPC_ATLAS,
    column: 2,
    row: 0,
    description: '戴文官帽、手持羽笔与远征卷轴的记录官',
  },
  smith: { src: NPC_ATLAS, column: 3, row: 0, description: '身穿厚皮围裙、肩扛重锤的粗壮铁匠' },
  mia: { src: NPC_ATLAS, column: 0, row: 1, description: '戴兜帽、佩货袋与金币的秘藏商人米娅' },
  keeper: {
    src: NPC_ATLAS,
    column: 1,
    row: 1,
    description: '穿宽背心、持黄铜钥匙与木箱的仓库管理员',
  },
  tamer: {
    src: NPC_ATLAS,
    column: 2,
    row: 1,
    description: '戴鹿角、披叶纹斗篷并带着小狐狸的荒野契约师',
  },
};
