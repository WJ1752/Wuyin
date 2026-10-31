import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';

export function openDatabase(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  const version = db.prepare('PRAGMA user_version').get()?.user_version;
  if (version !== 0 && version !== 1) {
    db.close();
    throw new Error('数据库版本不受支持，请使用匹配的服务器版本。');
  }
  db.exec(`
    BEGIN IMMEDIATE;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
    CREATE TABLE IF NOT EXISTS saves (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      account_json TEXT,
      revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0),
      updated_at INTEGER
    ) STRICT;
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) STRICT;
    PRAGMA user_version = 1;
    COMMIT;
  `);
  db.prepare('INSERT OR IGNORE INTO metadata(key, value) VALUES (?, ?)').run(
    'cookie_secret',
    randomBytes(64).toString('hex'),
  );
  return db;
}
