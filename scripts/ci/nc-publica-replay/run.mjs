#!/usr/bin/env node
// Host-only, dependency-free orchestrator. Never run as a local fallback.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyMinimal } from './verify-minimal.mjs';

const IMAGE = 'postgres@sha256:66b6a97eac1771fc78bd201b918b4253859f436c6913aeede97bd5366cce89ae';
const REPOSITORY = 'jfcaicedoobando-arch/elogistix';
const mode = process.argv[2];
assert(['minimal', 'full'].includes(mode) && (process.argv.length === 3 ||
  (process.argv.length === 5 && process.argv[3] === '--archive-snapshot')),
  'Usage: run.mjs minimal|full [--archive-snapshot <exact-known-commit>]');
// Omission keeps the v1 active-checkout contract. Never infer a snapshot or fall back.
const archiveSnapshot = process.argv.length === 5 ? process.argv[4] : null;
assert(process.env.GITHUB_ACTIONS === 'true', 'Actions only; local execution is deliberately refused');
assert(process.env.GITHUB_EVENT_NAME === 'pull_request', 'pull_request review only');
assert(process.env.GITHUB_REPOSITORY === REPOSITORY, 'Unexpected repository');
assert(process.env.GITHUB_EVENT_PATH, 'Pull request metadata is required');
const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
assert(['opened', 'synchronize', 'reopened'].includes(event.action), 'Unexpected pull request action');
assert.equal(event.pull_request?.base?.repo?.full_name, REPOSITORY, 'Unexpected base repository');
assert.equal(event.pull_request?.head?.repo?.full_name, REPOSITORY, 'Same-repository head required');
assert.equal(event.pull_request?.base?.ref, 'main', 'Base main is required');
assert.equal(event.pull_request?.head?.ref, 'fix/nc-replay-canonical-20261012', 'Unexpected head branch');
const review = process.env.REVIEW_COMMIT ?? '';
assert(/^[0-9a-f]{40}$/.test(review), 'An exact PR head commit is required');
assert.equal(event.pull_request?.head?.sha, review, 'Commit differs from PR head metadata');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const cleanEnv = { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C' };
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, env: cleanEnv, encoding: 'utf8' }).trim(), review, 'Checkout differs from reviewed commit');
const out = path.join(root, 'reports/nc-publica-replay', mode);
assert(!fs.existsSync(out), 'Evidence directory must be new');
fs.mkdirSync(out, { recursive: true, mode: 0o777 });
fs.chmodSync(out, 0o777); // Synthetic evidence directory only; container postgres writes here.
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourcePaths = [
  '.github/workflows/nc-publica-replay-review.yml',
  'scripts/ci/nc-publica-replay/run.mjs',
  'scripts/ci/nc-publica-replay/verify-minimal.mjs',
  'scripts/ci/nc-publica-replay/container-run.sh',
  'scripts/db/nc-publica-replay/prepare.mjs',
  'scripts/db/nc-publica-replay/matrix.sql',
  'supabase/migrations/20261012010000_nc_publica_paridad_replay.sql',
];
if (mode === 'full') sourcePaths.push('scripts/db/local-verify.sh', 'scripts/db/schema-snapshot.sh', 'scripts/ci/run-guards.sh', 'scripts/ci/run-rls-suites.sh', 'supabase/schema/squash/cutoff.env', 'supabase/tests/_guards_manifest.txt');
const provenance = archiveSnapshot !== null
  ? { format: 2, ...(await import('./source-evidence.mjs')).collectSourceEvidence(root, mode, archiveSnapshot) }
  : { format: 1, sources: Object.fromEntries(sourcePaths.map(relative => {
    rejectSymlinkComponents(relative);
    const source = path.join(root, relative);
    assert(fs.lstatSync(source).isFile(), `Regular hash source required: ${relative}`);
    return [relative, hash(fs.readFileSync(source))];
  })) };
