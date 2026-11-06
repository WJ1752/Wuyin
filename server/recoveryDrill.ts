import { chmod, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** Validate restoration in an isolated database; never replace the live database. */
export async function verifyRecovery(source: string) {
  const directory = await mkdtemp(join(tmpdir(), 'wuyin-recovery-'));
  const target = join(directory, 'restore.sqlite');
  let database: DatabaseSync | undefined;
  try {
    await copyFile(resolve(source), target);
    await chmod(target, 0o600);
    database = new DatabaseSync(target);
    if (database.prepare('PRAGMA quick_check').get()?.quick_check !== 'ok')
      throw new Error('恢复副本完整性检查失败。');
    if (![1, 2, 3].includes(Number(database.prepare('PRAGMA user_version').get()?.user_version)))
      throw new Error('备份结构版本无效。');
    const counts = database
      .prepare(
        'SELECT (SELECT COUNT(*) FROM users) AS accounts, (SELECT COUNT(*) FROM saves) AS saves',
      )
      .get()!;
    database.exec('DELETE FROM sessions');
    database.close();
    database = new DatabaseSync(target, { readOnly: true });
    if (Number(database.prepare('SELECT COUNT(*) AS n FROM sessions').get()!.n) !== 0)
      throw new Error('恢复副本会话未清空。');
    return { accounts: Number(counts.accounts), saves: Number(counts.saves) };
  } finally {
    database?.close();
    await rm(directory, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]).endsWith('recoveryDrill.ts')) {
  if (!process.argv[2]) throw new Error('请指定需要演练的备份文件。');
  console.log(JSON.stringify({ ok: true, ...(await verifyRecovery(process.argv[2])) }));
}
