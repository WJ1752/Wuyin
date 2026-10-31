/** Team size is locked at entry; a disconnect never reduces encounter health. */
export function coopBalance(partySize: number) {
  const players = Math.max(1, Math.min(4, Math.floor(partySize) || 1));
  return {
    players,
    monsterHp: 1 + (players - 1) * 0.7,
    bossHp: 1 + (players - 1) * 0.9,
    monsterDamage: 1 + (players - 1) * 0.08,
    reviveSeconds: 8,
    reviveHealth: 0.5,
    timeLimit: 300,
    rewardMultiplier: 1,
  };
}
