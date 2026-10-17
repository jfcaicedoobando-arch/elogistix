import assert from 'node:assert/strict';
import { readdirSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

// One invocation performs one build. The parent always starts a new Node process.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const args = Object.fromEntries(Array.from({ length: (process.argv.length - 2) / 2 }, (_, index) =>
  [process.argv[2 + index * 2], process.argv[3 + index * 2]]));
assert.equal(process.argv.length, 10, 'Expected four flag/value pairs');
assert.deepEqual(Object.keys(args).sort(), ['--cache-dir', '--config-report', '--out-dir', '--variant']);
const variant = args['--variant'];
assert.ok(['terser', 'oxc'].includes(variant), 'Unknown minifier');

function reportPath(value) {
  assert.ok(value, 'Missing report path');
  const absolute = path.resolve(value);
  const relative = path.relative(path.join(root, 'reports'), absolute);
  assert.ok(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
    'Worker paths must be below this checkout reports directory');
  const parent = realpathSync(path.dirname(absolute));
  const realReports = realpathSync(path.join(root, 'reports'));
  assert.ok(parent === realReports || parent.startsWith(`${realReports}${path.sep}`), 'Report parent escaped reports');
  return absolute;
}

const outDir = reportPath(args['--out-dir']);
const cacheDir = reportPath(args['--cache-dir']);
const configReport = reportPath(args['--config-report']);
assert.equal(readdirSync(outDir).length, 0, 'outDir must be new and empty');
assert.equal(readdirSync(cacheDir).length, 0, 'cacheDir must be new and empty');
assert.equal(realpathSync(outDir), outDir, 'outDir must not be a symlink');
assert.equal(realpathSync(cacheDir), cacheDir, 'cacheDir must not be a symlink');
assert.equal(process.env.ANALYZE, 'false');
assert.equal(process.env.CI_REPORT_COMPRESSED_SIZE, 'false');
assert.equal(process.env.BUILD_SOURCEMAPS, undefined, 'Do not override the original sourcemap policy');
assert.ok(!Object.keys(process.env).some((key) => /^SENTRY_/i.test(key)), 'Sentry credentials are prohibited');
const publicEnvironment = {
  VITE_SUPABASE_URL: 'http://127.0.0.1:9',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'benchmark-public-placeholder',
};
assert.deepEqual(Object.fromEntries(Object.entries(process.env).filter(([key]) => /^VITE_/i.test(key))),
  publicEnvironment, 'Only the two synthetic public variables are allowed');

const minify = { compress: { dropConsole: true, dropDebugger: true }, mangle: true, codegen: true };
const recordConfig = {
  name: 'benchmark-record-resolved-config',
  enforce: 'post',
  configResolved(config) {
    assert.equal(config.envDir, false);
    assert.equal(config.build.minify, variant);
    assert.equal(config.build.sourcemap, false, 'Original no-token production policy must resolve to false');
    assert.equal(config.build.reportCompressedSize, false);
    assert.equal(config.build.terserOptions.compress.drop_console, true);
    assert.equal(config.build.terserOptions.compress.drop_debugger, true);
    assert.ok(!config.plugins.some(({ name }) => /sentry/i.test(name)), 'Sentry plugin must be absent');
    const rolldown = config.build.rolldownOptions;
    if (variant === 'oxc') assert.deepEqual(rolldown.output.minify, minify);
    const snapshot = {
      variant, configFile: config.configFile, configFileDependencies: config.configFileDependencies,
      root: config.root, command: config.command, mode: config.mode, envDir: config.envDir,
      syntheticPublicEnvironment: publicEnvironment,
      plugins: config.plugins.map(({ name }) => name),
      build: {
        target: config.build.target, cssTarget: config.build.cssTarget,
        cssMinify: config.build.cssMinify, cssCodeSplit: config.build.cssCodeSplit,
        sourcemap: config.build.sourcemap, minify: config.build.minify,
        reportCompressedSize: config.build.reportCompressedSize,
        terserOptions: config.build.terserOptions,
        rolldownOutputMinify: rolldown.output?.minify ?? null,
        rolldownTransformTarget: rolldown.transform?.target ?? null,
        oxcTransformTarget: config.oxc?.target ?? null,
        outDir: config.build.outDir, emptyOutDir: config.build.emptyOutDir,
      },
      cacheDir: config.cacheDir,
      intendedDropPolicy: { console: true, debugger: true },
    };
    writeFileSync(configReport, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' });
  },
};

await build({
  root,
  configFile: path.join(root, 'vite.config.ts'),
  mode: 'production',
  envDir: false,
  cacheDir,
  plugins: [recordConfig],
  build: {
    outDir,
    emptyOutDir: false,
    minify: variant,
    ...(variant === 'oxc' ? { rolldownOptions: { output: { minify } } } : {}),
  },
});
