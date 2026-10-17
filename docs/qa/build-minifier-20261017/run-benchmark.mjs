import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const ownDocs = 'docs/qa/build-minifier-20261017/';
const worker = fileURLToPath(new URL('./build-worker.mjs', import.meta.url));
const variants = ['terser', 'oxc'];
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
const slash = (value) => value.split(path.sep).join('/');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
const relative = (value) => slash(path.relative(root, value));
const isInside = (parent, candidate) => {
  const rel = path.relative(parent, candidate);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
};

export function resolveBunCommand(argument) {
  // A simple executable name follows PATH; explicit paths are relative to the checkout.
  return path.isAbsolute(argument) || /[\\/]/.test(argument) || /^[a-z]:/i.test(argument)
    ? path.resolve(root, argument)
    : argument;
}

function options() {
  if (process.argv.includes('--help')) {
    console.log('Usage: node docs/qa/build-minifier-20261017/run-benchmark.mjs --variants terser --runs 5 --output reports/build-minifier/NEW-RUN --idle-window "operator confirmation; known competing work" --bun ../.tools/bun.exe');
    console.log('Requires >=3 measured runs per variant, a new reports subdirectory and an explicit idle-window statement. --variants terser,oxc requires a successful policy-fixture preflight. Does not install dependencies.');
    return null;
  }
  const result = { runs: 5, variants: 'terser' };
  const seen = new Set();
  const allowed = ['--runs', '--variants', '--output', '--idle-window', '--bun'];
  for (let index = 2; index < process.argv.length; index += 2) {
    const flag = process.argv[index];
    const value = process.argv[index + 1];
    assert.ok(allowed.includes(flag) && value && !value.startsWith('--'), `Invalid option: ${flag}`);
    const key = flag.slice(2);
    assert.ok(!seen.has(key), `Repeated option: ${flag}`);
    seen.add(key);
    result[key] = value;
  }
  result.runs = Number(result.runs);
  assert.ok(Number.isInteger(result.runs) && result.runs >= 3, '--runs must be an integer >=3');
  result.variants = result.variants.split(',');
  assert.ok(result.variants.length > 0 && new Set(result.variants).size === result.variants.length &&
    result.variants.every((variant) => variants.includes(variant)), '--variants must be terser, oxc, or terser,oxc');
  for (const key of ['output', 'idle-window', 'bun']) assert.ok(result[key]?.trim(), `--${key} is required`);
  return result;
}

async function createOutput(argument) {
  const reports = path.join(root, 'reports');
  const output = path.resolve(root, argument);
  assert.ok(isInside(reports, output), '--output must be a new subdirectory of this checkout reports/');
  const rootReal = await realpath(root);
  let current = root;
  for (const part of path.relative(root, output).split(path.sep)) {
    current = path.join(current, part);
    try {
      const stat = await lstat(current);
      assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), 'Output ancestors must be ordinary directories');
      assert.ok(isInside(rootReal, await realpath(current)), 'Output ancestry escaped this checkout');
      assert.notEqual(current, output, '--output already exists; select a new run directory');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(output); // Exclusive final directory; never overwrite an earlier experiment.
  for (const name of ['outputs', 'cache', 'config', 'logs', 'inventories', 'sources']) await mkdir(path.join(output, name));
  return output;
}

async function saveJson(filename, data) {
  await writeFile(`${filename}.tmp`, `${JSON.stringify(data, null, 2)}\n`);
  await rename(`${filename}.tmp`, filename);
}

async function sourceSnapshot() {
  const files = git('ls-files', '-z').split('\0').filter((name) => name && !name.startsWith(ownDocs)).sort();
  const manifest = [];
  for (const filename of files) manifest.push({ path: filename, sha256: hash(await readFile(path.join(root, filename))) });
  return { head: git('rev-parse', 'HEAD').trim(), sha256: hash(JSON.stringify(manifest)), count: manifest.length, manifest };
}

export async function harnessSnapshot(directory = path.join(root, ownDocs)) {
  // Enumerate the filesystem, not git ls-files: newly created/untracked helpers also count.
  const files = (await treeFiles(directory)).filter((filename) => filename.endsWith('.mjs'));
  assert.ok(files.length, 'No harness .mjs files found');
  const manifest = [];
  for (const filename of files) manifest.push({ path: relative(filename), sha256: hash(await readFile(filename)) });
  return { capturedAt: new Date().toISOString(), sha256: hash(JSON.stringify(manifest)), count: manifest.length, manifest };
}

