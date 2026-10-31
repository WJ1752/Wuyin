import { writeFileSync } from 'node:fs';
import type { Item, SkillDef } from '../src/core/types';
import { CLASSES } from '../src/data/classes';
import { LEGENDARIES } from '../src/data/legendaries';
import { SETS } from '../src/data/sets';
import { BUILD_GUIDES } from '../src/data/buildGuides';
import { runRift } from '../tests/helpers/combatHarness';

const rows = SETS.map((set) => {
  let activeGap = 0;
  let maxActiveGap = 0;
  let previousCasts = 0;
  let minimumHp = 1;
  let readyCoreSeconds = 0;
  let blockedCoreSeconds = 0;
  let normalCasts = 0;
  const castCounts: Record<string, number> = {};
  let skills: { id: string; name: string; auto: boolean }[] = [];
  let worn: string[] = [];
  let cube: string[] = [];
  let core: SkillDef | undefined;
  let coreAuto = false;
  const rift = runRift(set.id, 100, {
    setup(engine) {
      skills = engine.skills.map((skill: SkillDef) => ({
        id: skill.id,
        name: skill.name,
        auto: engine.config.autoSkills[skill.id] !== false && skill.kind !== 'movement',
      }));
      worn = Object.values(engine.config.equipment as Record<string, Item>)
        .filter((item) => item.legendaryId)
        .map((item) => LEGENDARIES.find((def) => def.id === item.legendaryId)!.name);
      cube = Object.values(engine.config.cube as Record<string, string>).map(
        (id) => LEGENDARIES.find((def) => def.id === id)!.name,
      );
      core = engine.skills.find((skill: SkillDef) => skill.kind === 'core');
      coreAuto = !!core && engine.config.autoSkills[core.id] !== false;
      const perform = engine.perform.bind(engine);
      engine.perform = (skill: SkillDef, free: boolean, multiplier?: number) => {
        const before = engine.attackCount;
        const result = perform(skill, free, multiplier);
        if (!free && engine.attackCount > before) {
          normalCasts++;
          castCounts[skill.id] = (castCounts[skill.id] ?? 0) + 1;
        }
        return result;
      };
    },
    frame(engine, dt) {
      minimumHp = Math.min(minimumHp, Math.max(0, engine.hp / engine.config.stats.hp));
      const nearEnemy = engine.enemies.some(
        (enemy: { hp: number; x: number; y: number }) =>
          enemy.hp > 0 && engine.distance(enemy) < 420,
      );
      if (nearEnemy) {
        activeGap += dt;
        maxActiveGap = Math.max(maxActiveGap, activeGap);
        if (core && coreAuto && !engine.cooldowns[core.id]) {
          readyCoreSeconds += dt;
          if (engine.resource < engine.getSkillCost(core.id)) blockedCoreSeconds += dt;
        }
      }
      if (!nearEnemy || engine.attackCount !== previousCasts) activeGap = 0;
      previousCasts = engine.attackCount;
    },
  });
  const row = {
    id: set.id,
    name: set.name,
    className: CLASSES.find((def) => def.id === set.classId)!.name,
    mainSkill: set.skillId,
    ...rift,
    normalCasts,
    castCounts,
    maxActiveGap,
    minimumHp,
    coreAuto,
    coreName: core?.name,
    readyCoreSeconds,
    blockedCoreSeconds,
    blockedCoreRatio: readyCoreSeconds ? blockedCoreSeconds / readyCoreSeconds : 0,
    skills,
    worn,
    cube,
    play: BUILD_GUIDES[set.id].rotation,
    risk: BUILD_GUIDES[set.id].tip,
  };
  console.log(`${set.name}: ${rift.won ? '通关' : '未通关'} ${rift.seconds.toFixed(1)}s`);
  return row;
});

