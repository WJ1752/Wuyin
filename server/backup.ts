import { chmod, mkdir, open, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';

const source = resolve(process.env.DATABASE_PATH ?? 'data/wuyin.sqlite');
const destination = resolve(
  process.argv[2] ?? `backups/wuyin-${new Date().toISOString().replaceAll(':', '-')}.sqlite`,
);
let database: DatabaseSync | undefined;
let reserved = false;

try {
  if (source === destination) throw new Error('备份路径不能与当前数据库相同。');
  database = new DatabaseSync(source, { readOnly: true });
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  // Reserve a new file: a mistyped destination must never overwrite a database
  // or an existing backup. SQLite's online API includes committed WAL contents.
  const file = await open(destination, 'wx', 0o600);
  await file.close();
  reserved = true;
  await backup(database, destination);
  const snapshot = new DatabaseSync(destination, { readOnly: true });
  try {
    const result = snapshot.prepare('PRAGMA quick_check').get();
    if (result?.quick_check !== 'ok') throw new Error('备份数据库完整性检查失败。');
  } finally {
    snapshot.close();
  }
  await chmod(destination, 0o600);
  console.log(`数据库已完整备份至 ${destination}`);
} catch (error) {
  if (reserved) await unlink(destination).catch(() => undefined);
  console.error(`备份失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  database?.close();
}