const scratch = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'nc-publica-review-'));
const dockerConfig = path.join(scratch, 'docker-config');
fs.mkdirSync(dockerConfig);
const dockerEnv = { ...cleanEnv, DOCKER_HOST: 'unix:///var/run/docker.sock', DOCKER_CONFIG: dockerConfig };
const stage = path.join(scratch, 'stage');
fs.mkdirSync(stage);
const staged = {};
const allowedExtensions = new Set(['.sql', '.sh', '.mjs', '.cjs', '.js', '.ts', '.py', '.json', '.txt', '.md', '.yml', '.yaml']);
const excludedNames = new Set(['.git', '.aws', '.codex', '.agents', '.config', '.docker', '.ssh', 'node_modules', '.pgpass', '.pg_service.conf', 'credentials', '.credentials', 'credentials.json', 'application_default_credentials.json']);
function rejectSymlinkComponents(relative) {
  let cursor = root;
  for (const component of relative.split('/')) {
    cursor = path.join(cursor, component);
    assert(!fs.lstatSync(cursor).isSymbolicLink(), `Symlink component not permitted: ${relative}`);
  }
}
function stageFile(relative) {
  const source = path.join(root, relative);
  rejectSymlinkComponents(relative);
  assert(fs.lstatSync(source).isFile() && !fs.lstatSync(source).isSymbolicLink(), `Regular source file required: ${relative}`);
  const target = path.join(stage, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  staged[relative] = hash(fs.readFileSync(target));
}
function stageDirectory(relative) {
  const source = path.join(root, relative);
  if (!fs.existsSync(source)) return; // archive is optional at this reviewed ref.
  rejectSymlinkComponents(relative);
  assert(fs.lstatSync(source).isDirectory() && !fs.lstatSync(source).isSymbolicLink(), `Regular source directory required: ${relative}`);
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    // Reject by name before opening any content; .env tracked or untracked is never read.
    if (entry.name.startsWith('.env') || excludedNames.has(entry.name)) continue;
    const next = path.posix.join(relative, entry.name);
    assert(!entry.isSymbolicLink(), `Symlink not permitted in exported CI input: ${next}`);
    if (entry.isDirectory()) stageDirectory(next);
    else if (entry.isFile() && (allowedExtensions.has(path.extname(entry.name)) || next === 'supabase/schema/squash/cutoff.env')) stageFile(next);
  }
}
if (mode === 'minimal') {
  // Exactly six migration sources and three harness code files; no checkout mount.
  for (const relative of [
    'supabase/migrations/20260827193052_6fd12712-cd48-48bf-8f7a-ba8708d6d885.sql',
    'supabase/migrations/20260902004000_replay_mirror_reemision_canonica.sql',
    'supabase/migrations/20260902006000_cartera_pendiente_nc_inline.sql',
    'supabase/migrations/20260910231259_20a2074f-e5f7-4954-bd09-8ca2cf6160ef.sql',
    'supabase/migrations/20261001183654_1aaeec87-3e77-4e27-9d6e-d4db9842fb96.sql',
    'supabase/migrations/20261012010000_nc_publica_paridad_replay.sql',
    'scripts/db/nc-publica-replay/prepare.mjs',
    'scripts/db/nc-publica-replay/matrix.sql',
    'scripts/ci/nc-publica-replay/container-run.sh',
  ]) stageFile(relative);
} else {
  for (const relative of ['scripts/db', 'scripts/ci', 'supabase/migrations', 'supabase/migrations_archive', 'supabase/schema', 'supabase/tests']) stageDirectory(relative);
}
fs.writeFileSync(path.join(out, 'staging.json'), JSON.stringify({ scope: mode, sourceFiles: staged, excludesWithoutReading: ['.env*', '.git', 'credentials/config directories', 'symlinks', 'non-code extensions'], hostCheckoutMounted: false, dockerSocketMounted: false }, null, 2) + '\n');
let prepared;
if (mode === 'minimal') {
  prepared = path.join(scratch, 'prepared');
  const prepareLog = execFileSync(process.execPath, [path.join(stage, 'scripts/db/nc-publica-replay/prepare.mjs'), '--source-root', stage, '--candidate-root', stage, '--out', prepared], { cwd: stage, env: cleanEnv, encoding: 'utf8' });
  fs.writeFileSync(path.join(out, 'prepare.log'), prepareLog);
  fs.copyFileSync(path.join(prepared, 'source-hashes.json'), path.join(out, 'source-hashes.json'));
}
const record = { format: provenance.format, reviewCommit: review, repository: REPOSITORY, mode, image: IMAGE, status: 'created-proposal-run', sources: provenance.sources, ...(provenance.sourceBindings ? { sourceBindings: provenance.sourceBindings } : {}), scope: mode === 'minimal' ? '24 cases x 2 phases plus metadata; minimum fixture only' : 'official local-verify baseline flow; guards/RLS after dump; no hosted data' };
fs.writeFileSync(path.join(out, 'run.json'), JSON.stringify(record, null, 2) + '\n');
const mounts = ['--mount', `type=bind,source=${stage},target=/repo,readonly`, '--mount', `type=bind,source=${out},target=/evidence`];
if (prepared) mounts.push('--mount', `type=bind,source=${prepared},target=/prepared,readonly`);
const createArgs = ['create', '--pull=always', '--network=none', '--user=postgres', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges:true', '--tmpfs', '/tmp:rw,mode=1777', '--shm-size=256m', '--stop-timeout=30', ...mounts,
  '--entrypoint=/usr/bin/env', IMAGE, '-i', 'PATH=/usr/lib/postgresql/17/bin:/usr/bin:/bin', 'LANG=C', 'LC_ALL=C', 'bash', '/repo/scripts/ci/nc-publica-replay/container-run.sh', mode];
