import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const SYSTEM = process.platform;

export function getSystem(): string {
    if (SYSTEM === 'win32') return 'Windows';
    if (SYSTEM === 'darwin') return 'Darwin';
    return 'Linux';
}

function expandVars(dirPath: string): string {
    return dirPath.replace(/%([^%]+)%/g, (_, n) => process.env[n] || '');
}

export function getDbPath(): string {
    if (SYSTEM === 'win32') {
        return expandVars(String.raw`%APPDATA%\antigravity\User\globalStorage\state.vscdb`);
    } else if (SYSTEM === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'antigravity', 'User', 'globalStorage', 'state.vscdb');
    } else {
        return path.join(os.homedir(), '.config', 'Antigravity', 'User', 'globalStorage', 'state.vscdb');
    }
}

export function getConversationsDir(): string {
    if (SYSTEM === 'win32') {
        return expandVars(String.raw`%USERPROFILE%\.gemini\antigravity\conversations`);
    } else {
        return path.join(os.homedir(), '.gemini', 'antigravity', 'conversations');
    }
}

export function getBrainDir(): string {
    if (SYSTEM === 'win32') {
        return expandVars(String.raw`%USERPROFILE%\.gemini\antigravity\brain`);
    } else {
        return path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
    }
}

export function validatePaths(): string[] {
    const errors: string[] = [];
    try {
        const dbPath = getDbPath();
        if (!fs.existsSync(dbPath)) {
            errors.push(`Database not found: ${dbPath}`);
        }
    } catch (e) {
        errors.push(`Database path resolution failed`);
    }

    try {
        const cDir = getConversationsDir();
        if (!fs.existsSync(cDir) || !fs.statSync(cDir).isDirectory()) {
            errors.push(`Conversations directory not found: ${cDir}`);
        }
    } catch (e) {
        errors.push(`Conversations directory resolution failed`);
    }
    return errors;
}
