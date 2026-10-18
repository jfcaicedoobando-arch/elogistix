import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { build } from 'vite';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../..', import.meta.url));
const configFile = path.join(root, 'e2e/manual-invoice/vite.config.mjs');
const out = path.join(root, 'docs/qa/manual-invoice-20261018');
const modes = ['base', 'candidate', 'base-profile', 'candidate-profile'];
const action = process.argv[2] ?? 'all';
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const sourcePaths = [
  'src/features/facturacion/components/DialogNuevaFacturaManual.tsx',
  'src/features/facturacion/components/FacturaManualConceptosTable.tsx',
  'src/features/facturacion/hooks/useFacturaManualForm.ts',
];
const hashes = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async p =>
  [p, createHash('sha256').update(await readFile(path.join(root, p))).digest('hex')])));
const before = await hashes();
const artifactHashes = async () => {
  const audit = JSON.parse(await readFile(path.join(out, 'build-audit.json')));
  assert.deepEqual(audit.sources, before, 'Build sources differ from current sources; rebuild first');
  for (const variant of audit.audits) {
    const dir = path.join(root, 'dist/manual-invoice', variant.mode);
    const html = await readFile(path.join(dir, 'index.html'), 'utf8');
    const script = html.match(/src="([^"]+\.js)"/)[1];
    assert.equal(createHash('sha256').update(await readFile(path.join(dir, script))).digest('hex'), variant.bundleSha256);
  }
  return audit.audits.map(({ mode, bundleSha256 }) => ({ mode, bundleSha256 }));
};
const harnessHashes = async () => {
  const files = ['run.mjs', 'candidate.mjs', 'functional.mjs', 'vite.config.mjs', 'main.tsx', 'stubs.ts', 'fixture.ts', 'index.html'];
  return Object.fromEntries(await Promise.all(files.map(async f => [f,
    createHash('sha256').update(await readFile(path.join(root, 'e2e/manual-invoice', f))).digest('hex')])));
};
const harnessBefore = await harnessHashes();
await mkdir(out, { recursive: true });
const save = (name, value) => writeFile(path.join(out, name), JSON.stringify(value, null, 2) + '\n');

if (['build', 'all'].includes(action)) {
  const audits = [];
  for (const mode of modes) {
    await build({ configFile, mode, logLevel: 'warn' });
    const dir = path.join(root, 'dist/manual-invoice', mode);
    const audit = JSON.parse(await readFile(path.join(dir, 'module-audit.json')));
    assert.deepEqual(audit.forbidden, []);
    const html = await readFile(path.join(dir, 'index.html'), 'utf8');
    const script = html.match(/src="([^"]+\.js)"/)[1];
    const bundle = await readFile(path.join(dir, script), 'utf8');
    if (!mode.includes('profile')) {
      assert.ok(!bundle.includes('__invoiceAttribution'));
      assert.ok(!bundle.includes('__invoiceCommits'));
    }
    assert.ok(audit.modules.some(p => p.endsWith('/DialogNuevaFacturaManual.tsx')));
    audits.push({ ...audit, modules: audit.modules.map(p => p.slice(p.indexOf('/src/') + 1)),
      bundleBytes: Buffer.byteLength(bundle), bundleSha256: createHash('sha256').update(bundle).digest('hex') });
  }
  await save('build-audit.json', { sha, sources: before, audits });
}

