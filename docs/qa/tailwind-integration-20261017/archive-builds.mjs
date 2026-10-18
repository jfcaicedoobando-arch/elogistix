#!/usr/bin/env node
// Run only after QA/HMR/build measurements finish. No subprocesses or source edits.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const slash = (value) => value.split(path.sep).join('/');
const isSha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const inside = (parent, candidate) => {
  const rel = path.relative(parent, candidate);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
};
const samePath = (first, second) => path.relative(first, second) === '';

function relativePath(value) {
  assert.ok(typeof value === 'string' && value.length > 0 && !/[\u0000-\u001f:]/.test(value), 'Invalid relative path');
  assert.ok(!path.isAbsolute(value) && !path.win32.isAbsolute(value) && !path.posix.isAbsolute(value), 'Absolute recorded path is prohibited');
  const parts = value.split(/[\\/]/);
  assert.ok(parts.every((part) => part && part !== '.' && part !== '..'), `Unsafe relative path: ${value}`);
  return parts.join('/');
}

function help() {
  console.log('Usage: node consolidate-tailwind-builds.mjs --input reports/tailwind-integration/build-series --output docs/qa/tailwind-integration-20261017/evidence/build-series');
  console.log('Run from the repository root, or use absolute paths. Defaults: --expected-pairs 13 --initial-pairs 3. Input and output must be separate; output must be new.');
  console.log('Verification: node consolidate-tailwind-builds.mjs --verify docs/qa/tailwind-integration-20261017/evidence/build-series');
  console.log('All raw JS/CSS files are verified locally, but full product bundles are NOT archived/published. No builds, compression, subprocesses, backend requests or source changes are performed.');
}

function options() {
  if (process.argv.includes('--help')) { help(); return null; }
  const result = { 'expected-pairs': 13, 'initial-pairs': 3 };
  const seen = new Set();
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    const value = process.argv[index + 1];
    assert.ok(['--input', '--output', '--expected-pairs', '--initial-pairs', '--verify'].includes(key) && value && !value.startsWith('--'), `Invalid option: ${key}`);
    assert.ok(!seen.has(key), `Repeated option: ${key}`);
    seen.add(key);
    result[key.slice(2)] = value;
  }
  if (result.verify) {
    assert.equal(seen.size, 1, '--verify cannot be combined with consolidation options');
    return result;
  }
  assert.ok(result.input?.trim() && result.output?.trim(), '--input and --output are required');
  for (const key of ['expected-pairs', 'initial-pairs']) result[key] = Number(result[key]);
  assert.ok(integer(result['expected-pairs']) && result['expected-pairs'] > 0, '--expected-pairs must be a positive integer');
  assert.ok(integer(result['initial-pairs']) && result['initial-pairs'] <= result['expected-pairs'], '--initial-pairs must be between zero and --expected-pairs');
  return result;
}

async function checkedDirectory(directory) {
  const absolute = path.resolve(directory);
  const stat = await lstat(absolute);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), `Not an ordinary directory: ${absolute}`);
  assert.ok(samePath(await realpath(absolute), absolute), `Linked directory ancestry is prohibited: ${absolute}`);
  return absolute;
}

async function checkedFile(base, filename) {
  const rel = relativePath(filename);
  const full = path.resolve(base, rel);
  assert.ok(inside(base, full), `File escaped its directory: ${rel}`);
  let current = base;
  const parts = rel.split('/');
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    const stat = await lstat(current);
    assert.ok(!stat.isSymbolicLink(), `Symlink is prohibited: ${current}`);
    assert.ok(index === parts.length - 1 ? stat.isFile() : stat.isDirectory(), `Unexpected file type: ${current}`);
  }
  assert.ok(samePath(await realpath(full), full), `File ancestry escaped its directory: ${rel}`);
  return full;
}