export function compareHarnessSnapshots(before, after) {
  const old = new Map(before?.manifest.map((file) => [file.path, file.sha256]) ?? []);
  const next = new Map(after.manifest.map((file) => [file.path, file.sha256]));
  const changedPaths = [...new Set([...old.keys(), ...next.keys()])]
    .filter((filename) => old.get(filename) !== next.get(filename)).sort();
  return { beforeSha256: before?.sha256 ?? null, afterSha256: after.sha256, changedPaths,
    unchanged: Boolean(before && before.sha256 === after.sha256 && changedPaths.length === 0) };
}

async function packageVersion(name) {
  for (const origin of [path.join(root, 'package.json'), path.join(root, 'node_modules/vite/package.json')]) {
    try {
      const require = createRequire(origin);
      let directory;
      try { directory = path.dirname(require.resolve(`${name}/package.json`)); }
      catch { directory = path.dirname(require.resolve(name)); }
      for (;;) {
        try {
          const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
          if (pkg.name === name) return { version: pkg.version, packageJson: relative(path.join(directory, 'package.json')) };
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
        const parent = path.dirname(directory);
        if (parent === directory) break;
        directory = parent;
      }
    } catch (error) { if (!['MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED'].includes(error.code)) throw error; }
  }
  throw new Error(`Installed package not found: ${name}`);
}

function childEnvironment() {
  const systemKeys = new Set(['PATH', 'PATHEXT', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'TMPDIR',
    'SYSTEMDRIVE', 'PROGRAMFILES', 'PROGRAMFILES(X86)', 'PROGRAMW6432', 'NUMBER_OF_PROCESSORS',
    'PROCESSOR_ARCHITECTURE', 'PROCESSOR_IDENTIFIER', 'PROCESSOR_LEVEL', 'PROCESSOR_REVISION',
    'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ']);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => systemKeys.has(key.toUpperCase())));
  return { ...env, NODE_OPTIONS: '--max-old-space-size=8192', ANALYZE: 'false', CI_REPORT_COMPRESSED_SIZE: 'false',
    VITE_SUPABASE_URL: 'http://127.0.0.1:9', VITE_SUPABASE_PUBLISHABLE_KEY: 'benchmark-public-placeholder' };
}

async function treeFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    assert.ok(!entry.isSymbolicLink(), `Unexpected symlink: ${relative(full)}`);
    if (entry.isDirectory()) files.push(...await treeFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files.sort();
}

async function clearConfigLoaderCache() {
  const directory = path.join(root, 'node_modules', '.vite-temp');
  const parent = await realpath(path.dirname(directory));
  assert.equal(parent, path.join(await realpath(root), 'node_modules'), 'Refuse to clear a shared node_modules cache');
  let files = [];
  try {
    const stat = await lstat(directory);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), 'Refuse to clear a linked .vite-temp');
    files = (await treeFiles(directory)).map(relative);
    assert.equal(await realpath(directory), path.join(parent, '.vite-temp'));
    await rm(directory, { recursive: true });
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return { path: relative(directory), policy: 'remove only the verified .vite-temp in this checkout before each build', removedFiles: files };
}

async function runChild(command, args, env, stdoutPath, stderrPath, abortSignal) {
  const stdout = createWriteStream(stdoutPath, { flags: 'wx' });
  const stderr = createWriteStream(stderrPath, { flags: 'wx' });
  let spawnError = null;
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const child = spawn(command, args, { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], signal: abortSignal });
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  child.on('error', (error) => { spawnError = { name: error.name, code: error.code ?? null, message: error.message }; });
  const exit = await new Promise((resolve) => child.on('close', (code, signal) =>
    resolve({ exitCode: code, signal, elapsedMs: performance.now() - start, endedAt: new Date().toISOString() })));
  await Promise.all([finished(stdout), finished(stderr)]);
  return { command: [command, ...args], startedAt, ...exit, spawnError,
    logs: { stdout: { path: relative(stdoutPath), sha256: hash(await readFile(stdoutPath)) },
      stderr: { path: relative(stderrPath), sha256: hash(await readFile(stderrPath)) } } };
}

