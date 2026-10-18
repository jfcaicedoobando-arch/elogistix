import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { isolatedEnvironment } from './integration.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const harnessPrefix = 'docs/qa/tailwind-integration-20261017/';
const worker = fileURLToPath(new URL('./build-worker.mjs', import.meta.url));
const variants = ['postcss', 'vite'];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const slash = (value) => value.split(path.sep).join('/');
const relative = (value) => slash(path.relative(root, value));
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
const inside = (parent, candidate) => {
  const rel = path.relative(parent, candidate);
  return rel && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
};

export function resolveBunCommand(argument) {
  return path.isAbsolute(argument) || /[\\/]/.test(argument) || /^[a-z]:/i.test(argument)
    ? path.resolve(root, argument) : argument;
}

function options() {
  if (process.argv.includes('--help')) {
    console.log('Usage: node docs/qa/tailwind-integration-20261017/run-builds.mjs --pairs 13 --initial-pairs 3 --output reports/tailwind-integration/NEW-RUN --idle-window "confirmed conditions" --bun ../.tools/bun.exe');
    console.log('Every pair builds PostCSS and Vite integrations in fresh Node processes. --pairs 1 --initial-pairs 0 is a two-build preflight. No discarded warmups or claims of cold OS / persistent build cache.');
    return null;
  }
  const result = { pairs: 13, 'initial-pairs': 3 };
  const seen = new Set();
  for (let index = 2; index < process.argv.length; index += 2) {
    const flag = process.argv[index];
    const value = process.argv[index + 1];
    assert.ok(['--pairs', '--initial-pairs', '--output', '--idle-window', '--bun'].includes(flag) && value && !value.startsWith('--'), `Invalid option: ${flag}`);
    assert.ok(!seen.has(flag), `Repeated option: ${flag}`);
    seen.add(flag);
    result[flag.slice(2)] = value;
  }
  result.pairs = Number(result.pairs);
  result['initial-pairs'] = Number(result['initial-pairs']);
  assert.ok(Number.isInteger(result.pairs) && result.pairs >= 1, '--pairs must be an integer >=1');
  assert.ok(Number.isInteger(result['initial-pairs']) && result['initial-pairs'] >= 0 && result['initial-pairs'] <= result.pairs,
    '--initial-pairs must be an integer between zero and --pairs');
  for (const key of ['output', 'idle-window', 'bun']) assert.ok(result[key]?.trim(), `--${key} is required`);
  return result;
}

export function buildPlan(pairs, initialPairs) {
  return Array.from({ length: pairs }, (_, index) => {
    const pair = index + 1;
    const phase = pair <= initialPairs ? 'initial' : 'repeated';
    return (pair % 2 ? variants : [...variants].reverse()).map((variant) => ({
      id: `${phase}-${String(pair).padStart(2, '0')}-${variant}`, pair, phase, variant,
      discarded: false,
    }));
  }).flat();
}

async function createOutput(argument) {
  const output = path.resolve(root, argument);
  assert.ok(inside(path.join(root, 'reports'), output), '--output must be a new subdirectory of this checkout reports/');
  const rootReal = await realpath(root);
  let current = root;
  for (const part of path.relative(root, output).split(path.sep)) {
    current = path.join(current, part);
    try {
      const stat = await lstat(current);
      assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), 'Output ancestors must be ordinary directories');
      assert.ok(inside(rootReal, await realpath(current)), 'Output path escaped this checkout');
      assert.notEqual(current, output, '--output already exists; select a new directory');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(output);
  for (const name of ['outputs', 'cache', 'temp', 'config', 'logs', 'inventories', 'sources']) await mkdir(path.join(output, name));
  return output;
}

async function saveJson(filename, data) {
  await writeFile(`${filename}.tmp`, `${JSON.stringify(data, null, 2)}\n`);
  await rename(`${filename}.tmp`, filename);
}