async function readChecked(base, filename, expectedSha256 = null) {
  if (expectedSha256 !== null) assert.ok(isSha256(expectedSha256), `Invalid expected SHA256: ${filename}`);
  const absolute = await checkedFile(base, filename);
  const bytes = await readFile(absolute);
  const sha256 = digest(bytes);
  if (expectedSha256 !== null) assert.equal(sha256, expectedSha256, `SHA256 mismatch: ${filename}`);
  return { absolute, sourcePath: relativePath(filename), bytes, sha256 };
}

async function rawFileHash(base, filename) {
  const absolute = await checkedFile(base, filename);
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(absolute)) { hash.update(chunk); bytes += chunk.length; }
  return { sha256: hash.digest('hex'), bytes };
}

async function createFreshDirectory(directory) {
  const absolute = path.resolve(directory);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  const parts = absolute.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for (const [index, part] of parts.entries()) {
    current = path.join(current, part);
    try {
      const stat = await lstat(current);
      assert.ok(stat.isDirectory() && !stat.isSymbolicLink(), `Output ancestry must be ordinary directories: ${current}`);
      assert.ok(samePath(await realpath(current), current), `Linked output ancestry: ${current}`);
      assert.notEqual(index, parts.length - 1, `Output already exists: ${absolute}`);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await mkdir(path.dirname(absolute), { recursive: true });
  await mkdir(absolute);
  return absolute;
}

async function archiveTreeFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = prefix ? `${prefix}/${entry.name}` : entry.name;
    assert.ok(!entry.isSymbolicLink(), `Symlink in archive tree: ${filename}`);
    if (entry.isDirectory()) files.push(...await archiveTreeFiles(path.join(directory, entry.name), filename));
    else {
      assert.ok(entry.isFile(), `Unexpected archive entry: ${filename}`);
      files.push(relativePath(filename));
    }
  }
  return files.sort();
}

function validateSeries(summary, option) {
  assert.equal(summary.schemaVersion, 1);
  assert.equal(summary.status, 'complete', 'Only a complete series may be consolidated');
  assert.equal(summary.measurements?.length, option['expected-pairs'] * 2);
  assert.equal(summary.plan?.length, summary.measurements.length);
  assert.ok(summary.idleWindowStatement?.trim(), 'Missing idle-window statement');
  assert.equal(summary.inputIntegrity?.tracked?.unchanged, true);
  assert.equal(summary.inputIntegrity?.harness?.unchanged, true);
  const identifiers = new Set();
  for (const [index, run] of summary.measurements.entries()) {
    assert.ok(/^(?:initial|repeated)-\d{2,}-(?:postcss|vite)$/.test(run.id), `Unexpected run ID: ${run.id}`);
    assert.ok(!identifiers.has(run.id), `Duplicate run ID: ${run.id}`);
    identifiers.add(run.id);
    const pair = Math.floor(index / 2) + 1;
    const expectedVariant = (pair % 2 ? ['postcss', 'vite'] : ['vite', 'postcss'])[index % 2];
    const phase = pair <= option['initial-pairs'] ? 'initial' : 'repeated';
    assert.equal(run.pair, pair, 'Unexpected pair order');
    assert.equal(run.phase, phase, 'Incorrect phase');
    assert.equal(run.variant, expectedVariant, 'Incorrect AB/BA order');
    assert.equal(run.id, `${phase}-${String(pair).padStart(2, '0')}-${expectedVariant}`);
    assert.equal(run.discarded, false, 'Initial pairs must be retained');
    for (const key of ['id', 'pair', 'phase', 'variant', 'discarded']) assert.deepEqual(run[key], summary.plan[index][key]);
    assert.equal(run.exitCode, 0, `Failed build: ${run.id}`);
    assert.equal(run.signal, null, `Signalled build: ${run.id}`);
    assert.equal(run.spawnError, null, `Spawn error: ${run.id}`);
    assert.ok(Number.isFinite(run.elapsedMs) && run.elapsedMs > 0, `Invalid elapsed time: ${run.id}`);
  }
  assert.equal(summary.statistics?.initial?.pairs?.length, option['initial-pairs']);
  assert.equal(summary.statistics?.repeated?.pairs?.length, option['expected-pairs'] - option['initial-pairs']);
}

