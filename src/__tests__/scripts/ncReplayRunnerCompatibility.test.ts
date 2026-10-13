// @vitest-environment node
import { expect, it, type TestContext } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { OLD_SNAPSHOT, PIN_UPDATE_SNAPSHOT, NC_PATH, RUNNER_PATH, HELPER_PATH,
  snapshotProfile, byteIdentity } from '../../../scripts/ci/nc-publica-replay/source-evidence.mjs';
import { fixture, put, root } from './fixtures/ncReplaySourceEvidence';

const MINIMAL = [
  '.github/workflows/nc-publica-replay-review.yml',
  'scripts/ci/nc-publica-replay/run.mjs', 'scripts/ci/nc-publica-replay/verify-minimal.mjs',
  'scripts/ci/nc-publica-replay/container-run.sh', 'scripts/db/nc-publica-replay/prepare.mjs',
  'scripts/db/nc-publica-replay/matrix.sql', 'supabase/migrations/20261012010000_nc_publica_paridad_replay.sql',
];
const FULL_ONLY = [
  'scripts/db/local-verify.sh', 'scripts/db/schema-snapshot.sh', 'scripts/ci/run-guards.sh',
  'scripts/ci/run-rls-suites.sh', 'supabase/schema/squash/cutoff.env', 'supabase/tests/_guards_manifest.txt',
];
const STAGED_MINIMAL = [
  'supabase/migrations/20260827193052_6fd12712-cd48-48bf-8f7a-ba8708d6d885.sql',
  'supabase/migrations/20260902004000_replay_mirror_reemision_canonica.sql',
  'supabase/migrations/20260902006000_cartera_pendiente_nc_inline.sql',
  'supabase/migrations/20260910231259_20a2074f-e5f7-4954-bd09-8ca2cf6160ef.sql',
  'supabase/migrations/20261001183654_1aaeec87-3e77-4e27-9d6e-d4db9842fb96.sql',
  'supabase/migrations/20261012010000_nc_publica_paridad_replay.sql',
  'scripts/db/nc-publica-replay/prepare.mjs', 'scripts/db/nc-publica-replay/matrix.sql',
  'scripts/ci/nc-publica-replay/container-run.sh',
];
function runnerFixture(context: TestContext, active = true) {
  const folder = fixture(context, active);
  put(folder, RUNNER_PATH, fs.readFileSync(path.join(root, RUNNER_PATH)));
  for (const file of STAGED_MINIMAL) if (!fs.existsSync(path.join(folder, file))) put(folder, file, 'SYNTHETIC UNEXECUTED SQL\n');
  return folder;
}
function probe(folder: string, mode: string, options: Record<string, unknown> = {}) {
  return JSON.parse(execFileSync(process.execPath, ['--experimental-vm-modules',
    path.join(root, 'src/__tests__/scripts/fixtures/ncReplayRunnerProbe.mjs'),
    JSON.stringify({ root: folder, mode, ...options })], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
}
function expectNoRuntime(result: ReturnType<typeof probe>) {
  expect(result.record).toBeNull();
  expect(result.calls.filter(([command]: string[]) => command !== 'git')).toEqual([]);
}
for (const mode of ['minimal', 'full']) {
  it(`preserves default v1 ${mode} shape, active YAML hashing and staging`, context => {
    const folder = runnerFixture(context), result = probe(folder, mode), record = result.record;
    expect(result.error).toBeUndefined();
    expect(record.format).toBe(1); expect(record.status).toBe('pass');
    expect(result.dynamicImports).toEqual([]);
    expect(result.imports).not.toContain('./source-evidence.mjs');
    expect(record.reviewCommit).toBe('a'.repeat(40)); expect(record).not.toHaveProperty('sourceBindings');
    const expected = [...MINIMAL, ...(mode === 'full' ? FULL_ONLY : [])];
    expect(Object.keys(record.sources)).toEqual(expected);
    for (const file of expected) expect(record.sources[file]).toBe(byteIdentity(fs.readFileSync(path.join(folder, file))).sha256);
    expect(Object.keys(record).sort()).toEqual(['format', 'reviewCommit', 'repository', 'mode', 'image', 'status', 'sources',
      'scope', 'containerRemoved', 'exitCode', ...(mode === 'minimal' ? ['evidenceAssertions'] : [])].sort());
    expect(record.containerRemoved).toBe(true);
    if (mode === 'minimal') expect(Object.keys(result.staging.sourceFiles)).toEqual(STAGED_MINIMAL);
    expect(result.staging.hostCheckoutMounted).toBe(false); expect(result.staging.dockerSocketMounted).toBe(false);
  });
  for (const snapshot of [OLD_SNAPSHOT, PIN_UPDATE_SNAPSHOT]) {
    it(`emits explicit archived v2 ${mode} ${snapshot} without either active wrapper`, context => {
      const folder = runnerFixture(context, false), result = probe(folder, mode, { args: ['--archive-snapshot', snapshot] });
      expect(result.error).toBeUndefined();
      const record = result.record, profile = snapshotProfile(snapshot), anchor = profile.wrappers[0];
      expect(record.format).toBe(2); expect(record.status).toBe('pass');
      expect(result.dynamicImports).toEqual(['./source-evidence.mjs']);
      expect(record.reviewCommit).toBe('a'.repeat(40)); expect(record.reviewCommit).not.toBe(snapshot);
      expect(Object.keys(record.sources)).toEqual([...MINIMAL, ...(mode === 'full' ? FULL_ONLY : []), HELPER_PATH, profile.manifestPath]);
      expect(Object.keys(record.sourceBindings)).toEqual(Object.keys(record.sources));
      expect(record.sources[NC_PATH]).toBe(anchor.sha256);
      expect(record.sources[RUNNER_PATH]).toBe(byteIdentity(fs.readFileSync(path.join(folder, RUNNER_PATH))).sha256);
      expect(record.sourceBindings[NC_PATH]).toEqual({ kind: 'historical-archive', path: anchor.archivePath,
        observedAtCommit: snapshot, gitBlobSha1: anchor.gitBlobSha1, bytes: anchor.bytes });
      for (const file of Object.keys(record.sources).filter(p => p !== NC_PATH)) expect(record.sourceBindings[file]).toEqual({ kind: 'checkout', path: file });
      expect(record.containerRemoved).toBe(true); expect(record.exitCode).toBe(0);
      if (mode === 'minimal') expect(Object.keys(result.staging.sourceFiles)).toEqual(STAGED_MINIMAL);
      expect(Object.keys(result.staging.sourceFiles).some(p => p.startsWith('docs/ci/workflow-archive'))).toBe(false);
    });
  }
}
it('never silently upgrades v1 when its active wrapper is missing', context => {
  const result = probe(runnerFixture(context, false), 'minimal');
  expect(result.error).toMatch(/ENOENT/); expectNoRuntime(result);
});
it('never falls back to the active wrapper when an explicitly selected archive is missing', context => {
  const folder = runnerFixture(context);
  fs.unlinkSync(path.join(folder, snapshotProfile(OLD_SNAPSHOT).wrappers[0].archivePath));
  const result = probe(folder, 'minimal', { args: ['--archive-snapshot', OLD_SNAPSHOT] });
  expect(result.error).toMatch(/ENOENT/); expectNoRuntime(result);
});
it('rejects a forged selected archive before any preparer or Docker call', context => {
  const folder = runnerFixture(context);
  put(folder, snapshotProfile(OLD_SNAPSHOT).wrappers[0].archivePath, 'SYNTHETIC FORGED ARCHIVE');
  const result = probe(folder, 'full', { args: ['--archive-snapshot', OLD_SNAPSHOT] });
  expect(result.error).toMatch(/identity mismatch/); expectNoRuntime(result);
});
for (const args of [['--archive-snapshot'], ['--archive-snapshot', 'main'], ['--archive-snapshot', ''],
  ['--snapshot', OLD_SNAPSHOT], ['--archive-snapshot', OLD_SNAPSHOT, 'extra']]) {
  it(`rejects ambiguous or unsupported archive selection ${JSON.stringify(args)}`, context => {
    const result = probe(runnerFixture(context), 'minimal', { args });
    expect(result.error).toMatch(/Usage|Explicit known/); expectNoRuntime(result);
  });
}
for (const args of [[], ['--archive-snapshot', PIN_UPDATE_SNAPSHOT]]) {
  for (const failure of ['local', 'wrongBranch']) {
    it(`keeps admission fail-closed (${failure}, ${args.length ? 'v2' : 'v1'})`, context => {
      const result = probe(runnerFixture(context), 'minimal', { args, [failure]: true });
      expect(result.error).toMatch(/Actions only|Unexpected head branch/); expectNoRuntime(result);
    });
  }
  for (const failure of ['containerFailure', 'verifierFailure', 'removalFailure']) {
    it(`keeps failing results red (${failure}, ${args.length ? 'v2' : 'v1'})`, context => {
      const result = probe(runnerFixture(context), 'minimal', { args, [failure]: true });
      expect(result.error).toBeUndefined();
      expect(result.record.status).toBe('fail'); expect(result.record.exitCode).toBe(1); expect(result.exitCode).toBe(1);
      expect(result.calls.filter(([command, argv]: [string, string[]]) => command === 'docker' && argv[0] === 'rm')).toHaveLength(1);
      expect(result.record.containerRemoved).toBe(failure !== 'removalFailure');
    });
  }
}
it('keeps v1 independent of archives and manifests, even if they are absent', context => {
  const folder = runnerFixture(context);
  fs.rmSync(path.join(folder, 'docs/ci/workflow-archive'), { recursive: true });
  const result = probe(folder, 'minimal');
  expect(result.error).toBeUndefined(); expect(result.record.format).toBe(1); expect(result.record.status).toBe('pass');
});
it('never opens the active YAML when archived provenance is explicit', context => {
  const folder = runnerFixture(context), active = path.join(folder, NC_PATH);
  fs.unlinkSync(active);
  fs.symlinkSync(path.join(folder, 'does-not-exist'), active);
  const result = probe(folder, 'minimal', { args: ['--archive-snapshot', PIN_UPDATE_SNAPSHOT] });
  expect(result.error).toBeUndefined(); expect(result.record.status).toBe('pass');
});
it('keeps archived Acceptance outside NC runtime dependencies', context => {
  const folder = runnerFixture(context, false);
  fs.unlinkSync(path.join(folder, snapshotProfile(PIN_UPDATE_SNAPSHOT).wrappers[1].archivePath));
  const result = probe(folder, 'minimal', { args: ['--archive-snapshot', PIN_UPDATE_SNAPSHOT] });
  expect(result.error).toBeUndefined(); expect(result.record.status).toBe('pass');
});
it('exports exactly the same full synthetic staging for v1 and v2', context => {
  const legacy = probe(runnerFixture(context), 'full');
  const archived = probe(runnerFixture(context, false), 'full', { args: ['--archive-snapshot', PIN_UPDATE_SNAPSHOT] });
  expect(legacy.error).toBeUndefined(); expect(archived.error).toBeUndefined();
  expect(archived.staging).toEqual(legacy.staging);
});
