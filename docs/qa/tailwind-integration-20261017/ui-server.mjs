import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { build, createServer, loadConfigFromFile, mergeConfig, preview } from 'vite';
import { integrationOverrides } from './integration.mjs';
import { reportPath, repository, suiteDefinition } from './ui-suites.mjs';

async function fixtureAssets(directory) {
  const files = await readdir(directory, { recursive: true, withFileTypes: true });
  const assets = [];
  for (const file of files.filter(file => file.isFile() && /\.(css|js)$/.test(file.name))) {
    const path = resolve(file.parentPath, file.name);
    const bytes = await readFile(path);
    assets.push({ path: relative(directory, path).replaceAll('\\', '/'),
      raw: bytes.length, gzip: gzipSync(bytes, { level: 9 }).length,
      brotli: brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
      sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  return assets.sort((left, right) => left.path.localeCompare(right.path));
}

// Called only by Playwright's experimental wrapper. Original Vite config,
// fixture root, aliases, input CSS and source discovery remain authoritative.
export async function startUIServer({ variant, suite, port, output }) {
  const definition = suiteDefinition(suite);
  assert.ok(['postcss', 'vite'].includes(variant), 'Unknown integration');
  assert.ok(Number.isInteger(port) && port > 0 && port < 65536, 'Invalid loopback port');
  if (definition.port) assert.equal(port, definition.port, 'Strict test network guards require the canonical port');
  const destination = reportPath(output);
  await mkdir(destination, { recursive: true });
  const mode = definition.development ? 'development' : 'production';
  const loaded = await loadConfigFromFile({ command: definition.development ? 'serve' : 'build', mode }, resolve(repository, definition.vite), repository);
  assert.ok(loaded, 'Original Vite config must load');
  const configuration = mergeConfig(loaded.config, await integrationOverrides(variant));
  const originalRoot = configuration.root ?? repository;
  const originalPostcss = loaded.config.css?.postcss ?? null;
  const origin = `http://127.0.0.1:${port}`;
  const isolated = mergeConfig(configuration, {
    configFile: false, root: originalRoot, envDir: false,
    cacheDir: resolve(destination, 'vite-cache'),
    server: { host: '127.0.0.1', port, strictPort: true, open: false, origin },
    preview: { host: '127.0.0.1', port, strictPort: true, open: false },
    build: { outDir: resolve(destination, 'compiled-fixture'), emptyOutDir: true },
  });
  await writeFile(resolve(destination, 'server-profile.json'), `${JSON.stringify({
    suite, variant, mode, cwd: process.cwd(), originalConfig: definition.vite,
    originalRoot, originalPostcss, experimentalPostcss: variant === 'vite' ? { plugins: [] } : originalPostcss,
    envDir: false, cacheDir: isolated.cacheDir, outDir: isolated.build.outDir,
    origin, freshBuildBeforePreview: !definition.development,
  }, null, 2)}\n`);
  if (definition.development) {
    const server = await createServer(isolated);
    await server.listen();
    return server;
  }
  // Build failure propagates: preview never falls back to an earlier artifact.
  await build(isolated);
  await writeFile(resolve(destination, 'fixture-assets.json'), `${JSON.stringify({
    compression: { gzipLevel: 9, brotliQuality: 11 },
    assets: await fixtureAssets(isolated.build.outDir),
  }, null, 2)}\n`);
  return preview(isolated);
}

async function main() {
  const { values } = parseArgs({ options: {
    variant: { type: 'string' }, suite: { type: 'string' },
    port: { type: 'string' }, output: { type: 'string' },
  } });
  const server = await startUIServer({ ...values, port: Number(values.port) });
  const close = async () => {
    if (server.close) await server.close();
    else await new Promise((done, reject) => server.httpServer.close(error => error ? reject(error) : done()));
    process.exit(0);
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