async function filesIn(directory, skip = () => false) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (skip(filename)) continue;
    assert.ok(!entry.isSymbolicLink(), `Unexpected symlink: ${relative(filename)}`);
    if (entry.isDirectory()) files.push(...await filesIn(filename, skip));
    else if (entry.isFile()) files.push(filename);
  }
  return files.sort();
}

export async function inputSnapshot(kind = 'tracked') {
  const files = kind === 'tracked'
    ? git('ls-files', '-z').split('\0').filter((name) => name && !name.startsWith(harnessPrefix) && !name.startsWith('reports/')).sort()
      .map((name) => path.join(root, name))
    : (await filesIn(path.join(root, harnessPrefix), (filename) =>
      /^(?:evidence|reports|outputs)(?:\/|$)/.test(slash(path.relative(path.join(root, harnessPrefix), filename)))))
      .filter((filename) => filename.endsWith('.mjs'));
  assert.ok(files.length, `Empty ${kind} input manifest`);
  const manifest = [];
  for (const filename of files) manifest.push({ path: relative(filename), sha256: sha256(await readFile(filename)) });
  return { capturedAt: new Date().toISOString(), kind, head: git('rev-parse', 'HEAD').trim(),
    sha256: sha256(JSON.stringify(manifest)), count: manifest.length, manifest };
}

export function compareInputs(before, after) {
  const old = new Map(before?.manifest.map((file) => [file.path, file.sha256]) ?? []);
  const next = new Map(after.manifest.map((file) => [file.path, file.sha256]));
  const changedPaths = [...new Set([...old.keys(), ...next.keys()])].filter((filename) => old.get(filename) !== next.get(filename)).sort();
  return { beforeSha256: before?.sha256 ?? null, afterSha256: after.sha256,
    beforeHead: before?.head ?? null, afterHead: after.head, changedPaths,
    unchanged: Boolean(before && before.sha256 === after.sha256 && before.head === after.head && changedPaths.length === 0) };
}

async function packageVersion(name) {
  for (const origin of ['package.json', 'node_modules/vite/package.json']) {
    try {
      const require = createRequire(path.join(root, origin));
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

async function clearConfigLoaderCache() {
  const directory = path.join(root, 'node_modules/.vite-temp');
  const parent = await realpath(path.dirname(directory));
  assert.equal(parent, path.join(await realpath(root), 'node_modules'), 'Refuse to clear a shared node_modules cache');
  let removedFiles = [];
  try {
    const stat = await lstat(directory);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), 'Refuse to clear a linked .vite-temp');
    assert.equal(await realpath(directory), path.join(parent, '.vite-temp'));
    removedFiles = (await filesIn(directory)).map(relative);
    await rm(directory, { recursive: true });
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return { path: relative(directory), removedFiles, policy: 'Clear only the verified checkout-local Vite config-loader cache before each build' };
}

async function runChild(args, env, stdoutPath, stderrPath, signal) {
  const stdout = createWriteStream(stdoutPath, { flags: 'wx' });
  const stderr = createWriteStream(stderrPath, { flags: 'wx' });
  let spawnError = null;
  const startedAt = new Date().toISOString();
  const start = performance.now();
  const child = spawn(process.execPath, args, { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], signal });
  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);
  child.on('error', (error) => { spawnError = { name: error.name, code: error.code ?? null, message: error.message }; });
  const exit = await new Promise((resolve) => child.on('close', (code, exitSignal) => resolve({
    exitCode: code, signal: exitSignal, elapsedMs: performance.now() - start, endedAt: new Date().toISOString(),
  })));
  await Promise.all([finished(stdout), finished(stderr)]);
  return { command: [process.execPath, ...args], startedAt, ...exit, spawnError,
    logs: { stdout: { path: relative(stdoutPath), sha256: sha256(await readFile(stdoutPath)) },
      stderr: { path: relative(stderrPath), sha256: sha256(await readFile(stderrPath)) } } };
}

