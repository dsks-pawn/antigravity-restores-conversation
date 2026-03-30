import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import os from 'node:os';

const isWindows = os.platform() === 'win32';
const isMac = os.platform() === 'darwin';

// Create bin directory
if (!fs.existsSync('bin')) {
  fs.mkdirSync('bin');
}

// 1. Generate the SEA blob
console.log('Generating SEA blob...');
execSync('node --experimental-sea-config sea-config.json', {
  stdio: 'inherit',
});

// 2. Determine target executable name
const destName = isWindows
  ? 'bin/antigravity-restores-conversation-win.exe'
  : isMac
    ? 'bin/antigravity-restores-conversation-macos'
    : 'bin/antigravity-restores-conversation-linux';

const finalDest = path.resolve(destName);

// 3. Copy the node executable
console.log(`Copying node executable to ${finalDest}...`);
fs.copyFileSync(process.execPath, finalDest);

// Optional: strip existing signatures on macOS
if (isMac) {
  console.log('Removing macOS signature...');
  try {
    execSync(`codesign --remove-signature "${finalDest}"`, {
      stdio: 'inherit',
    });
  } catch (e) {
    console.warn('codesign --remove-signature failed or not needed.');
  }
}

// 4. Inject the blob using postject
console.log('Injecting blob using postject...');
const sentinelFuse = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const segmentFlag = isMac ? '--macho-segment-name NODE_SEA' : '';
execSync(
  `npx postject "${finalDest}" NODE_SEA_BLOB sea-prep.blob --sentinel-fuse ${sentinelFuse} ${segmentFlag}`,
  { stdio: 'inherit' },
);

// Optional: resign on macOS
if (isMac) {
  console.log('Signing macOS binary...');
  try {
    execSync(`codesign --sign - "${finalDest}"`, { stdio: 'inherit' });
  } catch (e) {
    console.warn('codesign --sign failed.');
  }
}

console.log(`Successfully built ${finalDest} using Node SEA!`);
