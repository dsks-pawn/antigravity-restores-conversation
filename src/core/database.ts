import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const KEY = 'antigravityUnifiedStateSync.trajectorySummaries';

export function readTrajectoryData(dbPath: string): string | null {
    try {
        const db = new Database(dbPath, { readonly: true });
        const row = db.prepare('SELECT value FROM ItemTable WHERE key = ?').get(KEY) as any;
        db.close();
        return row && row.value ? row.value : null;
    } catch (e) {
        console.error('Failed to read from DB (it might be locked by the IDE):', e);
        return null;
    }
}

export function writeTrajectoryData(dbPath: string, encodedB64: string): void {
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    try {
        const row = db.prepare('SELECT 1 FROM ItemTable WHERE key = ?').get(KEY);
        if (row) {
            db.prepare('UPDATE ItemTable SET value = ? WHERE key = ?').run(encodedB64, KEY);
        } else {
            db.prepare('INSERT INTO ItemTable (key, value) VALUES (?, ?)').run(KEY, encodedB64);
        }
    } finally {
        db.close();
    }
}

export function backupCurrentData(dbPath: string, backupPath: string): boolean {
    const data = readTrajectoryData(dbPath);
    if (data) {
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.writeFileSync(backupPath, data, 'utf-8');
        return true;
    }
    return false;
}
