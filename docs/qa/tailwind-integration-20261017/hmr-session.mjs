// Internal child process. run-hmr.mjs owns the experiment and all probe edits.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createServer, createLogger } from 'vite';
import { chromium } from '@playwright/test';
import { integrationOverrides } from './integration.mjs';
import { repo, relative, sha256, targetFor, contained, evidence, redactText } from './hmr-common.mjs';

const config = JSON.parse(await readFile(process.argv[2], 'utf8'));
assert(['postcss', 'vite'].includes(config.variant));
assert(contained(path.join(repo, 'reports'), config.probe));
assert(contained(path.join(repo, 'reports'), config.cache));
assert(!contained(config.cache, config.probe), 'Fixture must stay outside ignored cacheDir');
const report = {
  id: config.id, variant: config.variant, node: process.version,
  startedAt: new Date().toISOString(), passed: false,
  failures: [], hmrEvents: [], watcherEvents: [], cssResponses: [],
  requests: [], blockedRequests: [], sockets: [], blockedSockets: [],
  pageerrors: [], consoleErrors: [], navigationsAfterReady: [],
  viteErrors: [], viteWarnings: [], verifications: [],
};
const pendingBodies = [];
let server;
let browser;
let page;
let closing = false;
let navigationReady = false;
let armed = null;
let wsConnected = false;
let stop;
const stopped = new Promise(resolve => { stop = resolve; });
class SessionStopped extends Error {}
const duringStartup = (operation, stage) => Promise.race([
  operation,
  stopped.then(() => { throw new SessionStopped(`Stop requested during ${stage}`); }),
]);
const send = message => { if (process.connected) process.send(evidence(message)); };
const fail = message => {
  report.failures.push(redactText(message));
  send({ type: 'fatal', error: redactText(message) });
};
process.once('disconnect', stop);
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
process.on('message', async message => {
  try {
    if (message.type === 'stop') {
      report.stopRequestedAtChildPerformanceMs = performance.now();
      stop();
    } else if (message.type === 'arm') {
      assert(page && navigationReady && !armed, 'Session not ready or prior edit active');
      assert.equal(message.expected.id, `${config.id}:step-${message.expected.step}`);
      armed = { expected: message.expected, watcherIndex: report.watcherEvents.length };
      const state = await page.evaluate(expected => window.__armHmrProbe(expected), message.expected);
      send({ type: 'armed', id: message.expected.id, state });
    }
  } catch (error) {
    fail(error.stack ?? error.message);
  }
});