async function inventory(outDir) {
  const files = [];
  const allFiles = await treeFiles(outDir);
  assert.ok(!allFiles.some((filename) => filename.endsWith('.map')), 'Unexpected emitted source map');
  for (const filename of allFiles.filter((value) => /\.(?:[cm]?js|css)$/i.test(value))) {
    const bytes = await readFile(filename);
    const gzip = gzipSync(bytes, { level: 9 });
    const brotli = brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
      [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length } });
    files.push({ path: slash(path.relative(outDir, filename)), type: filename.endsWith('.css') ? 'css' : 'js',
      rawBytes: bytes.length, gzipBytes: gzip.length, brotliBytes: brotli.length,
      sha256: hash(bytes), gzipSha256: hash(gzip), brotliSha256: hash(brotli) });
  }
  assert.ok(files.some(({ type }) => type === 'js') && files.some(({ type }) => type === 'css'), 'Missing JS or CSS output');
  const totals = {};
  for (const type of ['js', 'css', 'combined']) {
    const selected = files.filter((file) => type === 'combined' || file.type === type);
    totals[type] = { files: selected.length, ...Object.fromEntries(['rawBytes', 'gzipBytes', 'brotliBytes']
      .map((metric) => [metric, selected.reduce((sum, file) => sum + file[metric], 0)])) };
  }
  return { totals, files, allOutputFiles: allFiles.length, emittedSourceMaps: 0 };
}

function statistics(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const sampleSD = values.length > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)) : null;
  return { n: values.length, min: sorted[0], max: sorted.at(-1), mean,
    median: (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2,
    sampleSD, cv: sampleSD === null || mean === 0 ? null : sampleSD / Math.abs(mean) };
}

function summarize(measurements) {
  const successful = measurements.filter((run) => !run.warmup && run.exitCode === 0 && run.totals);
  const byVariant = {};
  for (const variant of variants) {
    const runs = successful.filter((run) => run.variant === variant);
    if (!runs.length) continue;
    byVariant[variant] = { elapsedMs: statistics(runs.map((run) => run.elapsedMs)), sizes: {} };
    for (const type of ['js', 'css', 'combined']) byVariant[variant].sizes[type] = Object.fromEntries(
      ['rawBytes', 'gzipBytes', 'brotliBytes'].map((metric) => [metric, statistics(runs.map((run) => run.totals[type][metric]))]));
  }
  const pairs = [];
  for (const pair of [...new Set(successful.map((run) => run.pair))]) {
    const terser = successful.find((run) => run.pair === pair && run.variant === 'terser');
    const oxc = successful.find((run) => run.pair === pair && run.variant === 'oxc');
    if (!terser || !oxc) continue;
    pairs.push({ pair, terserMs: terser.elapsedMs, oxcMs: oxc.elapsedMs,
      deltaMs: terser.elapsedMs - oxc.elapsedMs, percentLessTime: 100 * (terser.elapsedMs - oxc.elapsedMs) / terser.elapsedMs,
      speedup: terser.elapsedMs / oxc.elapsedMs });
  }
  return { byVariant, pairs, pairedStatistics: pairs.length ? Object.fromEntries(
    ['deltaMs', 'percentLessTime', 'speedup'].map((metric) => [metric, statistics(pairs.map((pair) => pair[metric]))])) : null };
}

function comparableProfile(config) {
  const keys = ['target', 'cssTarget', 'cssMinify', 'cssCodeSplit', 'sourcemap', 'reportCompressedSize', 'rolldownTransformTarget', 'oxcTransformTarget'];
  return { mode: config.mode, envDir: config.envDir, syntheticPublicEnvironment: config.syntheticPublicEnvironment,
    ...Object.fromEntries(keys.map((key) => [key, config.build[key]])) };
}

