// Explicit archive provenance API; the runner opts in by exact snapshot. No effects at import.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

export const REPOSITORY = 'jfcaicedoobando-arch/elogistix';
export const OLD_SNAPSHOT = '43a453641a933e2f3f2be3fd766322307c8b9f3b';
export const PIN_UPDATE_SNAPSHOT = '2efa854223d0b7e7b38cb4cf743fc48b9b86a052';
export const NC_PATH = '.github/workflows/nc-publica-replay-review.yml';
export const ACCEPTANCE_PATH = '.github/workflows/acceptance-candidate-review.yml';
export const HELPER_PATH = 'scripts/ci/nc-publica-replay/source-evidence.mjs';
export const RUNNER_PATH = 'scripts/ci/nc-publica-replay/run.mjs';
const ARCHIVE = 'docs/ci/workflow-archive';
const LEGACY_CURRENT = Object.freeze([
  RUNNER_PATH,
  'scripts/ci/nc-publica-replay/verify-minimal.mjs',
  'scripts/ci/nc-publica-replay/container-run.sh',
  'scripts/db/nc-publica-replay/prepare.mjs',
  'scripts/db/nc-publica-replay/matrix.sql',
  'supabase/migrations/20261012010000_nc_publica_paridad_replay.sql',
]);
const FULL = Object.freeze([
  'scripts/db/local-verify.sh', 'scripts/db/schema-snapshot.sh',
  'scripts/ci/run-guards.sh', 'scripts/ci/run-rls-suites.sh',
  'supabase/schema/squash/cutoff.env', 'supabase/tests/_guards_manifest.txt',
]);
function freezeDeep(value) {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freezeDeep(child);
  return Object.freeze(value);
}
// These literals are independent trust anchors. File + manifest cannot authorize new bytes.
// The second snapshot identifies the reviewed PR295 head, not a replay result.
const SNAPSHOTS = freezeDeep({
  [OLD_SNAPSHOT]: {
    manifestPath: `${ARCHIVE}/manifest.json`,
    wrappers: [
      { originalPath: NC_PATH, archivePath: `${ARCHIVE}/nc-publica-replay-review.yml.txt`, gitBlobSha1: '51bfc2d45d2983a387dd38d7ea8bbe23779f0cd5', sha256: 'fcc833f760eaa9d3f530dbadc715b8228dcdcc873580d84401e4ca5ad1fa6228', bytes: 5055, relatedPullRequest: 258 },
      { originalPath: ACCEPTANCE_PATH, archivePath: `${ARCHIVE}/acceptance-candidate-review.yml.txt`, gitBlobSha1: 'c308b572c2aff0afbb6acaa87a44161c758fc36f', sha256: 'a61cda29d9b205a6753430e138ed6443335ece5d9bfad3e05f2cf93a22b5dbdb', bytes: 2865, relatedPullRequest: 265 },
    ],
  },
  [PIN_UPDATE_SNAPSHOT]: {
    manifestPath: `${ARCHIVE}/${PIN_UPDATE_SNAPSHOT}/manifest.json`,
    wrappers: [
      { originalPath: NC_PATH, archivePath: `${ARCHIVE}/${PIN_UPDATE_SNAPSHOT}/nc-publica-replay-review.yml.txt`, gitBlobSha1: '44b0eb120c1d7188548b3e742f3bcb3a8ae6999a', sha256: 'f8b28aa60913563b7db0742fd112632a49e7c7418eb37156bbd253b23d741f2a', bytes: 5055, relatedPullRequest: 258 },
      { originalPath: ACCEPTANCE_PATH, archivePath: `${ARCHIVE}/${PIN_UPDATE_SNAPSHOT}/acceptance-candidate-review.yml.txt`, gitBlobSha1: 'd23dbcc718ab136bcfe3bf6bfb748953f3c016bf', sha256: '28396c0f292020bc593d153b2e8cc106d85cc74a503e9e326502f833964238e9', bytes: 2865, relatedPullRequest: 265 },
    ],
  },
});
export function snapshotProfile(snapshot) {
  assert(typeof snapshot === 'string' && Object.hasOwn(SNAPSHOTS, snapshot), 'Explicit known archive snapshot required');
  return SNAPSHOTS[snapshot];
}
export function legacySourcePaths(mode) {
  assert(mode === 'minimal' || mode === 'full', 'Unsupported replay mode');
  return [NC_PATH, ...LEGACY_CURRENT, ...(mode === 'full' ? FULL : [])];
}
export function sourcePaths(mode, snapshot) {
  const profile = snapshotProfile(snapshot);
  return [...legacySourcePaths(mode), HELPER_PATH, profile.manifestPath];
}
export function byteIdentity(bytes) {
  assert(Buffer.isBuffer(bytes), 'A single unnormalized byte buffer is required');
  return {
    bytes: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    gitBlobSha1: crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex'),
  };
}
// Root is caller-supplied; all logical source paths are closed literals.
// lstat every component, including root ancestors. O_NOFOLLOW protects the final open.
// As with the existing runner, an immutable checkout is assumed during collection.
export function readRegular(root, relative) {
  assert(typeof root === 'string' && path.isAbsolute(root), 'Absolute checkout root required');
  assert(typeof relative === 'string' && !relative.includes('\\') && !relative.includes('\0') &&
    !path.posix.isAbsolute(relative) && relative.split('/').every(c => c && c !== '.' && c !== '..'), 'Unsafe source path');
  let cursor = path.parse(root).root;
  for (const component of path.resolve(root).slice(cursor.length).split('/').filter(Boolean)) {
    cursor = path.join(cursor, component);
    const stat = fs.lstatSync(cursor);
    assert(!stat.isSymbolicLink() && stat.isDirectory(), 'Regular root directory required');
  }
  const parts = relative.split('/');
  for (const [index, component] of parts.entries()) {
    cursor = path.join(cursor, component);
    const stat = fs.lstatSync(cursor);
    assert(!stat.isSymbolicLink(), `Symlink component not permitted: ${relative}`);
    assert(index === parts.length - 1 ? stat.isFile() : stat.isDirectory(), `Regular source required: ${relative}`);
  }
  const fd = fs.openSync(cursor, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    assert(fs.fstatSync(fd).isFile(), `Regular opened source required: ${relative}`);
    return fs.readFileSync(fd);
  } finally { fs.closeSync(fd); }
}
function exactKeys(object, keys, description) {
  assert(object && typeof object === 'object' && !Array.isArray(object), `${description}: object required`);
  assert.deepEqual(Object.keys(object).sort(), [...keys].sort(), `${description}: unexpected or missing field`);
}
function readManifest(root, snapshot) {
  const profile = snapshotProfile(snapshot);
  const bytes = readRegular(root, profile.manifestPath);
  const manifest = JSON.parse(bytes.toString('utf8'));
  exactKeys(manifest, ['format', 'repository', 'observedAtCommit', 'wrappers'], 'Manifest');
  assert.equal(manifest.format, 1, 'Unsupported archive manifest');
  assert.equal(manifest.repository, REPOSITORY, 'Manifest repository mismatch');
  assert.equal(manifest.observedAtCommit, snapshot, 'Manifest snapshot mismatch');
  assert(Array.isArray(manifest.wrappers) && manifest.wrappers.length === 2, 'Exactly two archive entries required');
  const seen = new Set();
  for (const entry of manifest.wrappers) {
    exactKeys(entry, ['originalPath', 'archivePath', 'gitBlobSha1', 'sha256', 'bytes', 'relatedPullRequest'], 'Archive entry');
    assert(!seen.has(entry.originalPath), 'Duplicate archive entry');
    seen.add(entry.originalPath);
    const anchor = profile.wrappers.find(item => item.originalPath === entry.originalPath);
    assert(anchor, 'Unrecognized archive entry');
    assert.deepEqual(entry, anchor, 'Manifest differs from independently pinned provenance');
  }
  return { bytes, profile };
}
function verifyArchive(root, anchor) {
  const bytes = readRegular(root, anchor.archivePath);
  assert.deepEqual(byteIdentity(bytes), { bytes: anchor.bytes, sha256: anchor.sha256, gitBlobSha1: anchor.gitBlobSha1 }, 'Historical archive identity mismatch');
  return bytes;
}
export function collectSourceEvidence(root, mode, snapshot) {
  const paths = sourcePaths(mode, snapshot); // reject modes/snapshots before reading
  const { bytes: manifestBytes, profile } = readManifest(root, snapshot);
  const anchor = profile.wrappers.find(item => item.originalPath === NC_PATH);
  const ncBytes = verifyArchive(root, anchor); // no fallback, and never open Acceptance
  const sources = {}, sourceBindings = {};
  for (const relative of paths) {
    const bytes = relative === NC_PATH ? ncBytes : relative === profile.manifestPath ? manifestBytes : readRegular(root, relative);
    sources[relative] = byteIdentity(bytes).sha256;
    sourceBindings[relative] = relative === NC_PATH
      ? { kind: 'historical-archive', path: anchor.archivePath, observedAtCommit: snapshot, gitBlobSha1: anchor.gitBlobSha1, bytes: anchor.bytes }
      : { kind: 'checkout', path: relative };
  }
  return { sources, sourceBindings };
}
// Package-level static verification is separate from NC's runtime dependencies.
export function verifyArchivePackage(root, snapshot) {
  const { profile } = readManifest(root, snapshot);
  return profile.wrappers.map(anchor => ({ originalPath: anchor.originalPath, ...byteIdentity(verifyArchive(root, anchor)) }));
}
