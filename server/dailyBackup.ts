import { backup, DatabaseSync } from 'node:sqlite';
import { chmod, mkdir, open, readdir, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { verifyRecovery } from './recoveryDrill';

const directory = resolve(process.env.BACKUP_DIRECTORY ?? 'backups');
const source = resolve(process.env.DATABASE_PATH ?? 'data/wuyin.sqlite');
await mkdir(directory, { recursive: true, mode: 0o700 });
const destination = join(
  directory,
  `wuyin-${new Date().toISOString().replaceAll(':', '-')}.sqlite`,
);
const reserved = await open(destination, 'wx', 0o600);
await reserved.close();
const database = new DatabaseSync(source, { readOnly: true });
try {
  await backup(database, destination);
  await chmod(destination, 0o600);
  const restored = await verifyRecovery(destination);
  console.log(JSON.stringify({ ok: true, backup: destination, recovered: restored }));
} finally {
  database.close();
}
// Only prune files with this tool's exact timestamp format, after the new copy passed recovery.
const cutoff = Date.now() - 14 * 86400000;
for (const entry of await readdir(directory, { withFileTypes: true })) {
  if (
    !entry.isFile() ||
    !/^wuyin-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z\.sqlite$/.test(entry.name)
  )
    continue;
  const timestamp = entry.name.slice(6, -7).replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
  if (Date.parse(timestamp) < cutoff) await unlink(join(directory, entry.name));
}