try {
  let cacheExisted = true;
  try { assert.equal((await readdir(config.cache)).length, 0, 'Session cache must start empty'); }
  catch (error) { if (error.code === 'ENOENT') cacheExisted = false; else throw error; }
  const overrides = await integrationOverrides(config.variant);
  const logger = createLogger('info', { allowClearScreen: false });
  const originalError = logger.error.bind(logger);
  logger.error = (message, options) => { report.viteErrors.push(String(message)); originalError(message, options); };
  const originalWarn = logger.warn.bind(logger);
  logger.warn = (message, options) => { report.viteWarnings.push(String(message)); originalWarn(message, options); };
  server = await createServer({
    ...overrides, configFile: false, root: repo, envDir: false, mode: 'development',
    customLogger: logger, clearScreen: false, cacheDir: config.cache,
    css: { ...overrides.css, devSourcemap: false },
    // Fixture has no bare JS dependencies. Disable app dependency discovery
    // identically in both arms so it cannot race these CSS-only observations.
    optimizeDeps: { entries: [], noDiscovery: true, include: [] },
    server: {
      host: '127.0.0.1', port: 0, strictPort: true, open: false,
      ws: { host: '127.0.0.1' }, hmr: { overlay: false },
      fs: { strict: true, allow: [repo] },
    },
  });
  server.watcher.on('change', file => {
    if (path.resolve(file) === path.resolve(config.probe)) report.watcherEvents.push({ file: relative(file), childPerformanceMs: performance.now() });
  });
  server.ws.on('hmr-bench:ready', (data, client) => {
    client.send({ type: 'custom', event: 'hmr-bench:ready', data: { fixture: data.fixture, acknowledged: true } });
  });
  await server.listen();
  const address = server.httpServer.address();
  assert.equal(typeof address, 'object');
  assert.equal(address.address, '127.0.0.1');
  const origin = `http://127.0.0.1:${address.port}`;
  const wsOrigin = `ws://127.0.0.1:${address.port}`;
  const fixtureUrl = `/${relative(config.html)}`;
  const probeUrl = `/${relative(config.probe)}`;
  report.config = {
    configFile: false, envDir: false, root: '.', mode: server.config.mode,
    css: { devSourcemap: server.config.css.devSourcemap, postcss: config.variant === 'postcss' ? 'implicit root postcss.config.js discovery' : { plugins: [] } },
    integrationPlugins: config.variant === 'vite' ? ['@tailwindcss/vite'] : [],
    resolvedPlugins: server.config.plugins.map(plugin => plugin.name),
    cacheDir: relative(config.cache), cacheExistedBeforeStartup: cacheExisted,
    optimizeDeps: { entries: [], noDiscovery: true, include: [] },
    server: { host: '127.0.0.1', port: address.port, requestedPort: 0, strictPort: true, hmrOverlay: false, watcher: 'Vite defaults, root config not loaded; fixture outside cacheDir' },
    fixture: relative(config.html), probe: relative(config.probe),
    networkInstrumentation: 'HTTP GET/HEAD exact origin via route.fetch(maxRedirects:0)+fulfill; every other HTTP/WS blocked before connection; browser HTTP cache disabled by routing',
  };
  assert.equal(server.config.css.devSourcemap, false);
  assert.equal(server.config.envDir, false);
  const executable = chromium.executablePath();
  assert(/(?:chromium|chrome-headless-shell)[-_]\d+/.test(executable), 'Expected Playwright-managed Chromium');
  report.playwrightBrowserRevision = executable.match(/(?:chromium|chrome-headless-shell)[-_](\d+)/)[1];
  browser = await chromium.launch({ headless: true, args: [
    '--no-proxy-server', '--disable-background-networking', '--dns-prefetch-disable',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
  ] });
  report.chromium = browser.version();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }, locale: 'es-MX', timezoneId: 'UTC',
    colorScheme: 'light', permissions: [], serviceWorkers: 'block',
    acceptDownloads: false, storageState: { cookies: [], origins: [] },
  });
  // Chromium's local-network permission is granted only to this ephemeral
  // fixture origin. HTTP/WS allowlists below remain exact and fail closed.
  // Unsupported installed mappings throw here; no flag or broader fallback.
  await context.grantPermissions(['local-network-access'], { origin });
  report.config.permissions = { granted: ['local-network-access'], origin, scope: 'this ephemeral isolated fixture origin only' };
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin || !['GET', 'HEAD'].includes(request.method())) {
      report.blockedRequests.push({ origin: url.origin, method: request.method(), type: request.resourceType() });
      await route.abort('blockedbyclient');
      fail('Unexpected HTTP request blocked');
      return;
    }
    try {
      const response = await route.fetch({ maxRedirects: 0 });
      report.requests.push({ path: url.pathname, method: request.method(), status: response.status(), childPerformanceMs: performance.now() });
      if (response.status() >= 300) {
        await route.abort('blockedbyclient');
        fail(`Unexpected local HTTP status ${response.status()} at ${url.pathname}`);
      } else await route.fulfill({ response });
    } catch (error) {
      if (!closing) fail(`HTTP interception failed: ${error.message}`);
    }
  });
  await context.routeWebSocket(/.*/, socket => {
    const url = new URL(socket.url());
    if (url.origin !== wsOrigin || url.pathname !== '/' || !socket.protocols().includes('vite-hmr')) {
      report.blockedSockets.push({ origin: url.origin, pathname: url.pathname });
      void socket.close({ code: 1008, reason: 'Exact local Vite HMR only' });
      fail('Unexpected WebSocket blocked');
      return;
    }
    const metadata = { origin: wsOrigin, pathname: '/', protocol: 'vite-hmr', connectedMessage: false, childPerformanceMs: performance.now() };
    report.sockets.push(metadata);
    const remote = socket.connectToServer();
    remote.onMessage(message => {
      try {
        const payload = JSON.parse(String(message));
        if (payload.type === 'connected') {
          if (wsConnected && !closing) fail('Unexpected HMR WebSocket reconnection');
          wsConnected = true;
          metadata.connectedMessage = true;
        }
      } catch { /* Non-JSON frames are still transparently forwarded. */ }
      socket.send(message);
    });
    socket.onMessage(message => remote.send(message));
  });
  page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on('pageerror', error => { report.pageerrors.push(error.message); fail(`Page error: ${error.message}`); });
  page.on('console', message => {
    if (message.type() === 'error') { report.consoleErrors.push(message.text()); fail(`Browser console error: ${message.text()}`); }
  });
  page.on('crash', () => fail('Browser page crashed'));
  page.on('framenavigated', frame => {
    if (navigationReady && frame === page.mainFrame() && !closing) {
      report.navigationsAfterReady.push({ pathname: new URL(frame.url()).pathname, childPerformanceMs: performance.now() });
      fail('Unexpected full document navigation');
    }
  });
  page.on('response', response => {
    if (new URL(response.url()).pathname !== probeUrl) return;
    const item = { path: probeUrl, status: response.status(), childPerformanceMs: performance.now() };
    report.cssResponses.push(item);
    pendingBodies.push(response.body().then(body => {
      item.bytes = body.length;
      item.sha256 = sha256(body);
      item.step = Number(body.toString('utf8').match(/--hmr-step:\s*(\d+)/)?.[1]);
    }).catch(error => { item.error = error.message; if (!closing) fail(`CSS response capture failed: ${error.message}`); }));
  });
  await page.exposeBinding('__hmrFailure', (_source, message) => { fail(message); });
  await page.exposeBinding('__hmrVerified', (_source, verification) => {
    try {
      assert(armed, 'Unarmed verification received');
      assert.equal(verification.expected.id, armed.expected.id, 'Stale verification');
      assert.deepEqual(verification.expected, armed.expected);
      assert(verification.events.some(event => event.name === 'vite:beforeUpdate'), 'Missing beforeUpdate event');
      assert(verification.events.some(event => event.name === 'vite:afterUpdate'), 'Missing afterUpdate event');
      assert(!verification.events.some(event => ['vite:beforeFullReload', 'vite:error', 'vite:ws:disconnect', 'vite:ws:connect'].includes(event.name)), 'Reload, error, disconnect or reconnection during update');
      const observedChanges = report.watcherEvents.slice(armed.watcherIndex);
      assert(observedChanges.length > 0, 'Watcher did not observe probe.css');
      assert.equal(report.failures.length, 0, 'Session has recorded failures');
      report.verifications.push(verification);
      armed = null;
      // Parent records receipt using its own monotonic clock. No cross-process
      // or browser timestamps are subtracted to form the primary latency.
      send({ type: 'verified', id: verification.expected.id, verification, watcherChanges: observedChanges });
    } catch (error) { fail(error.stack ?? error.message); }
    return true;
  });
  const navigation = await duringStartup(page.goto(`${origin}${fixtureUrl}`, { waitUntil: 'load', timeout: 60_000 }), 'initial navigation');
  assert.equal(navigation.status(), 200);
  await duringStartup(page.waitForFunction(() => window.__hmrProbe?.ready === true), 'HMR readiness');
  assert(wsConnected && report.sockets.some(socket => socket.connectedMessage), 'Actual Vite WS connected message not observed');
  const initial = await duringStartup(page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));
    const element = document.querySelector('#hmr-probe');
    const computed = getComputedStyle(element);
    const rectangle = element.getBoundingClientRect();
    return { width: computed.width, height: computed.height, color: computed.color, step: computed.getPropertyValue('--hmr-step').trim(), rectangle: { width: rectangle.width, height: rectangle.height } };
  }), 'initial CSS observation');
  const expectedInitial = targetFor(0);
  assert.equal(initial.width, `${expectedInitial.width}px`);
  assert.equal(initial.height, `${expectedInitial.height}px`);
  assert.equal(initial.color, expectedInitial.color);
  assert.equal(initial.step, '0');
  assert.equal(initial.rectangle.width, expectedInitial.width);
  assert.equal(initial.rectangle.height, expectedInitial.height);
  assert.equal(report.failures.length, 0);
  report.initial = initial;
  navigationReady = true;
  send({ type: 'ready', initial, config: report.config, chromium: report.chromium });
  await stopped;
  if (page && !page.isClosed()) report.hmrEvents = await page.evaluate(() => window.__hmrProbe?.events ?? []);
  await Promise.all(pendingBodies);
  for (let step = 0; step <= config.expectedEdits; step += 1) {
    assert(report.cssResponses.some(response => response.step === step && response.status === 200 && response.sha256), `Missing successful CSS response/hash for step ${step}`);
  }
  assert.equal(report.verifications.length, config.expectedEdits);
  assert.equal(report.failures.length, 0);
  assert.equal(report.viteErrors.length, 0);
  assert.equal(report.navigationsAfterReady.length, 0);
  assert.equal(report.sockets.length, 1, 'Expected exactly one HMR WebSocket');
  report.passed = true;
} catch (error) {
  if (error instanceof SessionStopped && report.failures.length > 0) {
    // Preserve the original fatal error as the cause. Parent-requested stop
    // interrupts pending readiness immediately instead of adding a 30s wait.
    report.startupInterrupted = error.message;
  } else fail(error.stack ?? error.message);
} finally {
  closing = true;
  if (browser) await browser.close().catch(error => { report.passed = false; report.failures.push(`Browser shutdown: ${error.message}`); });
  if (server) await server.close().catch(error => { report.passed = false; report.failures.push(`Vite shutdown: ${error.message}`); });
  report.passed = report.passed && report.failures.length === 0 && report.viteErrors.length === 0;
  report.finishedAt = new Date().toISOString();
  send({ type: 'finished', report });
  if (process.connected) process.disconnect();
  process.exitCode = report.passed ? 0 : 1;
}