async function rawInventory(outDir) {
  const all = await filesIn(outDir);
  assert.ok(!all.some((filename) => filename.endsWith('.map')), 'Unexpected emitted sourcemap');
  const files = [];
  for (const filename of all.filter((value) => /\.(?:[cm]?js|css)$/i.test(value))) {
    const bytes = await readFile(filename);
    files.push({ path: slash(path.relative(outDir, filename)), type: filename.endsWith('.css') ? 'css' : 'js',
      rawBytes: bytes.length, sha256: sha256(bytes) });
  }
  assert.ok(files.some((file) => file.type === 'js') && files.some((file) => file.type === 'css'), 'Missing JS or CSS');
  return { analysisStatus: 'raw-only', files, allOutputFiles: all.length, emittedSourceMaps: 0 };
}

export function statistics(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const sampleSD = values.length > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)) : null;
  return { n: values.length, min: sorted[0], max: sorted.at(-1), mean,
    median: (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.floor(sorted.length / 2)]) / 2,
    sampleSD, cv: sampleSD === null || mean === 0 ? null : sampleSD / Math.abs(mean) };
}

export function summarize(measurements) {
  const result = {};
  for (const phase of ['initial', 'repeated']) {
    const runs = measurements.filter((run) => run.phase === phase && run.exitCode === 0 && !run.spawnError && !run.signal);
    const byVariant = Object.fromEntries(variants.map((variant) => {
      const selected = runs.filter((run) => run.variant === variant);
      const sizes = {};
      if (selected.length && selected.every((run) => run.totals)) for (const type of ['js', 'css', 'combined'])
        sizes[type] = Object.fromEntries(['rawBytes', 'gzipBytes', 'brotliBytes'].map((metric) =>
          [metric, statistics(selected.map((run) => run.totals[type][metric]))]));
      return [variant, { elapsedMs: statistics(selected.map((run) => run.elapsedMs)), sizes,
        cssRules: selected.length && selected.every((run) => run.totals) ? statistics(selected.map((run) => run.totals.css.rules)) : null }];
    }));
    const pairs = [];
    for (const pair of [...new Set(runs.map((run) => run.pair))]) {
      const a = runs.find((run) => run.pair === pair && run.variant === 'postcss');
      const b = runs.find((run) => run.pair === pair && run.variant === 'vite');
      if (a && b) pairs.push({ pair, postcssMs: a.elapsedMs, viteMs: b.elapsedMs, deltaMs: a.elapsedMs - b.elapsedMs,
        percentLessTime: 100 * (a.elapsedMs - b.elapsedMs) / a.elapsedMs, speedup: a.elapsedMs / b.elapsedMs });
    }
    result[phase] = { byVariant, pairs, pairedStatistics: Object.fromEntries(['deltaMs', 'percentLessTime', 'speedup']
      .map((metric) => [metric, statistics(pairs.map((pair) => pair[metric]))])) };
  }
  return result;
}

function commonProfile(config) {
  const keys = ['target', 'cssTarget', 'cssMinify', 'cssCodeSplit', 'sourcemap', 'minify', 'terserOptions',
    'reportCompressedSize', 'rolldownTransformTarget', 'oxcTransformTarget'];
  return { mode: config.mode, envDir: config.envDir, syntheticPublicEnvironment: config.syntheticPublicEnvironment,
    css: { transformer: config.css.transformer, devSourcemap: config.css.devSourcemap },
    ...Object.fromEntries(keys.map((key) => [key, config.build[key]])) };
}

