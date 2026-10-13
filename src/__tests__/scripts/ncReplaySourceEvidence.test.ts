// @vitest-environment node
import { expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  OLD_SNAPSHOT, PIN_UPDATE_SNAPSHOT, NC_PATH, HELPER_PATH, RUNNER_PATH,
  snapshotProfile, sourcePaths, byteIdentity, collectSourceEvidence, verifyArchivePackage,
} from '../../../scripts/ci/nc-publica-replay/source-evidence.mjs';
import { fixture, put, root } from './fixtures/ncReplaySourceEvidence';

// Independent expected paths: do not derive the preservation assertion from the API under test.
const LEGACY_MINIMAL = [
  '.github/workflows/nc-publica-replay-review.yml',
  'scripts/ci/nc-publica-replay/run.mjs',
  'scripts/ci/nc-publica-replay/verify-minimal.mjs',
  'scripts/ci/nc-publica-replay/container-run.sh',
  'scripts/db/nc-publica-replay/prepare.mjs',
  'scripts/db/nc-publica-replay/matrix.sql',
  'supabase/migrations/20261012010000_nc_publica_paridad_replay.sql',
];
const LEGACY_FULL_ONLY = [
  'scripts/db/local-verify.sh', 'scripts/db/schema-snapshot.sh',
  'scripts/ci/run-guards.sh', 'scripts/ci/run-rls-suites.sh',
  'supabase/schema/squash/cutoff.env', 'supabase/tests/_guards_manifest.txt',
];