async function main(option) {
  const output = await createOutput(option.output);
  const summaryPath = path.join(output, 'summary.json');
  const env = childEnvironment();
  const abort = new AbortController();
  const interrupt = () => abort.abort();
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  const report = { schemaVersion: 1, status: 'preparing', startedAt: new Date().toISOString(),
    output: relative(output), measurements: [], command: [process.execPath, ...process.argv.slice(1)],
    idleWindowStatement: option['idle-window'],
    conditions: {
      mode: 'production', process: 'fresh Node process for every build; elapsed wall time from spawn to close',
      caches: 'Fresh output/cacheDir and cleared checkout-local Vite config-loader cache per build. OS filesystem cache is warm/uncontrolled, not cold.',
      warmups: 'One discarded warmup per selected variant; then measured repetitions (alternating T/O and O/T pairs when both variants are selected).',
      compression: 'Outside build timer; gzip level 9, Brotli quality 11 TEXT mode with per-file size hint; aggregate is sum of independently compressed files.',
      inference: 'Descriptive sample statistics only; no confidence interval or population-wide performance claim.',
      installation: { requiredCommand: 'bun install --frozen-lockfile --ignore-scripts',
        performedByHarness: false, excludedFromTiming: true, evidence: 'Consult the accompanying installation record; this harness does not assert that a prior install ran.' },
      backend: 'Synthetic public Supabase URL points to closed loopback port 9; no browser or backend is invoked by this runner.',
    },
    environment: { inheritedKeys: Object.keys(env).filter((key) => !['NODE_OPTIONS', 'ANALYZE', 'CI_REPORT_COMPRESSED_SIZE'].includes(key) && !key.startsWith('VITE_')).sort(),
      explicit: Object.fromEntries(['NODE_OPTIONS', 'ANALYZE', 'CI_REPORT_COMPRESSED_SIZE', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'].map((key) => [key, env[key]])),
      envDir: false, buildSourcemapsOverride: false, sentryCredentialsInherited: false },
  };
  let before;
  let harnessBefore;
  let baselineProfile;
  try {
    harnessBefore = await harnessSnapshot();
    await saveJson(path.join(output, 'sources/harness-before.json'), harnessBefore);
    report.harness = { directory: ownDocs, included: 'All .mjs files recursively, including untracked files',
      initialSha256: harnessBefore.sha256, initialFiles: harnessBefore.count };
    before = await sourceSnapshot();
    await saveJson(path.join(output, 'sources/before.json'), before);
    const cpus = os.cpus();
    const bunCommand = resolveBunCommand(option.bun);
    report.runtime = { node: process.version, nodeExecutable: process.execPath, versions: process.versions,
      bun: execFileSync(bunCommand, ['--version'], { cwd: root, env, encoding: 'utf8', windowsHide: true }).trim(),
      bunCommand, bunExecutable: path.isAbsolute(bunCommand) ? bunCommand : null,
      bunResolution: path.isAbsolute(bunCommand) ? 'explicit path' : 'PATH',
      os: { platform: os.platform(), release: os.release(), version: os.version(), arch: os.arch() },
      cpu: { model: cpus[0]?.model, logicalCount: cpus.length, availableParallelism: os.availableParallelism() }, totalMemoryBytes: os.totalmem() };
    report.packages = Object.fromEntries(await Promise.all(['vite', 'rolldown', 'terser', 'lightningcss', 'postcss', 'tailwindcss', '@tailwindcss/postcss']
      .map(async (name) => [name, await packageVersion(name)])));
    report.base = { head: before.head, sourceSha256: before.sha256, trackedInputFiles: before.count,
      excludedTrackedPrefix: ownDocs, hashes: Object.fromEntries(await Promise.all(['package.json', 'bun.lock', 'vite.config.ts', 'postcss.config.js', 'tailwind.config.ts']
        .map(async (filename) => [filename, hash(await readFile(path.join(root, filename)))]))) };
    report.selectedVariants = option.variants;
    if (option.variants.includes('oxc')) {
      const fixture = fileURLToPath(new URL('./policy-fixture.mjs', import.meta.url));
      const fixtureReport = path.join(output, 'policy-fixture.json');
      console.log('[benchmark] Oxc requested: policy-fixture must pass before any application warmup/build');
      report.preflight = { fixtureSha256: hash(await readFile(fixture)),
        ...await runChild(process.execPath, [fixture, '--output', fixtureReport], env,
          path.join(output, 'logs/policy-fixture.stdout.txt'), path.join(output, 'logs/policy-fixture.stderr.txt'), abort.signal) };
      await saveJson(summaryPath, report);
      assert.ok(report.preflight.exitCode === 0 && !report.preflight.spawnError && report.preflight.signal === null,
        'Oxc policy-fixture failed; comparison is blocked before application builds');
      const policy = JSON.parse(await readFile(fixtureReport, 'utf8'));
      assert.equal(policy.ok, true, 'Oxc policy-fixture did not establish the required fixture policy');
      report.preflight.report = { path: relative(fixtureReport), sha256: hash(await readFile(fixtureReport)) };
    } else report.preflight = { skipped: true, reason: 'Terser-only baseline; no Oxc comparison requested' };
    const plan = option.variants.map((variant) => ({ id: `warmup-${variant}`, variant, warmup: true, pair: null }));
    for (let pair = 1; pair <= option.runs; pair++) for (const variant of pair % 2 ? option.variants : [...option.variants].reverse())
      plan.push({ id: `pair-${String(pair).padStart(2, '0')}-${variant}`, variant, warmup: false, pair });
    report.plan = plan;
    report.status = 'running';
    await saveJson(summaryPath, report);
    for (const entry of plan) {
      assert.ok(!abort.signal.aborted, 'Benchmark interrupted');
      const outDir = path.join(output, 'outputs', entry.id);
      const cacheDir = path.join(output, 'cache', entry.id);
      const configReport = path.join(output, 'config', `${entry.id}.json`);
      await mkdir(outDir);
      await mkdir(cacheDir);
      const cache = await clearConfigLoaderCache();
      console.log(`[benchmark] ${entry.id}; build timer starts in a fresh process`);
      const measurement = { ...entry, outDir: relative(outDir), cacheDir: relative(cacheDir), configReport: relative(configReport),
        configLoaderCacheBefore: cache, freeMemoryBytesBefore: os.freemem(),
        ...await runChild(process.execPath, [worker, '--variant', entry.variant, '--out-dir', outDir, '--cache-dir', cacheDir, '--config-report', configReport], env,
          path.join(output, 'logs', `${entry.id}.stdout.txt`), path.join(output, 'logs', `${entry.id}.stderr.txt`), abort.signal) };
      report.measurements.push(measurement);
      await saveJson(summaryPath, report); // Preserve exit/spawn evidence even if subsequent validation fails.
      assert.ok(measurement.exitCode === 0 && !measurement.spawnError && measurement.signal === null, `${entry.id} failed; inspect saved logs`);
      const config = JSON.parse(await readFile(configReport, 'utf8'));
      const profile = comparableProfile(config);
      if (!baselineProfile) baselineProfile = profile;
      else assert.deepEqual(profile, baselineProfile, `${entry.id} changed the common build profile`);
      measurement.configSha256 = hash(await readFile(configReport));
      console.log(`[benchmark] ${entry.id}: ${(measurement.elapsedMs / 1000).toFixed(3)} s; inventory/compression outside timer`);
      const outputs = await inventory(outDir);
      const inventoryPath = path.join(output, 'inventories', `${entry.id}.json`);
      await saveJson(inventoryPath, outputs);
      measurement.inventory = { path: relative(inventoryPath), sha256: hash(await readFile(inventoryPath)) };
      measurement.totals = outputs.totals;
      report.statistics = summarize(report.measurements);
      await saveJson(summaryPath, report);
    }
    assert.equal(report.measurements.length, option.variants.length * (1 + option.runs));
    if (option.variants.length === 2) assert.equal(report.statistics.pairs.length, option.runs);
    report.status = 'built'; // Complete only after the source-drift check below.
  } catch (error) {
    report.status = 'failed';
    report.error = { name: error.name, message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    try {
      const after = await sourceSnapshot();
      await saveJson(path.join(output, 'sources/after.json'), after);
      const old = new Map(before?.manifest.map((file) => [file.path, file.sha256]) ?? []);
      const next = new Map(after.manifest.map((file) => [file.path, file.sha256]));
      const changedPaths = [...new Set([...old.keys(), ...next.keys()])].filter((filename) => old.get(filename) !== next.get(filename));
      report.sourceIntegrity = { beforeHead: before?.head ?? null, afterHead: after.head,
        beforeSha256: before?.sha256 ?? null, afterSha256: after.sha256, changedPaths,
        unchanged: Boolean(before && before.sha256 === after.sha256 && before.head === after.head) };
      if (!report.sourceIntegrity.unchanged) { report.status = 'failed'; process.exitCode = 1; }
      else if (report.status === 'built') report.status = 'complete';
    } catch (error) {
      report.status = 'failed';
      report.integrityError = { name: error.name, message: error.message };
      process.exitCode = 1;
    }
    try {
      const harnessAfter = await harnessSnapshot();
      await saveJson(path.join(output, 'sources/harness-after.json'), harnessAfter);
      report.harnessIntegrity = compareHarnessSnapshots(harnessBefore, harnessAfter);
      if (!report.harnessIntegrity.unchanged) { report.status = 'failed'; process.exitCode = 1; }
    } catch (error) {
      report.status = 'failed';
      report.harnessIntegrityError = { name: error.name, message: error.message };
      process.exitCode = 1;
    }
    report.statistics = summarize(report.measurements);
    report.endedAt = new Date().toISOString();
    await saveJson(summaryPath, report);
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    console.log(JSON.stringify({ status: report.status, summary: relative(summaryPath), error: report.error?.message ?? null }));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const option = options();
    if (option) await main(option);
  } catch (error) {
    console.error(`[benchmark] ${error.message}`);
    process.exitCode = 1;
  }
}