let ownedContainer;
let exitCode = 1;
let removed = false;
let child;
process.on('SIGTERM', () => { if (child) child.kill('SIGTERM'); });
process.on('SIGINT', () => { if (child) child.kill('SIGINT'); });
try {
  ownedContainer = execFileSync('docker', createArgs, { cwd: root, env: dockerEnv, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();
  assert(/^[0-9a-f]{64}$/.test(ownedContainer), 'Docker did not return an owned container ID');
  const fd = fs.openSync(path.join(out, 'container.log'), 'wx');
  try {
    exitCode = await new Promise((resolve, reject) => {
      child = spawn('docker', ['start', '--attach', ownedContainer], { cwd: root, env: dockerEnv, stdio: ['ignore', fd, fd] });
      child.once('error', reject);
      child.once('close', code => resolve(code ?? 1));
    });
  } finally { fs.closeSync(fd); }
  if (exitCode === 0 && mode === 'minimal') {
    exitCode = 1; // An evidence exception must never produce a green run.json.
    record.evidenceAssertions = verifyMinimal(out);
    exitCode = 0;
  }
} catch (error) {
  exitCode = 1;
  record.error = error instanceof Error ? error.message : String(error);
  console.error(record.error);
} finally {
  if (ownedContainer && /^[0-9a-f]{64}$/.test(ownedContainer)) {
    // Only the exact ID returned by this run's create. No discovery or reuse.
    try { execFileSync('docker', ['rm', '--force', '--volumes', ownedContainer], { env: dockerEnv, stdio: 'pipe' }); removed = true; }
    catch { exitCode = 1; console.error('Owned disposable container removal was not confirmed'); }
  }
  record.status = exitCode === 0 && removed ? 'pass' : 'fail';
  record.containerRemoved = removed;
  record.exitCode = exitCode;
  fs.writeFileSync(path.join(out, 'run.json'), JSON.stringify(record, null, 2) + '\n');
}
if (record.status !== 'pass') {
  const log = path.join(out, 'container.log');
  if (fs.existsSync(log)) console.error(fs.readFileSync(log, 'utf8').slice(-12000));
  process.exitCode = 1;
} else console.log(JSON.stringify({ status: 'pass', mode, reviewCommit: review, image: IMAGE, evidence: path.relative(root, out) }));
