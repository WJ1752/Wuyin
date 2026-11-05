import { SLOTS, type Item, type RunResult } from '../src/core/types';
import { createRng } from '../src/core/random';
import { LEGENDARIES } from '../src/data/legendaries';
import { SETS } from '../src/data/sets';
import {
  BUILD_RELICS,
  itemClass,
  newAccountSave,
  newSave,
  useGameStore,
} from '../src/state/gameStore';
import { runRift } from '../tests/helpers/combatHarness';

// A fresh character per invocation. The lab contributes target item IDs only.
const [setId, rawSeed = '7715', rawMinutes = '120', policy = 'targeted'] = process.argv.slice(2);
const set = SETS.find((entry) => entry.id === setId);
const seed = Number(rawSeed);
const minutes = Number(rawMinutes);
if (
  !set ||
  !Number.isSafeInteger(seed) ||
  !Number.isFinite(minutes) ||
  minutes <= 0 ||
  !['targeted', 'drops'].includes(policy)
)
  throw new Error(
    'Usage: pnpm exec tsx scripts/audit-farming.ts <setId> [seed] [minutes after floor 100] [targeted|drops]',
  );
Math.random = createRng(seed);
const classId = set.classId;
const target = BUILD_RELICS[setId];
const game = useGameStore.getState;
const accounts = newAccountSave(newSave(classId));
useGameStore.setState({
  accounts: accounts.accounts,
  activeAccountId: accounts.activeAccountId,
  save: accounts.accounts[0].characters[0].save,
  labBackup: null,
  inCombat: false,
});
game().selectProgressionSet(setId);

function priority(item: Item) {
  if (item.legendaryId && target.worn.includes(item.legendaryId)) return 2;
  return item.setId === setId ? 1 : 0;
}
function prepare() {
  const before = game().save;
  const have = Object.values(before.equipment).map((item) => item?.legendaryId);
  if (policy === 'targeted' && before.shards >= 500 && before.inventory.length <= 230) {
    const missing = [...target.worn, ...target.cube].find(
      (id) =>
        !have.includes(id) &&
        !before.extracted.includes(id) &&
        !before.inventory.some((i) => i.legendaryId === id),
    );
    const slot = LEGENDARIES.find((def) => def.id === missing)?.slot ?? 'weapon';
    game().gamble(slot, 10);
  }
  const save = game().save;
  const usable = save.inventory.filter((item) => !itemClass(item) || itemClass(item) === classId);
  for (const slot of SLOTS) {
    const worn = save.equipment[slot];
    const choices = usable.filter((i) => i.slot === slot);
    if (worn) choices.unshift(worn);
    choices.sort((a, b) => priority(b) - priority(a) || b.attack + b.armor - a.attack - a.armor);
    if (choices[0] && choices[0] !== worn) game().equip(choices[0].id);
  }
  for (const id of policy === 'targeted' ? target.cube : []) {
    const item = game().save.inventory.find((i) => i.legendaryId === id);
    if (item && !game().save.extracted.includes(id)) game().extract(item.id);
    if (game().save.extracted.includes(id) && !Object.values(game().save.cube).includes(id))
      game().equipCube(id);
  }
  game().salvageLow();
  for (const item of game().save.inventory) {
    if (
      !target.cube.includes(item.legendaryId ?? '') ||
      game().save.extracted.includes(item.legendaryId!)
    )
      game().salvage(item.id);
  }
  // Raise the weapon first, then distribute spare resources among the other slots.
  for (const slot of SLOTS) {
    const targetRank = slot === 'weapon' ? 50 : Math.floor(game().save.forge.weapon / 2);
    while (game().save.equipment[slot] && game().save.forge[slot] < targetRank) {
      const rank = game().save.forge[slot];
      game().upgradeForge(slot);
      if (game().save.forge[slot] === rank) break;
    }
  }
  game().combineGems('ruby');
  for (const slot of SLOTS) {
    const item = game().save.equipment[slot];
    const ranks = game().save.gems.ruby;
    let tier = ranks.length;
    while (tier > 0 && !ranks[tier - 1]) tier--;
    if (item && tier > (item.gem?.level ?? 0)) game().socketGem(slot, 'ruby', tier);
  }
  game().recommendSkills(setId);
}

let seconds = 0,
  after100 = 0,
  runs = 0,
  farmRuns = 0,
  failures = 0;
let cleared = 0,
  fastFloor = 1,
  farmRemaining = 0,
  farmSeconds = 0;
const milestones: Record<number, number> = {};
// Count whole runs. The last one may finish up to five minutes past budget.
while (cleared < 150 && after100 < minutes * 60 && runs < 1500) {
  const late = cleared >= 100;
  const farming = farmRemaining > 0;
  const frontier = game().save.highestStage;
  const stage = farming
    ? Math.min(fastFloor, Math.max(1, frontier - 1))
    : late
      ? frontier
      : Math.min(frontier, 100);
  game().selectStage(stage);
  let result: RunResult | undefined;
  runRift(game().save, stage, {
    setup(engine) {
      engine.random = createRng(4107 + seed + 31 * runs);
    },
    finish(value) {
      result = value;
    },
  });
  if (!result) throw new Error('Rift ended without a settlement');
  runs++;
  seconds += result.seconds;
  if (late) after100 += result.seconds;
  if (farming) {
    farmRemaining--;
    if (late) {
      farmRuns++;
      farmSeconds += result.seconds;
    }
  }
  if (result.won) {
    cleared = Math.max(cleared, stage);
    if (result.seconds < 90) fastFloor = Math.max(fastFloor, stage);
    for (const mark of [100, 110, 120, 130, 140, 150])
      if (cleared >= mark && milestones[mark] === undefined)
        milestones[mark] = Math.round(after100);
  } else {
    if (late) failures++;
    if (!farming) farmRemaining = 3;
  }
  game().completeRun(result);
  prepare();
}
console.log(
  JSON.stringify({
    setId,
    seed,
    minutes,
    policy,
    cleared,
    milestones,
    runs,
    farmRuns,
    failures,
    farmSeconds: Math.round(farmSeconds),
    post100Seconds: Math.round(after100),
    totalSeconds: Math.round(seconds),
    level: game().save.level,
    forge: game().save.forge.weapon,
    cube: game().save.cube,
  }),
);