function validateSnapshot(snapshot, kind) {
  assert.equal(snapshot.kind, kind);
  assert.equal(snapshot.count, snapshot.manifest?.length);
  assert.ok(isSha256(snapshot.sha256));
  assert.equal(digest(Buffer.from(JSON.stringify(snapshot.manifest))), snapshot.sha256, `${kind} manifest fingerprint mismatch`);
  const paths = new Set();
  for (const row of snapshot.manifest) {
    const filename = relativePath(row.path);
    assert.ok(!paths.has(filename), `Duplicate ${kind} input: ${filename}`);
    assert.ok(isSha256(row.sha256));
    paths.add(filename);
  }
}

function validateInventory(inventory, run, cache) {
  assert.equal(inventory.analysisStatus, 'complete', `Incomplete inventory: ${run.id}`);
  assert.equal(inventory.emittedSourceMaps, 0);
  assert.ok(integer(inventory.allOutputFiles));
  assert.ok(Array.isArray(inventory.files) && inventory.files.length > 0);
  const paths = new Set();
  for (const file of inventory.files) {
    const filename = relativePath(file.path);
    assert.ok(!paths.has(filename), `Duplicate inventory path: ${run.id}/${filename}`);
    paths.add(filename);
    assert.equal(file.type, filename.endsWith('.css') ? 'css' : 'js');
    assert.ok(/\.(?:[cm]?js|css)$/i.test(filename), `Unexpected measured resource: ${filename}`);
    assert.ok(isSha256(file.sha256) && isSha256(file.gzipSha256) && isSha256(file.brotliSha256));
    for (const metric of ['rawBytes', 'gzipBytes', 'brotliBytes']) assert.ok(integer(file[metric]), `Invalid ${metric}: ${filename}`);
    const entry = cache.entries[file.sha256];
    assert.ok(entry, `Content absent from compression cache: ${filename}`);
    for (const key of ['rawBytes', 'gzipBytes', 'brotliBytes', 'gzipSha256', 'brotliSha256']) assert.equal(file[key], entry[key], `${key} cache mismatch: ${filename}`);
    assert.equal(file.compressionKey, `${cache.parametersSha256}:${file.sha256}`);
    assert.equal(file.compressionFirstReference, entry.firstReference);
    if (file.type === 'css') {
      assert.ok(integer(file.rules));
      assert.equal(file.rules, entry.cssRules);
    }
  }
  const totals = Object.fromEntries(['js', 'css', 'combined'].map((type) => {
    const files = inventory.files.filter((file) => type === 'combined' || file.type === type);
    return [type, { files: files.length, ...Object.fromEntries(['rawBytes', 'gzipBytes', 'brotliBytes', 'rules']
      .map((metric) => [metric, files.reduce((sum, file) => sum + (file[metric] ?? 0), 0)])) }];
  }));
  assert.ok(totals.js.files > 0 && totals.css.files > 0);
  assert.deepEqual(inventory.totals, totals, `Inventory totals mismatch: ${run.id}`);
  assert.deepEqual(run.totals, totals, `Summary totals mismatch: ${run.id}`);
  return new Map(inventory.files.map((file) => [relativePath(file.path), file]));
}

function validateMetadata(metadata, run, measuredFiles) {
  assert.equal(metadata.schemaVersion, 1);
  assert.equal(metadata.variant, run.variant);
  assert.ok(Array.isArray(metadata.chunks) && metadata.chunks.length > 0);
  const names = new Set();
  for (const chunk of metadata.chunks) {
    const filename = relativePath(chunk.fileName);
    assert.ok(!names.has(filename), `Duplicate chunk metadata: ${run.id}/${filename}`);
    names.add(filename);
    assert.equal(measuredFiles.get(filename)?.type, 'js', `Chunk missing from inventory: ${filename}`);
    for (const key of ['moduleIds', 'imports', 'dynamicImports', 'css']) assert.ok(Array.isArray(chunk[key]), `Missing chunk ${key}`);
    for (const css of chunk.css) assert.equal(measuredFiles.get(relativePath(css))?.type, 'css', `CSS association missing from inventory: ${css}`);
  }
}

