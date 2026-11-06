import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';

export function openDatabase(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  const version = db.prepare('PRAGMA user_version').get()?.user_version;
  if (![0, 1, 2, 3].includes(Number(version))) {
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
    CREATE TABLE IF NOT EXISTS lobby_presence (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      session_hash TEXT NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
      x REAL NOT NULL CHECK(x >= 0 AND x <= 1),
      y REAL NOT NULL CHECK(y >= 0 AND y <= 1),
      activity TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS lobby_expiry ON lobby_presence(updated_at);
    CREATE TABLE IF NOT EXISTS account_recovery (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      recovery_hash TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS coop_results (
      run_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      character_id TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      claimed_at INTEGER,
      PRIMARY KEY (run_id, user_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS coop_results_pending ON coop_results(user_id, claimed_at);
    CREATE TABLE IF NOT EXISTS verified_runs (
      run_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      character_id TEXT NOT NULL,
      name TEXT NOT NULL,
      class_id TEXT NOT NULL,
      level INTEGER NOT NULL,
      stage INTEGER NOT NULL,
      seconds REAL NOT NULL CHECK(seconds > 0),
      kills INTEGER NOT NULL,
      set_name TEXT,
      created_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS verified_runs_ranking ON verified_runs(class_id, stage DESC, seconds);
    CREATE TABLE IF NOT EXISTS player_feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    ) STRICT;
    PRAGMA user_version = 3;
    COMMIT;
  `);
  db.prepare('INSERT OR IGNORE INTO metadata(key, value) VALUES (?, ?)').run(
    'cookie_secret',
    randomBytes(64).toString('hex'),
  );
  return db;
}
