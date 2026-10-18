import assert from 'node:assert/strict';
import { readdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { integrationOverrides, isolatedEnvironment } from './integration.mjs';

// Exactly one build in this process. The coordinator supplies fresh report directories.
const root = fileURLToPath(new URL('../../../', import.meta.url));
assert.equal(process.argv.length, 10, 'Expected four flag/value pairs');
const args = Object.fromEntries(Array.from({ length: 4 }, (_, index) =>
  [process.argv[2 + index * 2], process.argv[3 + index * 2]]));
assert.deepEqual(Object.keys(args).sort(), ['--cache-dir', '--config-report', '--out-dir', '--variant']);
const variant = args['--variant'];
assert.ok(['postcss', 'vite'].includes(variant), 'Unknown Tailwind integration');

function reportPath(value) {
  assert.ok(value, 'Missing report path');
  const absolute = path.resolve(value);
  const relative = path.relative(path.join(root, 'reports'), absolute);
  assert.ok(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
    'Worker paths must be below this checkout reports/');
  const parent = realpathSync(path.dirname(absolute));
  const reports = realpathSync(path.join(root, 'reports'));
  assert.ok(parent === reports || parent.startsWith(`${reports}${path.sep}`), 'Report parent escaped reports/');
  return absolute;
}

const outDir = reportPath(args['--out-dir']);
const cacheDir = reportPath(args['--cache-dir']);
const configReport = reportPath(args['--config-report']);
for (const directory of [outDir, cacheDir]) {
  assert.equal(readdirSync(directory).length, 0, 'Output and cache directories must be new and empty');
  assert.equal(realpathSync(directory), directory, 'Output and cache directories must not be symlinks');
}
const expected = isolatedEnvironment('production');
for (const key of ['NODE_ENV', 'NODE_OPTIONS', 'ANALYZE', 'CI_REPORT_COMPRESSED_SIZE',
  'VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']) assert.equal(process.env[key], expected[key]);
assert.equal(process.env.BUILD_SOURCEMAPS, undefined, 'Original sourcemap policy must resolve without an override');
assert.ok(!Object.keys(process.env).some((key) => /^SENTRY_/i.test(key)), 'Sentry credentials are prohibited');
assert.deepEqual(Object.keys(process.env).filter((key) => /^VITE_/i.test(key)).sort(),
  ['VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_URL']);

function moduleId(id) {
  if (id === null || id === undefined) return null;
  const normalized = id.replaceAll('\\', '/');
  const prefix = root.replaceAll('\\', '/').replace(/\/$/, '') + '/';
  return normalized.toLowerCase().startsWith(prefix.toLowerCase()) ? normalized.slice(prefix.length) : normalized;
}

const evidencePlugin = {
  name: 'benchmark-tailwind-build-evidence',
  enforce: 'post',
  configResolved(config) {
    assert.equal(config.envDir, false);
    assert.equal(config.build.minify, 'terser', 'Keep the existing JavaScript minifier');
    assert.equal(config.build.sourcemap, false);
    assert.equal(config.build.reportCompressedSize, false);
    assert.equal(config.build.terserOptions.compress.drop_console, true);
    assert.equal(config.build.terserOptions.compress.drop_debugger, true);
    assert.ok(!config.plugins.some(({ name }) => /sentry/i.test(name)), 'Sentry plugin must be absent');
    const names = config.plugins.map(({ name }) => name);
    assert.equal(names.some((name) => name.startsWith('@tailwindcss/vite:')), variant === 'vite');
    if (variant === 'vite') assert.deepEqual(config.css.postcss, { plugins: [] });
    const snapshot = {
      variant, configFile: config.configFile, configFileDependencies: config.configFileDependencies,
      root: config.root, command: config.command, mode: config.mode, envDir: config.envDir,
      syntheticPublicEnvironment: { VITE_SUPABASE_URL: expected.VITE_SUPABASE_URL,
        VITE_SUPABASE_PUBLISHABLE_KEY: expected.VITE_SUPABASE_PUBLISHABLE_KEY },
      plugins: names, cacheDir: config.cacheDir,
      css: { transformer: config.css.transformer, devSourcemap: config.css.devSourcemap,
        postcss: variant === 'vite' ? { plugins: [] } : 'original external postcss.config.js' },
      build: {
        target: config.build.target, cssTarget: config.build.cssTarget, cssMinify: config.build.cssMinify,
        cssCodeSplit: config.build.cssCodeSplit, sourcemap: config.build.sourcemap,
        minify: config.build.minify, terserOptions: config.build.terserOptions,
        reportCompressedSize: config.build.reportCompressedSize,
        rolldownTransformTarget: config.build.rolldownOptions.transform?.target ?? null,
        oxcTransformTarget: config.oxc?.target ?? null,
        outDir: config.build.outDir, emptyOutDir: config.build.emptyOutDir,
      },
    };
    writeFileSync(configReport, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' });
  },
  writeBundle(_options, bundle) {
    const chunks = Object.values(bundle).filter((entry) => entry.type === 'chunk').map((chunk) => ({
      fileName: chunk.fileName, facadeModuleId: moduleId(chunk.facadeModuleId),
      moduleIds: (chunk.moduleIds ?? Object.keys(chunk.modules ?? {})).map(moduleId).sort(),
      imports: chunk.imports, dynamicImports: chunk.dynamicImports,
      // Preserve insertion order: CSS order can affect the cascade.
      css: [...(chunk.viteMetadata?.importedCss ?? [])],
    })).sort((a, b) => a.fileName.localeCompare(b.fileName));
    assert.ok(chunks.length > 0, 'Build emitted no chunks');
    writeFileSync(path.join(outDir, '.qa-build-metadata.json'),
      `${JSON.stringify({ schemaVersion: 1, variant, chunks }, null, 2)}\n`, { flag: 'wx' });
  },
};

const overrides = await integrationOverrides(variant);
await build({
  ...overrides,
  root,
  configFile: path.join(root, 'vite.config.ts'),
  mode: 'production',
  envDir: false,
  cacheDir,
  plugins: [...(overrides.plugins ?? []), evidencePlugin],
  build: { outDir, emptyOutDir: false },
});