async function consolidate(option) {
  const input = await checkedDirectory(option.input);
  const summaryFile = await readChecked(input, 'summary.json');
  const summary = JSON.parse(summaryFile.bytes.toString('utf8'));
  validateSeries(summary, option);
  const declared = relativePath(summary.output);
  assert.ok(declared.startsWith('reports/'), 'Summary output must identify a reports directory');
  const repository = path.resolve(input, ...declared.split('/').map(() => '..'));
  assert.ok(samePath(path.resolve(repository, declared), input), 'Input directory does not match summary.output');
  await checkedDirectory(repository);
  const output = path.resolve(option.output);
  assert.ok(!samePath(input, output) && !inside(input, output) && !inside(output, input), 'Input and archive must be separate directory trees');
  const records = [];
  const archiveFiles = new Map();
  const objectKinds = new Map();
  const store = (record, target, kind) => {
    const archivePath = relativePath(target);
    const existing = archiveFiles.get(archivePath);
    if (existing) assert.ok(existing.bytes.equals(record.bytes), `Archive path collision: ${archivePath}`);
    else archiveFiles.set(archivePath, { bytes: record.bytes, sha256: record.sha256 });
    if (archivePath.startsWith('objects/')) {
      if (!objectKinds.has(archivePath)) objectKinds.set(archivePath, new Set());
      objectKinds.get(archivePath).add(kind);
    }
    const reference = { sourcePath: record.sourcePath, archivePath, sha256: record.sha256, bytes: record.bytes.length, kind };
    records.push(reference);
    return reference;
  };
  const source = async (recordedPath, expectedRelative, expectedSha256) => {
    const normalized = relativePath(recordedPath);
    const expected = `${declared}/${relativePath(expectedRelative)}`;
    assert.equal(normalized, expected, `Unexpected recorded source location: ${normalized}`);
    const record = await readChecked(input, expectedRelative, expectedSha256);
    record.sourcePath = normalized;
    return record;
  };
  const originalSummary = store({ ...summaryFile, sourcePath: `${declared}/summary.json` }, 'summary.json', 'original-summary');
  const compressionFile = await source(summary.compression.path, 'compression-cache.json', summary.compression.sha256);
  const cache = JSON.parse(compressionFile.bytes.toString('utf8'));
  assert.equal(cache.parametersSha256, digest(Buffer.from(JSON.stringify(cache.parameters))));
  assert.deepEqual(summary.compression.parameters, cache.parameters);
  assert.equal(cache.uniqueContents, Object.keys(cache.entries).length);
  assert.equal(summary.compression.uniqueContents, cache.uniqueContents);
  assert.equal(summary.compression.references, cache.references);
  assert.equal(cache.reusedReferences, cache.references - cache.uniqueContents);
  const compression = store(compressionFile, 'compression-cache.json', 'compression-cache');
  const snapshots = {};
  const sources = [];
  for (const kind of ['tracked', 'harness']) {
    snapshots[kind] = {};
    for (const when of ['before', 'after']) {
      const filename = `sources/${kind}-${when}.json`;
      const record = await readChecked(input, filename);
      record.sourcePath = `${declared}/${filename}`;
      const snapshot = JSON.parse(record.bytes.toString('utf8'));
      validateSnapshot(snapshot, kind);
      snapshots[kind][when] = snapshot;
      sources.push(store(record, `execution/${filename}`, `source-${kind}-${when}`));
    }
    const { before, after } = snapshots[kind];
    assert.equal(before.sha256, after.sha256, `Changed ${kind} inputs`);
    assert.equal(before.head, after.head, `Changed ${kind} HEAD`);
    assert.deepEqual(before.manifest, after.manifest, `Changed ${kind} manifest`);
    assert.equal(summary.inputIntegrity[kind].beforeSha256, before.sha256);
    assert.equal(summary.inputIntegrity[kind].afterSha256, after.sha256);
    assert.equal(summary.inputIntegrity[kind].beforeHead, before.head);
    assert.equal(summary.inputIntegrity[kind].afterHead, after.head);
    assert.deepEqual(summary.inputIntegrity[kind].changedPaths, []);
  }
  assert.equal(summary.base.head, snapshots.tracked.before.head);
  assert.equal(summary.base.sourceSha256, snapshots.tracked.before.sha256);
  assert.equal(summary.base.harnessSha256, snapshots.harness.before.sha256);
  const trackedHashes = new Map(snapshots.tracked.before.manifest.map((row) => [row.path, row.sha256]));
  for (const [filename, sha256] of Object.entries(summary.base.hashes)) assert.equal(trackedHashes.get(filename), sha256, `Base input hash mismatch: ${filename}`);
  const runs = [];
  let rawAssetReferences = 0;
  let rawAssetBytes = 0;
  const uniqueRawAssets = new Set();
  for (const run of summary.measurements) {
    console.log(`[consolidate] Verifying ${run.id}; no builds or compression`);
    assert.equal(relativePath(run.outDir), `${declared}/outputs/${run.id}`);
    const configFile = await source(run.configReport, `config/${run.id}.json`, run.configSha256);
    const config = JSON.parse(configFile.bytes.toString('utf8'));
    assert.equal(config.variant, run.variant);
    assert.equal(config.mode, 'production');
    assert.equal(config.envDir, false);
    assert.equal(config.build.minify, 'terser');
    assert.equal(config.build.sourcemap, false);
    const configRef = store(configFile, `execution/config/${run.id}.json`, 'resolved-config');
    const logs = {};
    for (const stream of ['stdout', 'stderr']) {
      const record = await source(run.logs[stream].path, `logs/${run.id}.${stream}.txt`, run.logs[stream].sha256);
      // Do not recreate a directory named logs: the repository ignores it.
      logs[stream] = store(record, `execution/${run.id}.${stream}.txt`, stream);
    }
    const inventoryFile = await source(run.inventory.path, `inventories/${run.id}.json`, run.inventory.sha256);
    const inventory = JSON.parse(inventoryFile.bytes.toString('utf8'));
    const measuredFiles = validateInventory(inventory, run, cache);
    const inventoryRef = store(inventoryFile, `objects/${inventoryFile.sha256}.json`, 'inventory');
    const metadataFile = await source(run.bundleReport, `outputs/${run.id}/.qa-build-metadata.json`, run.bundleSha256);
    validateMetadata(JSON.parse(metadataFile.bytes.toString('utf8')), run, measuredFiles);
    const metadataRef = store(metadataFile, `objects/${metadataFile.sha256}.json`, 'bundle-metadata');
    const outDir = await checkedDirectory(path.join(input, 'outputs', run.id));
    for (const [filename, measured] of measuredFiles) {
      const actual = await rawFileHash(outDir, filename);
      assert.equal(actual.sha256, measured.sha256, `Raw asset hash mismatch: ${run.id}/${filename}`);
      assert.equal(actual.bytes, measured.rawBytes, `Raw asset size mismatch: ${run.id}/${filename}`);
      rawAssetReferences++;
      rawAssetBytes += actual.bytes;
      uniqueRawAssets.add(actual.sha256);
    }
    runs.push({ id: run.id, phase: run.phase, pair: run.pair, variant: run.variant, elapsedMs: run.elapsedMs,
      config: configRef, logs, inventory: inventoryRef, bundleMetadata: metadataRef,
      rawAssetsVerified: measuredFiles.size, totals: run.totals });
  }
  assert.equal(rawAssetReferences, cache.references);
  assert.equal(uniqueRawAssets.size, cache.uniqueContents);
  const objectReferences = records.filter((record) => record.archivePath.startsWith('objects/'));
  const index = {
    schemaVersion: 1, status: 'verified', createdAt: new Date().toISOString(),
    command: [process.execPath, ...process.argv.slice(1)], sourceOutput: declared,
    baseHead: summary.base.head, originalSummary, compression, sources, runs,
    requirements: { pairs: option['expected-pairs'], initialPairs: option['initial-pairs'], repeatedPairs: option['expected-pairs'] - option['initial-pairs'] },
    deduplication: { policy: 'Exact original JSON bytes, keyed by SHA256; no path normalization or inventory rewriting.',
      logicalObjectReferences: objectReferences.length, storedObjects: objectKinds.size,
      logicalObjectBytes: objectReferences.reduce((total, row) => total + row.bytes, 0),
      storedObjectBytes: [...objectKinds.keys()].reduce((total, filename) => total + archiveFiles.get(filename).bytes.length, 0),
      objects: [...objectKinds].map(([archivePath, kinds]) => ({ archivePath, kinds: [...kinds].sort(),
        sha256: archiveFiles.get(archivePath).sha256, bytes: archiveFiles.get(archivePath).bytes.length })) },
    assets: { fullProductBundlesArchived: false, rawAssetReferencesVerified: rawAssetReferences,
      rawAssetBytesVerified: rawAssetBytes, uniqueRawContentsVerified: uniqueRawAssets.size,
      note: 'Full product bundles are not published. Their per-run names, raw/gzip/Brotli sizes, hashes and CSS counts remain in the inventories. Complete outputs remain in the local reports directory.' },
    verificationScope: 'Recorded log/config/inventory/metadata/cache hashes and raw emitted JS/CSS bytes were checked. Compression and CSS-rule analysis were not rerun; their values were cross-checked against the original hashed compression cache. Source manifests were internally hashed and checked against both captured endpoints, without re-reading current product sources.',
  };
  archiveFiles.set('index.json', { bytes: jsonBytes(index), sha256: digest(jsonBytes(index)) });
  const readme = Buffer.from([
    '# Evidencia consolidada de integraciones Tailwind', '',
    'No se publican bundles completos de producto. Los outputs completos permanecen en el directorio local reports; este archivo conserva inventarios y metadata verificables.', '',
    '`summary.json` es una copia exacta del resumen original. Sus rutas reports/ describen la ejecución local; `index.json` las relaciona con los archivos archivados.',
    'Los logs originales están en `execution/`, las configuraciones en `execution/config/` y las capturas de fuentes en `execution/sources/`.',
    'Los inventarios y metadata idénticos comparten `objects/<sha256>.json`. Se conservan sus bytes originales, sin normalizar rutas ni asumir igualdad por variante.',
    'Las capturas de fuentes se conservan completas y byte a byte; sus timestamps distintos no se eliminan para forzar deduplicación.', '',
    `Serie: ${option['expected-pairs']} pares; ${option['initial-pairs']} iniciales retenidos y ${option['expected-pairs'] - option['initial-pairs']} repetidos. La consolidación ocurre después de los intervalos medidos.`,
    'Se verificaron todos los recursos raw JS/CSS locales contra los inventarios. No se repitieron Brotli/gzip ni el conteo de reglas; se cotejaron con el compression-cache original y su hash.', '',
    'Para verificar el archivo sin los bundles locales:', '',
    '```powershell',
    'node RUTA_AL_CONSOLIDADOR/consolidate-tailwind-builds.mjs --verify RUTA_A_ESTA_CARPETA',
    '```', '',
    '`archive-manifest.json` contiene bytes y SHA256 de cada archivo publicado, incluidos summary, index, logs, configuración, sources y objetos. `archive-manifest.sha256` permite comprobar el propio manifiesto; estos hashes verifican integridad, no constituyen una firma independiente.', '',
  ].join('\n'));
  archiveFiles.set('README.md', { bytes: readme, sha256: digest(readme) });
  // Validation is complete before creating the new archive; no input is overwritten.
  await createFreshDirectory(output);
  for (const [filename, record] of archiveFiles) {
    const target = path.join(output, relativePath(filename));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, record.bytes, { flag: 'wx' });
  }
  const manifest = { schemaVersion: 1, createdAt: new Date().toISOString(),
    files: [...archiveFiles].map(([filename, record]) => ({ path: filename, sha256: record.sha256, bytes: record.bytes.length }))
      .sort((a, b) => a.path.localeCompare(b.path)) };
  const manifestBytes = jsonBytes(manifest);
  await writeFile(path.join(output, 'archive-manifest.json'), manifestBytes, { flag: 'wx' });
  await writeFile(path.join(output, 'archive-manifest.sha256'), `${digest(manifestBytes)}  archive-manifest.json\n`, { flag: 'wx' });
  await verifyArchive(output);
  console.log(JSON.stringify({ status: 'complete', output, runs: runs.length, storedObjects: objectKinds.size,
    logicalObjectReferences: objectReferences.length, fullProductBundlesArchived: false }));
}

