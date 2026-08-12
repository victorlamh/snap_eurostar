import Database from 'better-sqlite3';
import path from 'path';
import { ensureDirectories, log } from './utils';
import { TrainOffer } from './types';

const DB_PATH = path.resolve(process.cwd(), 'data', 'alerts.sqlite');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    ensureDirectories();
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    
    // Create alerts_sent table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS alerts_sent (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        time_slot TEXT NOT NULL,
        price TEXT NOT NULL,
        dedup_key TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'EMAIL_SENT',
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add status column if table was created in earlier version without status column
    try {
      db.exec(`ALTER TABLE alerts_sent ADD COLUMN status TEXT DEFAULT 'EMAIL_SENT'`);
    } catch {
      // Column already exists
    }
  }
  return db;
}

/**
 * Checks whether an alert for this exact combination of date + time_slot + price has already been recorded as sent.
 */
export function isAlertAlreadySent(dedupKey: string): boolean {
  const database = getDb();
  const stmt = database.prepare("SELECT COUNT(*) as count FROM alerts_sent WHERE dedup_key = ? AND status = 'EMAIL_SENT'");
  const result = stmt.get(dedupKey) as { count: number };
  return result.count > 0;
}

/**
 * Records a newly detected alert in SQLite.
 */
export function recordAlertSent(offer: TrainOffer, emailSent: boolean = true): void {
  const database = getDb();
  const statusStr = emailSent ? 'EMAIL_SENT' : 'EMAIL_FAILED';
  try {
    const stmt = database.prepare(`
      INSERT INTO alerts_sent (date, time_slot, price, dedup_key, status)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(dedup_key) DO UPDATE SET status = excluded.status, sent_at = CURRENT_TIMESTAMP
    `);
    stmt.run(offer.date, offer.timeSlot, offer.price, offer.dedupKey, statusStr);
    log(`💾 Recorded offer in SQLite (${statusStr}): ${offer.dedupKey}`, 'DEBUG');
  } catch (err: any) {
    log(`Failed to record alert in DB: ${err?.message || err}`, 'ERROR');
  }
}

/**
 * Returns recent sent alerts from SQLite DB for dashboard UI.
 */
export function getAlertHistory(limit: number = 50): any[] {
  const database = getDb();
  const stmt = database.prepare('SELECT id, date, time_slot, price, dedup_key, status, sent_at FROM alerts_sent ORDER BY id DESC LIMIT ?');
  return stmt.all(limit);
}