const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Hong_Kong' }).format(new Date());
const passed = rows.filter((row) => row.won).length;
const report = `# 配装与技能流派游玩流畅性报告

日期：${date}。复现命令：\`pnpm exec tsx scripts/audit-playability.ts\`。本次只运行一轮十五套专项测量。

## 结论与测量边界

十五套成型配装中，${passed}/15 套通过本轮100层战斗模拟。以下数据来自真实 GameEngine、怪物/首领 AI、自动施法、碰撞、资源、套装与传奇结算；画面、音频与敌人绘图使用现有 combatHarness 替身。它检验战斗循环，不代表人类完整实玩、设备帧率、触屏手感或150层平衡。界面验收由本轮主验收记录补充。

本轮耗时${Math.min(...rows.map((row) => row.seconds)).toFixed(1)}–${Math.max(...rows.map((row) => row.seconds)).toFixed(1)}秒，近敌主动施法最长间隔均不超过${Math.max(...rows.map((row) => row.maxActiveGap)).toFixed(2)}秒。连弩与元素箭存在短暂缺能窗口，仍可回退基础攻击，未观察到完全停转。各套最低生命均不低于${(Math.min(...rows.map((row) => row.minimumHp)) * 100).toFixed(1)}%，说明100层对这一成型样本压力较低，不能据此判定高层生存已平衡。

每套使用流派实验室100级、四件太古套装、四件传奇、三槽魔盒和30级神铸；装备种子8801、战斗种子4107。复用已有 runRift，所有流派采用相同的靠近60px后绕圈策略；不手动施放位移、不使用圣坛、不替换宠物与词条。通过观察回调收集数据，不另写输出或资源公式；实际成本调用 GameEngine.getSkillCost。没有为提高通过率调整套装倍率。

## 本轮实测

“主动施法”计已成功执行且非套装/传奇免费触发的次数；“近敌最长间隔”只累计420px内持续有活敌时未新增主动施法的时间，免费刀扇、持续毒、召唤物仍可能造成伤害，不能将它解释为完全无输出。“缺能率”是核心技能已转好、AUTO开启且附近有敌人的采样窗口中，资源低于实际成本的时间比例，不包含冷却等待；手动核心显示“手动”。最低生命按每个1/30秒更新结束采样，护盾/帧内受击回血不展开。

| 职业 / 流派 | 100层结果 | 击杀 | 主动施法 | 近敌最长间隔 | 核心缺能率 | 最低生命 |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${rows.map((row) => `| ${row.className} · ${row.name} | ${row.won ? '通过' : '未通过'} ${row.seconds.toFixed(1)}秒 | ${row.kills} | ${row.normalCasts} | ${row.maxActiveGap.toFixed(2)}秒 | ${row.coreAuto ? `${(row.blockedCoreRatio * 100).toFixed(1)}%` : '手动'} | ${(row.minimumHp * 100).toFixed(1)}% |`).join('\n')}

## 各流派操作与风险

这些建议来自本轮实测配置及现有技能/套装代码；未实际按键触发的位移强化和条件收益明确作为建议。

| 流派 | 推荐操作 | 需要理解的条件 |
| --- | --- | --- |
${rows.map((row) => `| ${row.name} | ${row.play} | ${row.risk} |`).join('\n')}

## 实际配装与技能栏

四件套保留对应套装身份，剩余一件护甲用于配装传奇；以下列表直接读取实验室生成的配置。技能顺序与当前战斗栏一致，括号内为开局自动状态。

${rows
  .map(
    (row) => `### ${row.className} · ${row.name}

- 穿戴传奇：${row.worn.join('、')}。
- 魔盒：${row.cube.join('、')}。
- 技能栏：${row.skills.map((skill) => `${skill.name}（${skill.auto ? 'AUTO' : '手动'}）`).join(' → ')}。
- 实际主动施法：${Object.entries(row.castCounts)
      .map(([id, count]) => `${row.skills.find((skill) => skill.id === id)?.name ?? id} ${count}次`)
      .join('、')}。
`,
  )
  .join('\n')}

## 确证问题与本轮修复

自动施法原先按技能表原始成本筛选，而实际施放会应用传奇减耗。大维兹尔之杖把陨石成本减半时，资源已足以施法仍会被自动决策排除，形成可避免的资源等待。本轮由引擎统一提供实际成本，自动选择与实际扣费共用该入口；保留旧调用方原始成本回退，免耗和手动设置继续生效。新增一个小型回归用例覆盖“资源达到减耗后成本即可自动施法、真正不足时不能施放”。

## 开荒与后续观察

- 低等级部分为代码审阅：新角色只有一个基础技能；位移Lv.3、核心Lv.5、掌控Lv.8、防御Lv.10、终极Lv.15解锁。成型实验室并不验证这些阶段的强度，教程应提示每级2点、学习与装备主技能相符、缺能时保留基础回能。
- 野蛮人与风暴爪击等近战基础需要主动接近，战斗栏出现施法动画不保证当前距离能命中。面向新手应同时说明走位、攻击范围和自动攻击；不能承诺自动战斗等同于自动寻路。
- 旋风、血球叠锤、移动刀扇、近身骨风暴、毒镰叠层与执政官升温有不同成立条件。UI应显示当前主技能/套装共鸣，保留位移手动入口，避免推荐按钮让玩家误以为所有额外核心都应同时开启。
- 本轮保留现有公开倍率与掉落门槛；100层短流程未覆盖长时间资源枯竭、全部随机精英组合、150层治疗怪群、低帧率或所有手柄型号。高层曲线仍需独立长期平衡任务，不把未测项目写作通过。

原始结果保存在 \`docs/playability-results.json\`，既有输出对照见 \`docs/BUILD_BALANCE.md\`；本脚本不会覆盖旧平衡报告。

界面、可交互主城、NPC独立贴图、多玩家大厅、职业榜和手机适配的完成情况及验收，见 [本轮验收记录](ACCEPTANCE.md#交互主城新手引导与多玩家大厅2026-11-01)。
`;

writeFileSync(
  'docs/playability-results.json',
  JSON.stringify({ date, stage: 100, rows }, null, 2) + '\n',
);
writeFileSync('docs/PLAYABILITY_REPORT.md', report);
console.log(`报告已写入 docs/PLAYABILITY_REPORT.md：${passed}/15 套通过。`);
