import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const KEY = 'antigravityUnifiedStateSync.trajectorySummaries';

export function readTrajectoryData(dbPath: string): string | null {
    try {
        if (!fs.existsSync(dbPath)) {
            return null;
        }
        const db = new DatabaseSync(dbPath, { open: true });
        const stmt = db.prepare('SELECT value FROM ItemTable WHERE key = ?');
        const row = stmt.get(KEY) as any;
        db.close();
        return row && row.value ? row.value : null;
    } catch (e) {
        return null;
    }
}

export function writeTrajectoryData(dbPath: string, encodedB64: string): void {
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    try {
        const stmtSelect = db.prepare('SELECT 1 FROM ItemTable WHERE key = ?');
        const row = stmtSelect.get(KEY);
        if (row) {
            const stmtUpdate = db.prepare('UPDATE ItemTable SET value = ? WHERE key = ?');
            stmtUpdate.run(encodedB64, KEY);
        } else {
            const stmtInsert = db.prepare('INSERT INTO ItemTable (key, value) VALUES (?, ?)');
            stmtInsert.run(KEY, encodedB64);
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