async function analyzeOutputs(output, report) {
  const { default: postcss } = await import('postcss');
  const cache = new Map();
  let references = 0;
  const parameters = { gzip: { level: 9 }, brotli: { quality: 11, mode: 'TEXT', sizeHint: 'rawBytes' },
    node: process.version, zlib: process.versions.zlib, brotliVersion: process.versions.brotli,
    cssRules: 'PostCSS walkRules node count, including nested and keyframe rules; not unique selectors or utility classes' };
  const parametersSha256 = sha256(JSON.stringify(parameters));
  for (const run of report.measurements) {
    const filename = path.join(root, run.inventory.path);
    const inventory = JSON.parse(await readFile(filename, 'utf8'));
    for (const file of inventory.files) {
      const bytes = await readFile(path.join(root, run.outDir, file.path));
      assert.equal(sha256(bytes), file.sha256, `Output changed before compression: ${run.id}/${file.path}`);
      let compressed = cache.get(file.sha256);
      if (!compressed) {
        const gzip = gzipSync(bytes, { level: 9 });
        const brotli = brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
          [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length } });
        compressed = { rawBytes: bytes.length, gzipBytes: gzip.length, brotliBytes: brotli.length,
          gzipSha256: sha256(gzip), brotliSha256: sha256(brotli), firstReference: `${run.id}/${file.path}` };
        cache.set(file.sha256, compressed);
      }
      if (file.type === 'css' && compressed.cssRules === undefined) {
        let rules = 0;
        postcss.parse(bytes.toString('utf8'), { from: file.path }).walkRules(() => { rules++; });
        compressed.cssRules = rules;
      }
      Object.assign(file, { gzipBytes: compressed.gzipBytes, brotliBytes: compressed.brotliBytes,
        gzipSha256: compressed.gzipSha256, brotliSha256: compressed.brotliSha256,
        compressionKey: `${parametersSha256}:${file.sha256}`, compressionFirstReference: compressed.firstReference,
        ...(file.type === 'css' ? { rules: compressed.cssRules } : {}) });
      references++;
    }
    inventory.totals = Object.fromEntries(['js', 'css', 'combined'].map((type) => {
      const files = inventory.files.filter((file) => type === 'combined' || file.type === type);
      return [type, { files: files.length, ...Object.fromEntries(['rawBytes', 'gzipBytes', 'brotliBytes', 'rules']
        .map((metric) => [metric, files.reduce((sum, file) => sum + (file[metric] ?? 0), 0)])) }];
    }));
    inventory.analysisStatus = 'complete';
    await saveJson(filename, inventory);
    run.inventory.sha256 = sha256(await readFile(filename));
    run.totals = inventory.totals;
    report.statistics = summarize(report.measurements);
    await saveJson(path.join(output, 'summary.json'), report);
  }
  const compression = { parameters, parametersSha256, references, uniqueContents: cache.size,
    reusedReferences: references - cache.size, entries: Object.fromEntries(cache) };
  await saveJson(path.join(output, 'compression-cache.json'), compression);
  report.compression = { path: relative(path.join(output, 'compression-cache.json')),
    sha256: sha256(await readFile(path.join(output, 'compression-cache.json'))), references,
    uniqueContents: cache.size, reusedReferences: references - cache.size, parameters };
}

