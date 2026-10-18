import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium, expect } from '@playwright/test';
import original from '../../../playwright.visual.config.ts';
import { reportPath } from './ui-suites.mjs';
import { startUIServer } from './ui-server.mjs';

// Supplementary capture of the eight existing shared-ui screenshot scenarios.
// This is not another test suite and never writes canonical snapshots.
const { values } = parseArgs({ options: {
  variant: { type: 'string' }, port: { type: 'string' }, output: { type: 'string' },
} });
const output = reportPath(values.output);
await mkdir(output, { recursive: true });
const origin = `http://127.0.0.1:${Number(values.port)}`;
const server = await startUIServer({ variant: values.variant, suite: 'shared-ui', port: Number(values.port), output: resolve(output, 'server') });
let browser;
const evidence = { variant: values.variant, started: new Date().toISOString(), origin, captures: [], blocked: [], errors: [] };
async function capture(page, project, name) {
  const directory = resolve(output, project);
  await mkdir(directory, { recursive: true });
  const bytes = await page.screenshot({ path: resolve(directory, `${name}.png`), animations: 'disabled', caret: 'hide' });
  evidence.captures.push({ project, name: `${name}.png`, sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });
}
try {
  browser = await chromium.launch({ headless: true });
  evidence.browserVersion = browser.version();
  for (const project of original.projects) {
    const { browserName: _browserName, baseURL: _baseURL, trace: _trace, ...options } = { ...original.use, ...project.use };
    const context = await browser.newContext({ ...options, serviceWorkers: 'block', acceptDownloads: false, baseURL: origin });
    try {
      await context.route('**/*', route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.origin === origin && request.method() === 'GET') return route.continue();
        evidence.blocked.push(`${request.method()} ${url.origin}${url.pathname}`);
        return route.abort('blockedbyclient');
      });
      await context.routeWebSocket(/.*/, socket => {
        const url = new URL(socket.url());
        if (url.origin === origin.replace('http:', 'ws:')) return socket.connectToServer();
        evidence.blocked.push(`WebSocket ${url.origin}${url.pathname}`);
        return socket.close();
      });
      const page = await context.newPage();
      page.on('pageerror', error => evidence.errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') evidence.errors.push(message.text()); });
      await page.goto('/e2e/visual/index.html');
      await page.evaluate(() => document.fonts.ready);
      await expect(page.getByRole('heading', { name: 'Cotizaciones', exact: true })).toBeVisible();
      await capture(page, project.name, 'shell-table');
      await page.getByRole('button', { name: 'Nueva cotización', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await capture(page, project.name, 'form-dialog');
    } finally { await context.close(); }
  }
  assert.equal(evidence.captures.length, 8, 'All eight original screenshot scenarios must be captured');
  assert.deepEqual(evidence.blocked, [], 'No non-fixture requests or WebSockets');
  assert.deepEqual(evidence.errors, [], 'No browser or console errors');
  evidence.passed = true;
} catch (error) {
  evidence.passed = false;
  evidence.error = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await server.close();
  evidence.finished = new Date().toISOString();
  await writeFile(resolve(output, 'captures.json'), `${JSON.stringify(evidence, null, 2)}\n`);
}
