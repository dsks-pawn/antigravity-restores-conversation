import fs from 'node:fs';
import path from 'node:path';
import { getDbPath, getConversationsDir, getBrainDir, validatePaths } from './paths';
import { discoverConversations, extractExistingMetadata, resolveTitle, extractWorkspaceHint, inferWorkspaceFromBrain, buildTrajectoryEntry } from './scanner';
import { backupCurrentData, writeTrajectoryData } from './database';
import { encodeLengthDelimited } from './protobuf';

export interface ConversationInfo {
    id: string;
    title: string;
    source: 'brain' | 'preserved' | 'fallback';
    hasWorkspace: boolean;
    workspaceUri: string | null;
    innerData: Buffer | null;
}

export interface FixResult {
    total: number;
    bySource: { brain: number, preserved: number, fallback: number };
    workspacesMapped: number;
    timestampsInjected: number;
    conversations: ConversationInfo[];
    backupPath: string | null;
}

export interface Callbacks {
    onProgress?: (msg: string, percent: number) => void;
    onLog?: (msg: string) => void;
    onError?: (msg: string) => void;
}

export function scan(callbacks: Callbacks = {}): ConversationInfo[] {
    const dbPath = getDbPath();
    const convDir = getConversationsDir();
    const brainDir = getBrainDir();

    const errors = validatePaths();
    if (errors.length > 0) {
        errors.forEach(e => callbacks.onError?.(e));
        throw new Error(errors[0]);
    }

    callbacks.onLog?.(`Scanning: ${convDir}`);
    const convIds = discoverConversations(convDir);

    if (convIds.length === 0) {
        callbacks.onLog?.(`No conversations found on disk.`);
        return [];
    }

    callbacks.onLog?.(`Found ${convIds.length} conversations`);

    const { titles, innerBlobs } = extractExistingMetadata(dbPath);
    callbacks.onLog?.(`Existing titles: ${Object.keys(titles).length}, blobs: ${Object.keys(innerBlobs).length}`);

    const results: ConversationInfo[] = [];
    const total = convIds.length;

    for (let i = 0; i < total; i++) {
        const cid = convIds[i];
        const [title, source] = resolveTitle(cid, titles, brainDir, convDir);
        const inner = innerBlobs[cid] || null;
        const wsUri = inner ? extractWorkspaceHint(inner) : null;

        results.push({
            id: cid,
            title,
            source,
            hasWorkspace: !!wsUri,
            workspaceUri: wsUri,
            innerData: inner
        });
        callbacks.onProgress?.(title, (i + 1) / total);
    }

    return results;
}

export function autoAssignWorkspaces(conversations: ConversationInfo[], callbacks: Callbacks = {}): Record<string, string> {
    const brainDir = getBrainDir();
    if (!fs.existsSync(brainDir) || !fs.statSync(brainDir).isDirectory()) return {};

    const assignments: Record<string, string> = {};
    const unmapped = conversations.filter(c => !c.hasWorkspace);

    unmapped.forEach((conv, i) => {
        const inferred = inferWorkspaceFromBrain(conv.id, brainDir);
        if (inferred && fs.existsSync(inferred)) {
            assignments[conv.id] = inferred;
            callbacks.onLog?.(`  [${i + 1}] ${conv.title.slice(0, 40)} -> ${path.basename(inferred)}`);
        }
        callbacks.onProgress?.(conv.title, (i + 1) / Math.max(unmapped.length, 1));
    });

    callbacks.onLog?.(`Auto-assigned ${Object.keys(assignments).length} workspace(s)`);
    return assignments;
}

export function fix(conversations: ConversationInfo[], workspaceAssignments: Record<string, string> = {}, callbacks: Callbacks = {}): FixResult {
    const dbPath = getDbPath();
    const convDir = getConversationsDir();

    const backupDir = path.dirname(path.resolve(dbPath));
    const backupPath = path.join(backupDir, 'trajectorySummaries_backup.txt');
    const backedUp = backupCurrentData(dbPath, backupPath);

    if (backedUp) callbacks.onLog?.(`Backup saved: ${backupPath}`);

    let resultBytes: Buffer[] = [];
    const stats = { brain: 0, preserved: 0, fallback: 0 };
    let wsTotal = 0;
    let tsInjected = 0;

    for (let i = 0; i < conversations.length; i++) {
        const conv = conversations[i];
        const wsPath = workspaceAssignments[conv.id] || null;
        const pbPath = path.join(convDir, `${conv.id}.pb`);
        let pbMtime = null;
        try {
            if (fs.existsSync(pbPath)) pbMtime = fs.statSync(pbPath).mtimeMs / 1000;
        } catch (e) { }

        const entry = buildTrajectoryEntry(conv.id, conv.title, conv.innerData, wsPath, pbMtime);
        resultBytes.push(encodeLengthDelimited(1, entry));

        stats[conv.source]++;
        if (conv.hasWorkspace || wsPath) wsTotal++;

        // if need inject timestamp
        if (pbMtime && (!conv.innerData || !require('./scanner').hasTimestampFields(conv.innerData))) {
            tsInjected++;
        }

        callbacks.onProgress?.(conv.title, (i + 1) / conversations.length);
    }

    const finalBlob = Buffer.concat(resultBytes);
    const encoded = finalBlob.toString('base64');
    writeTrajectoryData(dbPath, encoded);
    callbacks.onLog?.(`Index rebuilt: ${conversations.length} conversations`);

    return {
        total: conversations.length,
        bySource: stats,
        workspacesMapped: wsTotal,
        timestampsInjected: tsInjected,
        conversations,
        backupPath: backedUp ? backupPath : null
    };
}
