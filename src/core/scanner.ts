import fs from 'node:fs';
import path from 'node:path';
import { getSystem, getBrainDir, getConversationsDir } from './paths';
import {
  decodeVarint,
  skipProtobufField,
  encodeStringField,
  encodeLengthDelimited,
  stripFieldFromProtobuf,
  encodeVarint,
} from './protobuf';
import { readTrajectoryData } from './database';
import { pathToFileURL } from 'node:url';
import protobuf from 'protobufjs';

const SYSTEM = getSystem();

export function discoverConversations(conversationsDir: string): string[] {
  if (!fs.existsSync(conversationsDir)) return [];
  const files = fs
    .readdirSync(conversationsDir)
    .filter((f) => f.endsWith('.pb'));
  files.sort((a, b) => {
    const aTime = fs.statSync(path.join(conversationsDir, a)).mtimeMs;
    const bTime = fs.statSync(path.join(conversationsDir, b)).mtimeMs;
    return bTime - aTime;
  });
  return files.map((f) => f.slice(0, -3));
}

function pathToWorkspaceUri(folderPath: string): string {
  let uri = pathToFileURL(folderPath).href.replace(/'/g, '%27');
  if (SYSTEM === 'Windows') {
    uri = uri.replace(
      /^file:\/\/\/([A-Za-z]):/i,
      (_, drive) => `file:///${drive.toLowerCase()}%3A`,
    );
  }
  return uri;
}

export function buildWorkspaceField(folderPath: string): Buffer {
  const uri = pathToWorkspaceUri(folderPath);
  const subMsg = Buffer.concat([
    encodeStringField(1, uri),
    encodeStringField(2, uri),
  ]);
  return encodeLengthDelimited(9, subMsg);
}

export function extractWorkspaceHint(innerBlob: Buffer | null): string | null {
  if (!innerBlob) return null;
  try {
    let pos = 0;
    while (pos < innerBlob.length) {
      const [tag, tagPos] = decodeVarint(innerBlob, pos);
      pos = tagPos;
      const wireType = tag & 7;
      const fieldNum = tag >>> 3;
      if (wireType === 2) {
        const [len, lenPos] = decodeVarint(innerBlob, pos);
        const content = innerBlob.subarray(lenPos, lenPos + len);
        pos = lenPos + len;
        if (fieldNum > 1) {
          try {
            const text = content.toString('utf-8');
            if (text.includes('file:///')) return text;
          } catch (e) {}
        }
      } else {
        pos = skipProtobufField(innerBlob, tagPos, wireType);
      }
    }
  } catch (e) {}
  return null;
}

export function inferWorkspaceFromBrain(
  conversationId: string,
  brainDir = getBrainDir(),
): string | null {
  const brainPath = path.join(brainDir, conversationId);
  if (!fs.existsSync(brainPath) || !fs.statSync(brainPath).isDirectory())
    return null;

  const pathPattern =
    SYSTEM === 'Windows'
      ? /file:\/\/\/([A-Za-z](?:%3A|:)\/[^\s"'>]+)/g
      : /file:\/\/\/([^\s"'>]+)/g;

  const pathCounts: Record<string, number> = {};

  try {
    const files = fs.readdirSync(brainPath);
    for (const name of files) {
      if (!name.endsWith('.md') || name.startsWith('.')) continue;
      try {
        const content = fs.readFileSync(path.join(brainPath, name), 'utf-8');
        let match;
        while ((match = pathPattern.exec(content)) !== null) {
          let raw = match[1];
          raw = raw
            .replace(/%3A/gi, ':')
            .replace(/%20/g, ' ')
            .replace(/\\/g, '/');
          const parts = raw.split('/');
          const depth = SYSTEM === 'Windows' ? 5 : 4;
          if (parts.length >= depth) {
            const ws = parts.slice(0, depth).join('/');
            pathCounts[ws] = (pathCounts[ws] || 0) + 1;
          }
        }
      } catch (e) {}
    }
  } catch (e) {
    return null;
  }

  const entries = Object.entries(pathCounts);
  if (entries.length === 0) return null;

  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0].replace(/\//g, path.sep);
}

export function buildTimestampFields(epochSeconds: number): Buffer {
  const tsInner = Buffer.concat([
    encodeVarint((1 << 3) | 0),
    encodeVarint(Math.floor(epochSeconds)),
  ]);
  return Buffer.concat([
    encodeLengthDelimited(3, tsInner),
    encodeLengthDelimited(7, tsInner),
    encodeLengthDelimited(10, tsInner),
  ]);
}

export function hasTimestampFields(innerBlob: Buffer | null): boolean {
  if (!innerBlob) return false;
  try {
    const reader = protobuf.Reader.create(innerBlob);
    while (reader.pos < reader.len) {
      const tag = reader.uint32();
      const fn = tag >>> 3;
      // Any field other than 1 (title) and 9 (workspace) implies rich metadata
      // like timestamps, config, model setup, token counts, etc.
      if (fn !== 1 && fn !== 9) return true;
      reader.skipType(tag & 7);
    }
  } catch (e) {}
  return false;
}

export function extractExistingMetadata(dbPath: string): {
  titles: Record<string, string>;
  innerBlobs: Record<string, Buffer>;
} {
  const titles: Record<string, string> = {};
  const innerBlobs: Record<string, Buffer> = {};
  const rawB64 = readTrajectoryData(dbPath);
  if (!rawB64) return { titles, innerBlobs };

  try {
    const decoded = Buffer.from(rawB64, 'base64');
    let pos = 0;
    while (pos < decoded.length) {
      const [tag, tagPos] = decodeVarint(decoded, pos);
      const wireType = tag & 7;
      if (wireType !== 2) break;
      const [len, lenPos] = decodeVarint(decoded, tagPos);
      const entry = decoded.subarray(lenPos, lenPos + len);
      pos = lenPos + len;

      let ep = 0;
      let uid: string | null = null;
      let infoB64: string | null = null;

      while (ep < entry.length) {
        const [t, tp] = decodeVarint(entry, ep);
        const fn = t >>> 3;
        const wt = t & 7;
        if (wt === 2) {
          const [l, lp] = decodeVarint(entry, tp);
          const content = entry.subarray(lp, lp + l);
          ep = lp + l;
          if (fn === 1) uid = content.toString('utf-8');
          else if (fn === 2) {
            const [, sp1] = decodeVarint(content, 0);
            const [sl, sp2] = decodeVarint(content, sp1);
            infoB64 = content.subarray(sp2, sp2 + sl).toString('utf-8');
          }
        } else {
          ep = skipProtobufField(entry, tp, wt);
        }
      }

      if (uid && infoB64) {
        try {
          const rawInner = Buffer.from(infoB64, 'base64');
          innerBlobs[uid] = rawInner;

          const [, ip1] = decodeVarint(rawInner, 0);
          const [il, ip2] = decodeVarint(rawInner, ip1);
          const title = rawInner.subarray(ip2, ip2 + il).toString('utf-8');
          if (!title.startsWith('Conversation (')) titles[uid] = title;
        } catch (e) {}
      }
    }
  } catch (e) {}
  return { titles, innerBlobs };
}

export function getTitleFromBrain(
  conversationId: string,
  brainDir = getBrainDir(),
): string | null {
  const brainPath = path.join(brainDir, conversationId);
  if (!fs.existsSync(brainPath) || !fs.statSync(brainPath).isDirectory())
    return null;

  try {
    const files = fs
      .readdirSync(brainPath)
      .filter((f) => f.endsWith('.md') && !f.startsWith('.'));
    files.sort();
    for (const f of files) {
      try {
        const content = fs.readFileSync(path.join(brainPath, f), 'utf-8');
        const firstLine = content.split('\n')[0].trim();
        if (firstLine.startsWith('#'))
          return firstLine.replace(/^#\s*/, '').substring(0, 80);
      } catch (e) {}
    }
  } catch (e) {}
  return null;
}

export function resolveTitle(
  conversationId: string,
  existingTitles: Record<string, string>,
  brainDir = getBrainDir(),
  conversationsDir = getConversationsDir(),
): [string, 'brain' | 'preserved' | 'fallback'] {
  const brainTitle = getTitleFromBrain(conversationId, brainDir);
  if (brainTitle) return [brainTitle, 'brain'];
  if (existingTitles[conversationId])
    return [existingTitles[conversationId], 'preserved'];

  const convFile = path.join(conversationsDir, `${conversationId}.pb`);
  if (fs.existsSync(convFile)) {
    const d = new Date(fs.statSync(convFile).mtimeMs);
    const mStr = d.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
    });
    return [`Conversation (${mStr}) ${conversationId.slice(0, 8)}`, 'fallback'];
  }
  return [`Conversation ${conversationId.slice(0, 8)}`, 'fallback'];
}

export function buildTrajectoryEntry(
  conversationId: string,
  title: string,
  existingInnerData: Buffer | null = null,
  workspacePath: string | null = null,
  pbMtime: number | null = null,
): Buffer {
  let innerInfo: Buffer;

  if (existingInnerData) {
    const preservedFields = stripFieldFromProtobuf(existingInnerData, 1);
    innerInfo = Buffer.concat([encodeStringField(1, title), preservedFields]);
    if (workspacePath) {
      innerInfo = stripFieldFromProtobuf(innerInfo, 9);
      innerInfo = Buffer.concat([
        innerInfo,
        buildWorkspaceField(workspacePath),
      ]);
    }
    if (pbMtime && !hasTimestampFields(existingInnerData)) {
      innerInfo = Buffer.concat([innerInfo, buildTimestampFields(pbMtime)]);
    }
  } else {
    innerInfo = encodeStringField(1, title);
    if (workspacePath)
      innerInfo = Buffer.concat([
        innerInfo,
        buildWorkspaceField(workspacePath),
      ]);
    if (pbMtime)
      innerInfo = Buffer.concat([innerInfo, buildTimestampFields(pbMtime)]);
  }

  const infoB64 = innerInfo.toString('base64');
  const subMessage = encodeStringField(1, infoB64);
  return Buffer.concat([
    encodeStringField(1, conversationId),
    encodeLengthDelimited(2, subMessage),
  ]);
}