async function verifyArchive(argument) {
  const directory = await checkedDirectory(argument);
  const hashFile = await readChecked(directory, 'archive-manifest.sha256');
  const match = /^([a-f0-9]{64})  archive-manifest\.json\r?\n?$/.exec(hashFile.bytes.toString('utf8'));
  assert.ok(match, 'Invalid archive-manifest.sha256 format');
  const manifestFile = await readChecked(directory, 'archive-manifest.json', match[1]);
  const manifest = JSON.parse(manifestFile.bytes.toString('utf8'));
  assert.equal(manifest.schemaVersion, 1);
  const paths = new Set();
  for (const row of manifest.files) {
    const filename = relativePath(row.path);
    assert.ok(!paths.has(filename), `Duplicate archive manifest path: ${filename}`);
    paths.add(filename);
    const record = await readChecked(directory, filename, row.sha256);
    assert.equal(record.bytes.length, row.bytes, `Archived size mismatch: ${filename}`);
  }
  for (const required of ['summary.json', 'index.json', 'compression-cache.json', 'README.md']) assert.ok(paths.has(required), `Archive is missing ${required}`);
  assert.deepEqual(await archiveTreeFiles(directory),
    [...paths, 'archive-manifest.json', 'archive-manifest.sha256'].sort(), 'Archive contains unlisted or missing files');
  const indexFile = await readChecked(directory, 'index.json');
  const index = JSON.parse(indexFile.bytes.toString('utf8'));
  assert.equal(index.status, 'verified');
  assert.equal(index.assets.fullProductBundlesArchived, false);
  const references = [index.originalSummary, index.compression, ...index.sources,
    ...index.runs.flatMap((run) => [run.config, run.logs.stdout, run.logs.stderr, run.inventory, run.bundleMetadata])];
  for (const reference of references) {
    const entry = manifest.files.find((row) => row.path === relativePath(reference.archivePath));
    assert.ok(entry, `Index reference absent from archive manifest: ${reference.archivePath}`);
    assert.equal(entry.sha256, reference.sha256);
    assert.equal(entry.bytes, reference.bytes);
  }
  console.log(JSON.stringify({ status: 'verified', archive: directory, files: paths.size,
    manifestSha256: manifestFile.sha256, fullProductBundlesArchived: false }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const option = options();
    if (option?.verify) await verifyArchive(option.verify);
    else if (option) await consolidate(option);
  } catch (error) {
    console.error(`[consolidate-tailwind-builds] ${error.stack ?? error.message}`);
    process.exitCode = 1;
  }
}