async function main(option) {
  const output = await createOutput(option.output);
  const summaryPath = path.join(output, 'summary.json');
  const env = isolatedEnvironment('production');
  const abort = new AbortController();
  const interrupt = () => abort.abort();
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  const report = { schemaVersion: 1, status: 'preparing', startedAt: new Date().toISOString(),
    output: relative(output), command: [process.execPath, ...process.argv.slice(1)], measurements: [],
    idleWindowStatement: option['idle-window'], plan: buildPlan(option.pairs, option['initial-pairs']),
    conditions: {
      timer: 'Fresh Node process for every build; elapsed wall time from spawn to close.',
      caches: 'Fresh output/cacheDir and verified checkout-local .vite-temp cleared per build. OS filesystem cache is warm/uncontrolled, not cold. No persistent production compiler cache is assumed.',
      temporaryFiles: 'Each child receives fresh checkout-local TEMP/TMP/TMPDIR below its report directory.',
      phases: 'Initial pairs are retained and reported separately from repeated pairs. No discarded warmup builds. Repeated means repetition in new processes, not a warm compiler.',
      compression: 'Deferred until all timed builds finish; each unique raw SHA256 compressed once with common parameters; totals sum separately compressed resources.',
      inference: 'Descriptive local samples only; no population confidence claim or automatic adoption threshold.',
      installation: { requiredCommand: 'bun install --frozen-lockfile --ignore-scripts', performedByHarness: false,
        excludedFromTiming: true, evidence: 'See accompanying frozen-install and dependency-diff records.' },
      backend: 'No browser/backend is invoked. envDir=false and synthetic Supabase public values point to loopback port 9.',
    },
    environment: { inheritedKeys: Object.keys(env).filter((key) => !['NODE_ENV', 'NODE_OPTIONS', 'ANALYZE', 'CI_REPORT_COMPRESSED_SIZE'].includes(key) && !key.startsWith('VITE_')).sort(),
      explicit: Object.fromEntries(['NODE_ENV', 'NODE_OPTIONS', 'ANALYZE', 'CI_REPORT_COMPRESSED_SIZE', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'].map((key) => [key, env[key]])),
      envDir: false, buildSourcemapsOverride: false, sentryCredentialsInherited: false },
  };
  const before = {};
  let baselineProfile;
  try {
    for (const kind of ['tracked', 'harness']) {
      before[kind] = await inputSnapshot(kind);
      await saveJson(path.join(output, 'sources', `${kind}-before.json`), before[kind]);
    }
    const bunCommand = resolveBunCommand(option.bun);
    const cpus = os.cpus();
    report.runtime = { node: process.version, nodeExecutable: process.execPath, versions: process.versions,
      bun: execFileSync(bunCommand, ['--version'], { cwd: root, env, encoding: 'utf8', windowsHide: true }).trim(),
      bunCommand, bunResolution: path.isAbsolute(bunCommand) ? 'explicit path' : 'PATH',
      os: { platform: os.platform(), release: os.release(), version: os.version(), arch: os.arch() },
      cpu: { model: cpus[0]?.model, logicalCount: cpus.length, availableParallelism: os.availableParallelism() }, totalMemoryBytes: os.totalmem() };
    report.packages = Object.fromEntries(await Promise.all(['vite', 'rolldown', 'terser', 'lightningcss', 'postcss', 'tailwindcss', '@tailwindcss/postcss', '@tailwindcss/vite']
      .map(async (name) => [name, await packageVersion(name)])));
    report.base = { head: before.tracked.head, sourceSha256: before.tracked.sha256, trackedInputFiles: before.tracked.count,
      harnessSha256: before.harness.sha256, harnessFiles: before.harness.count,
      trackedDirtyPaths: git('diff', '--name-only', 'HEAD').trim().split('\n').filter(Boolean),
      excludedTrackedPrefixes: [harnessPrefix, 'reports/'],
      hashes: Object.fromEntries(await Promise.all(['package.json', 'bun.lock', 'vite.config.ts', 'postcss.config.js', 'tailwind.config.ts', 'src/index.css', 'src/styles.css', 'src/tailwind-compat.css']
        .map(async (filename) => [filename, sha256(await readFile(path.join(root, filename)))]))) };
    report.status = 'running';
    await saveJson(summaryPath, report);
    for (const entry of report.plan) {
      assert.ok(!abort.signal.aborted, 'Build series interrupted');
      const outDir = path.join(output, 'outputs', entry.id);
      const cacheDir = path.join(output, 'cache', entry.id);
      const tempDir = path.join(output, 'temp', entry.id);
      const configReport = path.join(output, 'config', `${entry.id}.json`);
      await mkdir(outDir);
      await mkdir(cacheDir);
      await mkdir(tempDir);
      const buildEnvironment = { ...Object.fromEntries(Object.entries(env)
        .filter(([key]) => !['TEMP', 'TMP', 'TMPDIR'].includes(key.toUpperCase()))),
      TEMP: tempDir, TMP: tempDir, TMPDIR: tempDir };
      const configLoaderCacheBefore = await clearConfigLoaderCache();
      console.log(`[build-series] ${entry.id}; fresh process, build timer starts`);
      const measurement = { ...entry, outDir: relative(outDir), cacheDir: relative(cacheDir), tempDir: relative(tempDir), configReport: relative(configReport),
        configLoaderCacheBefore, freeMemoryBytesBefore: os.freemem(),
        ...await runChild([worker, '--variant', entry.variant, '--out-dir', outDir, '--cache-dir', cacheDir, '--config-report', configReport], buildEnvironment,
          path.join(output, 'logs', `${entry.id}.stdout.txt`), path.join(output, 'logs', `${entry.id}.stderr.txt`), abort.signal) };
      report.measurements.push(measurement);
      report.statistics = summarize(report.measurements);
      await saveJson(summaryPath, report);
      assert.ok(measurement.exitCode === 0 && !measurement.spawnError && measurement.signal === null, `${entry.id} failed; inspect saved logs`);
      const config = JSON.parse(await readFile(configReport, 'utf8'));
      const profile = commonProfile(config);
      if (!baselineProfile) baselineProfile = profile;
      else assert.deepEqual(profile, baselineProfile, `${entry.id} changed the common build profile`);
      measurement.configSha256 = sha256(await readFile(configReport));
      const bundleReport = path.join(outDir, '.qa-build-metadata.json');
      measurement.bundleReport = relative(bundleReport);
      measurement.bundleSha256 = sha256(await readFile(bundleReport));
      const inventoryPath = path.join(output, 'inventories', `${entry.id}.json`);
      await saveJson(inventoryPath, await rawInventory(outDir));
      measurement.inventory = { path: relative(inventoryPath), sha256: sha256(await readFile(inventoryPath)) };
      console.log(`[build-series] ${entry.id}: ${(measurement.elapsedMs / 1000).toFixed(3)} s; raw hashes saved, compression deferred`);
      await saveJson(summaryPath, report);
    }
    assert.equal(report.measurements.length, option.pairs * 2);
    assert.equal(report.statistics.initial.pairs.length, option['initial-pairs']);
    assert.equal(report.statistics.repeated.pairs.length, option.pairs - option['initial-pairs']);
    assert.ok(!abort.signal.aborted, 'Interrupted before output analysis');
    report.status = 'analyzing';
    report.timedBuildsEndedAt = new Date().toISOString();
    await saveJson(summaryPath, report);
    console.log('[build-series] All build timers ended; deduplicated compression/CSS rule analysis starts');
    await analyzeOutputs(output, report);
    report.status = 'built';
  } catch (error) {
    report.status = 'failed';
    report.error = { name: error.name, message: error.message, stack: error.stack };
    process.exitCode = 1;
  } finally {
    report.inputIntegrity = {};
    for (const kind of ['tracked', 'harness']) {
      try {
        const after = await inputSnapshot(kind);
        await saveJson(path.join(output, 'sources', `${kind}-after.json`), after);
        report.inputIntegrity[kind] = compareInputs(before[kind], after);
        if (!report.inputIntegrity[kind].unchanged) { report.status = 'failed'; process.exitCode = 1; }
      } catch (error) {
        report.status = 'failed';
        report.inputIntegrity[kind] = { unchanged: false, error: { name: error.name, message: error.message } };
        process.exitCode = 1;
      }
    }
    if (report.status === 'built' && !abort.signal.aborted) report.status = 'complete';
    else if (abort.signal.aborted) { report.status = 'failed'; process.exitCode = 1; }
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
    console.error(`[build-series] ${error.message}`);
    process.exitCode = 1;
  }
}