if (action !== 'build') {
  const artifactsBefore = await artifactHashes();
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const [mode, ...parts] = url.pathname.slice(1).split('/');
      assert.ok(modes.includes(mode));
      const relative = parts.filter(Boolean).join('/') || 'index.html';
      const dir = path.join(root, 'dist/manual-invoice', mode);
      const file = path.resolve(dir, relative);
      assert.ok(file.startsWith(dir + path.sep));
      const bytes = await readFile(file);
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'; font-src 'self'");
      res.end(bytes);
    } catch { res.statusCode = 404; res.end(); }
  });
  await new Promise(resolve => server.listen(9187, '127.0.0.1', resolve));
  const baseUrl = 'http://127.0.0.1:9187';
  const browser = await chromium.launch({ headless: action !== 'demo', ...(process.env.BENCH_BROWSER ? { executablePath: process.env.BENCH_BROWSER } : {}) });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
  const blocked = [], errors = [];
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === baseUrl) return route.continue();
    blocked.push(route.request().url()); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const open = async (variant, rows) => {
    await page.goto(`${baseUrl}/${variant}/?rows=${rows}`);
    await page.locator('textarea').waitFor();
    await settle();
    assert.equal(await page.locator('[id^="concepto-descripcion-"]').count(), rows);
  };
  try {
    if (action === 'demo') {
      const variant = process.argv[3] ?? 'base';
      assert.ok(['base', 'candidate'].includes(variant));
      await open(variant, Number(process.argv[4] ?? 20));
      process.stdout.write(`Demo ${variant}: close the isolated test browser to finish.\n`);
      await new Promise(resolve => browser.once('disconnected', resolve));
    }
    if (['functional', 'all'].includes(action)) {
      const { functional } = await import('./functional.mjs');
      const results = [];
      for (const variant of ['base', 'candidate']) results.push(await functional(page, variant, baseUrl));
      await save('functional.json', { sha, results, blocked, errors });
    }
    if (['profile', 'all'].includes(action)) {
      const results = [];
      for (const rows of [1, 20, 100]) for (const variant of ['base-profile', 'candidate-profile']) {
        await open(variant, rows);
        await page.locator('textarea').focus();
        await settle();
        const start = await page.evaluate(() => ({ counts: { ...globalThis.__invoiceAttribution }, commits: globalThis.__invoiceCommits.length }));
        await page.keyboard.type('nota sintética');
        await settle();
        const notes = await page.evaluate(() => ({ counts: { ...globalThis.__invoiceAttribution }, commits: globalThis.__invoiceCommits }));
        await page.locator('#concepto-descripcion-0').focus();
        await page.keyboard.type('abc');
        await settle();
        const end = await page.evaluate(() => ({ counts: { ...globalThis.__invoiceAttribution }, commits: globalThis.__invoiceCommits }));
        const delta = (a, b) => Object.fromEntries(Object.keys(b).map(k => [k, b[k] - (a[k] ?? 0)]));
        results.push({ rows, variant, notes: { counts: delta(start.counts, notes.counts), commits: notes.commits.slice(start.commits) },
          concept: { counts: delta(notes.counts, end.counts), commits: end.commits.slice(notes.commits.length) } });
      }
      await save('attribution.json', { sha, purpose: 'Attribution only; never acceptance timings', results, blocked, errors });
    }
    if (['measure', 'all'].includes(action)) {
      const session = await context.newCDPSession(page);
      await session.send('Performance.enable');
      const metrics = async () => Object.fromEntries((await session.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
      const samples = [];
      const workloads = [
        ['notes', 'textarea', 'notas internas sinteticas'],
        ['description', '#concepto-descripcion-0', 'servicio adicional'],
        ['quantity', '[aria-label="Cantidad del concepto 1"]', '1.234567'],
        ['unitPrice', '[aria-label="Precio unitario del concepto 1"]', '12.3456'],
      ];
      // Declared in advance: p95 renderer TaskDuration/key, >=20% and >=5ms
      // on the 20-row proxy workload, repeated in BOTH independent batches.
      for (let batch = 1; batch <= 2; batch++) {
        for (let round = 0; round <= 4; round++) for (const rows of [1, 20, 100]) {
          const order = (round + batch) % 2 ? ['base', 'candidate'] : ['candidate', 'base'];
          for (const variant of order) {
            await open(variant, rows);
            assert.equal(await page.evaluate(() => '__invoiceAttribution' in globalThis || '__invoiceCommits' in globalThis), false);
            for (const [workload, selector, text] of workloads) {
              const input = page.locator(selector);
              await input.focus();
              if (['quantity', 'unitPrice'].includes(workload)) await input.press('ControlOrMeta+A');
              await settle();
              for (const key of text) {
                const first = await metrics();
                const t0 = performance.now();
                await page.keyboard.press(key === ' ' ? 'Space' : key);
                await settle();
                const externalMs = performance.now() - t0;
                const last = await metrics();
                samples.push({ batch, round, warmup: round === 0, rows, variant, workload, key,
                  taskMs: (last.TaskDuration - first.TaskDuration) * 1000,
                  scriptMs: (last.ScriptDuration - first.ScriptDuration) * 1000, externalMs });
              }
              assert.equal(await input.evaluate(el => el === document.activeElement), true);
            }
          }
        }
        process.stdout.write(`Completed timing batch ${batch}/2\n`);
      }
      const stats = values => {
        const sorted = values.toSorted((a, b) => a - b);
        return { n: sorted.length, median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.ceil(sorted.length * .95) - 1] };
      };
      const summary = [];
      for (const batch of [1, 2]) for (const rows of [1, 20, 100]) for (const workload of workloads.map(x => x[0])) {
        const entry = { batch, rows, workload };
        for (const variant of ['base', 'candidate']) {
          const selected = samples.filter(s => !s.warmup && s.batch === batch && s.rows === rows && s.workload === workload && s.variant === variant);
          entry[variant] = Object.fromEntries(['taskMs', 'scriptMs', 'externalMs'].map(m => [m, stats(selected.map(s => s[m]))]));
        }
        entry.savingP95Ms = entry.base.taskMs.p95 - entry.candidate.taskMs.p95;
        entry.savingP95Percent = entry.savingP95Ms / entry.base.taskMs.p95 * 100;
        summary.push(entry);
      }
      const gate = summary.filter(s => s.rows === 20 && s.workload === 'notes')
        .every(s => s.savingP95Ms >= 5 && s.savingP95Percent >= 20);
      const columns = Object.keys(samples[0]);
      await writeFile(path.join(out, 'samples.csv'), columns.join(',') + '\n' +
        samples.map(s => columns.map(k => s[k]).join(',')).join('\n') + '\n');
      await save('timings.json', { sha, startedFromSources: before, sourceIntegrity: assert.deepEqual(await hashes(), before) ?? true,
        measuredArtifacts: artifactsBefore, harnessHashes: harnessBefore,
        environment: { node: process.version, os: `${os.platform()} ${os.release()}`, arch: os.arch(), cpu: os.cpus()[0].model,
          logicalCpus: os.cpus().length, memoryGiB: os.totalmem() / 2 ** 30, browser: browser.version(), viewport: '1280x720', headless: true },
        primaryMetric: 'Renderer TaskDuration delta/key from CDP; CPU work, not input-to-paint latency',
        secondaryMetric: 'externalMs includes automation, protocol and two animation frames; not user latency',
        representativeProxy: '20 synthetic concepts; hypothesis, not observed production distribution',
        gate, summary, blocked, errors });
    }
    assert.deepEqual(blocked, []);
    assert.deepEqual(errors, []);
    assert.deepEqual(await artifactHashes(), artifactsBefore);
    assert.deepEqual(await harnessHashes(), harnessBefore);
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
assert.deepEqual(await hashes(), before);
