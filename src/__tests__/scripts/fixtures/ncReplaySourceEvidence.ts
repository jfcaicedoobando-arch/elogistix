import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { TestContext } from 'vitest';
import {
  HELPER_PATH, NC_PATH, OLD_SNAPSHOT, legacySourcePaths, snapshotProfile,
  type ArchiveManifest,
} from '../../../../scripts/ci/nc-publica-replay/source-evidence.mjs';

export const root = process.cwd();
export function put(folder: string, relative: string, bytes: string | Buffer) {
  const target = path.join(folder, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
}
/** Only archives/helper are actual bytes; runtime inputs are unexecuted sentinels. */
export function fixture(context: TestContext, active = false) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'nc-provenance-unit-'));
  context.onTestFinished(() => fs.rmSync(folder, { recursive: true, force: true }));
  fs.cpSync(path.join(root, 'docs/ci/workflow-archive'), path.join(folder, 'docs/ci/workflow-archive'), { recursive: true });
  for (const relative of legacySourcePaths('full').filter(p => p !== NC_PATH)) {
    put(folder, relative, `SYNTHETIC UNEXECUTED TEST INPUT: ${relative}\n`);
  }
  put(folder, HELPER_PATH, fs.readFileSync(path.join(root, HELPER_PATH)));
  if (active) put(folder, NC_PATH, fs.readFileSync(path.join(root, snapshotProfile(OLD_SNAPSHOT).wrappers[0].archivePath)));
  return folder;
}
export function manifestChange(folder: string, snapshot: string, change: (manifest: ArchiveManifest) => void) {
  const relative = snapshotProfile(snapshot).manifestPath;
  const manifest: ArchiveManifest = JSON.parse(fs.readFileSync(path.join(folder, relative), 'utf8'));
  change(manifest);
  put(folder, relative, JSON.stringify(manifest));
}