for (const snapshot of [OLD_SNAPSHOT, PIN_UPDATE_SNAPSHOT]) {
  it(`verifies both exact archived wrappers at ${snapshot}`, () => {
    expect(verifyArchivePackage(root, snapshot)).toEqual(snapshotProfile(snapshot).wrappers.map(anchor => ({
      originalPath: anchor.originalPath, bytes: anchor.bytes, sha256: anchor.sha256, gitBlobSha1: anchor.gitBlobSha1,
    })));
  });
  for (const mode of ['minimal', 'full']) {
    it(`preserves the complete ${mode} logical source set at ${snapshot}`, context => {
      const folder = fixture(context), evidence = collectSourceEvidence(folder, mode, snapshot);
      expect(Object.keys(evidence.sources)).toEqual(sourcePaths(mode, snapshot));
      expect(Object.keys(evidence.sources)).toHaveLength(mode === 'minimal' ? 9 : 15);
      expect(Object.keys(evidence.sourceBindings)).toEqual(Object.keys(evidence.sources));
      expect(Object.keys(evidence.sources)).toEqual([...LEGACY_MINIMAL,
        ...(mode === 'full' ? LEGACY_FULL_ONLY : []), HELPER_PATH, snapshotProfile(snapshot).manifestPath]);
      const anchor = snapshotProfile(snapshot).wrappers[0];
      expect(evidence.sources[NC_PATH]).toBe(anchor.sha256);
      expect(evidence.sourceBindings[NC_PATH]).toEqual({ kind: 'historical-archive', path: anchor.archivePath,
        observedAtCommit: snapshot, gitBlobSha1: anchor.gitBlobSha1, bytes: anchor.bytes });
      expect(evidence.sources).not.toHaveProperty(anchor.archivePath);
      for (const key of sourcePaths(mode, snapshot).filter(p => p !== NC_PATH)) {
        expect(evidence.sourceBindings[key]).toEqual({ kind: 'checkout', path: key });
        expect(evidence.sources[key]).toBe(byteIdentity(fs.readFileSync(path.join(folder, key))).sha256);
      }
      expect(evidence).not.toHaveProperty('reviewCommit');
      expect(evidence).not.toHaveProperty('status');
      expect(evidence).not.toHaveProperty('format');
    });
  }
}
it('keeps independent immutable anchors for both observations and Git framing', () => {
  expect(snapshotProfile(OLD_SNAPSHOT).wrappers.map(a => a.gitBlobSha1)).toEqual([
    '51bfc2d45d2983a387dd38d7ea8bbe23779f0cd5', 'c308b572c2aff0afbb6acaa87a44161c758fc36f',
  ]);
  expect(snapshotProfile(PIN_UPDATE_SNAPSHOT).wrappers.map(a => a.gitBlobSha1)).toEqual([
    '44b0eb120c1d7188548b3e742f3bcb3a8ae6999a', 'd23dbcc718ab136bcfe3bf6bfb748953f3c016bf',
  ]);
  expect(byteIdentity(Buffer.alloc(0)).gitBlobSha1).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  expect(Object.isFrozen(snapshotProfile(OLD_SNAPSHOT))).toBe(true);
  expect(Object.isFrozen(snapshotProfile(OLD_SNAPSHOT).wrappers[0])).toBe(true);
  expect(() => Object.assign(snapshotProfile(OLD_SNAPSHOT).wrappers[0], { sha256: '0'.repeat(64) })).toThrow(TypeError);
});
it('records actual runner bytes without replacing historical identity or emitting a run', context => {
  const folder = fixture(context), before = collectSourceEvidence(folder, 'minimal', OLD_SNAPSHOT);
  put(folder, RUNNER_PATH, 'SYNTHETIC CHANGED INPUT, NEVER EXECUTED\n');
  const after = collectSourceEvidence(folder, 'minimal', OLD_SNAPSHOT);
  expect(after.sources[RUNNER_PATH]).not.toBe(before.sources[RUNNER_PATH]);
  expect(after.sources[NC_PATH]).toBe(before.sources[NC_PATH]);
  expect(fs.existsSync(path.join(folder, 'run.json'))).toBe(false);
});
it('reads each allowed input exactly once, never active wrappers or archived Acceptance', context => {
  const folder = fixture(context, true), opens: string[] = [];
  const originalOpen = fs.openSync;
  const spy = vi.spyOn(fs, 'openSync').mockImplementation((name, flags, mode) => {
    opens.push(String(name)); return originalOpen(name, flags, mode);
  });
  try { collectSourceEvidence(folder, 'full', OLD_SNAPSHOT); } finally { spy.mockRestore(); }
  const profile = snapshotProfile(OLD_SNAPSHOT);
  const expected = sourcePaths('full', OLD_SNAPSHOT).map(p => path.join(folder, p === NC_PATH ? profile.wrappers[0].archivePath : p));
  expect(opens.sort()).toEqual(expected.sort());
  expect(new Set(opens).size).toBe(15);
});
it('keeps Acceptance byte verification separate from NC collection', context => {
  const folder = fixture(context);
  fs.unlinkSync(path.join(folder, snapshotProfile(OLD_SNAPSHOT).wrappers[1].archivePath));
  expect(Object.keys(collectSourceEvidence(folder, 'minimal', OLD_SNAPSHOT).sources)).toHaveLength(9);
  expect(() => verifyArchivePackage(folder, OLD_SNAPSHOT)).toThrow(/ENOENT/);
});
it('keeps NC staging rules independent of the opt-in provenance format', () => {
  const runner = fs.readFileSync(path.join(root, RUNNER_PATH), 'utf8');
  // Behavioral v1/v2 orchestration, including failure paths, is exercised by
  // ncReplayRunnerCompatibility.test.ts rather than pinning obsolete runner bytes.
  expect(runner).toContain("record.status = exitCode === 0 && removed ? 'pass' : 'fail'");
  const begin = "if (mode === 'minimal') {\n  // Exactly six migration sources";
  const block = runner.slice(runner.indexOf(begin), runner.indexOf('let prepared;'));
  const inputs = [...block.matchAll(/^ {4}'([^']+)',?$/gm)].map(match => match[1]);
  expect(inputs).toHaveLength(9);
  expect(inputs).not.toContain(HELPER_PATH);
  const fullRoots = ['scripts/db', 'scripts/ci', 'supabase/migrations', 'supabase/migrations_archive', 'supabase/schema', 'supabase/tests'];
  expect(fullRoots.some(p => HELPER_PATH.startsWith(p + '/'))).toBe(true);
  for (const snapshot of [OLD_SNAPSHOT, PIN_UPDATE_SNAPSHOT]) {
    const profile = snapshotProfile(snapshot);
    for (const file of [profile.manifestPath, ...profile.wrappers.map(a => a.archivePath)]) {
      expect(inputs).not.toContain(file);
      expect(fullRoots.some(p => file.startsWith(p + '/'))).toBe(false);
    }
  }
});
