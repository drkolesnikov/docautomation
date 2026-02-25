import Database from 'better-sqlite3';

export type SubscriptionRow = {
  user_id: number;
  username: string | null;
  paid_until: number;
  total_stars: number;
  created_at: number;
};

export function initDb(path: string): Database.Database {
  const db = new Database(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      user_id     INTEGER PRIMARY KEY,
      username    TEXT,
      paid_until  INTEGER NOT NULL,
      total_stars INTEGER DEFAULT 0,
      created_at  INTEGER DEFAULT (unixepoch())
    )
  `);
  return db;
}

export function getSubscription(
  db: Database.Database,
  userId: number
): SubscriptionRow | null {
  const row = db
    .prepare('SELECT * FROM subscriptions WHERE user_id = ?')
    .get(userId) as SubscriptionRow | undefined;
  return row ?? null;
}

export function isSubscribed(db: Database.Database, userId: number): boolean {
  const row = getSubscription(db, userId);
  if (!row) return false;
  return row.paid_until > Math.floor(Date.now() / 1000);
}

export function extendSubscription(
  db: Database.Database,
  userId: number,
  username: string | null,
  addDays: number,
  stars: number
): number {
  const nowSec = Math.floor(Date.now() / 1000);
  const addSec = addDays * 86400;

  const existing = getSubscription(db, userId);
  const base = existing && existing.paid_until > nowSec ? existing.paid_until : nowSec;
  const newExpiry = base + addSec;
  const newTotal = (existing?.total_stars ?? 0) + stars;

  db.prepare(`
    INSERT INTO subscriptions (user_id, username, paid_until, total_stars)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      username    = excluded.username,
      paid_until  = excluded.paid_until,
      total_stars = excluded.total_stars
  `).run(userId, username, newExpiry, newTotal);

  return newExpiry;
}
