import test from 'node:test';
import assert from 'node:assert/strict';
import { BOSSES } from '../src/data/monsters';
import { createBossBrain, stepBossAI } from '../src/engine/BossAI';
import type { MonsterAIEvent } from '../src/engine/MonsterAI';

test('eight guardians resolve telegraphs and distinct follow-up mechanics', () => {
  for (const boss of BOSSES) {
    const brain = createBossBrain();
    const events: MonsterAIEvent[] = [];
    let firstStrike = Infinity;
    for (let tick = 0; tick < 220; tick++) {
      const result = stepBossAI(
        brain,
        {
          dt: 0.1,
          time: tick * 0.1,
          id: 1,
          behavior: 'boss',
          family: boss.family,
          x: 0,
          y: 0,
          playerX: 200,
          playerY: 0,
          hp: boss.hp * (boss.id === 'mist_devourer' ? 0.2 : 0.4),
          maxHp: boss.hp,
          attack: boss.attack,
          speed: boss.speed,
          elite: false,
          stunned: false,
        },
        boss,
      );
      if (result.events.some((e) => e.kind === 'strike'))
        firstStrike = Math.min(firstStrike, tick * 0.1);
      events.push(...result.events);
    }
    assert.ok(firstStrike >= 3, `${boss.id}: attacks must have a reaction window`);
    assert.ok(
      events.some((e) => e.kind === 'shield'),
      `${boss.id}: phase shield`,
    );
    assert.ok(
      events.some((e) => e.kind === 'strike' && e.damage > 0),
      `${boss.id}: real damage`,
    );
    if (boss.id === 'grave_king') assert.ok(events.some((e) => e.kind === 'summon'));
    if (boss.id === 'thorn_matriarch')
      assert.ok(events.some((e) => 'source' in e && e.source === 'thorn_pool'));
    if (boss.id === 'void_abbess' || boss.id === 'blood_butcher')
      assert.ok(events.some((e) => e.kind === 'teleport'));
    if (boss.id === 'winter_wyrm')
      assert.ok(events.some((e) => e.kind === 'strike' && e.slow?.ratio === 0.6));
    if (boss.id === 'storm_archon')
      assert.ok(events.filter((e) => e.kind === 'telegraph').length >= 7);
    if (boss.id === 'mist_devourer') assert.ok(brain.enraged);
  }
});
