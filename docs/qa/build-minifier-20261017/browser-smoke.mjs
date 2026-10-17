#!/usr/bin/env node
/**
 * Local, unauthenticated smoke of one build or the visible UI of two builds.
 * Usage: node browser-smoke.mjs build-a [build-b] --output evidence/smoke.json
 * No .env, stored session, deployed site, browser channel, or backend is used.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, readdir, realpath, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const mime = new Map(Object.entries({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
}));
const viewports = [{ width: 1280, height: 720 }, { width: 390, height: 640 }];
const routes = ['/', '/login'];
const hash = value => createHash('sha256').update(value).digest('hex');
const normalize = value => value.replace(/\s+/g, ' ').trim();

function parseArgs(args) {
  if (args.includes('--help')) {
    console.log('Usage: node browser-smoke.mjs build-a [build-b] --output evidence/smoke.json');
    process.exit(0);
  }
  const outputIndex = args.indexOf('--output');
  assert(outputIndex >= 1 && outputIndex === args.length - 2, 'Provide one or two build directories, then --output file.json');
  const builds = args.slice(0, outputIndex);
  assert(builds.length >= 1 && builds.length <= 2 && builds.every(arg => !arg.startsWith('--')), 'Expected one or two build directories');
  return { builds, output: path.resolve(args[outputIndex + 1]) };
}

function contained(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

async function inspectBuild(directory) {
  const root = await realpath(path.resolve(directory));
  assert((await stat(root)).isDirectory(), 'Build must be a directory');
  const index = await readFile(path.join(root, 'index.html'));
  const scripts = [];
  async function walk(directoryPath) {
    for (const entry of await readdir(directoryPath, { withFileTypes: true })) {
      assert(!entry.isSymbolicLink(), 'Build input must not contain symlinks');
      const target = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) await walk(target);
      else if (entry.name.endsWith('.js')) scripts.push(await readFile(target, 'utf8'));
    }
  }
  await walk(root);
  assert(scripts.length > 0, 'Build contains no JavaScript');
  const syntheticUrlPresent = scripts.some(script => script.includes('http://127.0.0.1:9'));
  const syntheticKeyPresent = scripts.some(script => script.includes('benchmark-public-placeholder'));
  assert(syntheticUrlPresent && syntheticKeyPresent, 'Rebuild with the documented synthetic Supabase URL and publishable key before smoke');
  return { root, indexSha256: hash(index), javascriptFiles: scripts.length, syntheticUrlPresent, syntheticKeyPresent };
}

async function serveBuild(build) {
  const served = [];
  let connectionHintsRemoved = 0;
  const server = createServer(async (request, response) => {
    let status = 500;
    let pathname = '/invalid';
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        status = 405;
        response.writeHead(status, { Allow: 'GET, HEAD' }).end();
        return;
      }
      const url = new URL(request.url, 'http://127.0.0.1');
      pathname = decodeURIComponent(url.pathname);
      assert(!pathname.includes('\\') && !pathname.includes('\0'), 'Invalid path');
      let file = path.resolve(build.root, `.${pathname}`);
      assert(contained(build.root, file), 'Path outside build');
      try {
        if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
        file = await realpath(file);
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
        // History fallback applies only to extensionless HTML navigation.
        if (path.extname(pathname) || !request.headers.accept?.includes('text/html')) {
          status = 404;
          response.writeHead(status).end();
          return;
        }
        file = await realpath(path.join(build.root, 'index.html'));
      }
      assert(contained(build.root, file), 'Resolved path outside build');
      let content = await readFile(file);
      if (path.extname(file) === '.html') {
        // Resource hints can initiate DNS/TCP before Playwright request routing.
        // Remove only connection hints in this temporary HTTP response, never
        // from the input build. Asset bytes and application scripts are intact.
        content = Buffer.from(content.toString('utf8').replace(/<link\b(?=[^>]*\brel\s*=\s*["'](?:preconnect|dns-prefetch)["'])[^>]*>/gi, () => {
          connectionHintsRemoved += 1;
          return '';
        }));
      }
      status = 200;
      response.writeHead(status, {
        'Content-Type': mime.get(path.extname(file)) ?? 'application/octet-stream',
        'Content-Length': content.length, 'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch {
      status = 400;
      if (!response.headersSent) response.writeHead(status);
      response.end();
    } finally {
      served.push({ method: request.method, pathname, status });
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, served, get connectionHintsRemoved() { return connectionHintsRemoved; }, origin: `http://127.0.0.1:${server.address().port}` };
}

async function visibleSnapshot(page) {
  // innerText excludes CSS-hidden content; offscreen content is deliberately
  // included. No generated IDs, asset names, origin ports, or timestamps enter
  // this comparison. Empty input values are asserted separately.
  return page.evaluate(() => {
    const clean = value => (value ?? '').replace(/\s+/g, ' ').trim();
    const visible = element => {
      const style = getComputedStyle(element);
      return style.visibility !== 'hidden' && style.display !== 'none' && element.getClientRects().length > 0;
    };
    const list = selector => [...document.querySelectorAll(selector)].filter(visible);
    return {
      title: document.title,
      text: clean(document.body.innerText),
      headings: list('h1,h2,h3').map(element => ({ level: element.tagName, text: clean(element.innerText) })),
      links: list('a[href]').map(element => ({ text: clean(element.innerText), label: element.getAttribute('aria-label'), href: element.getAttribute('href') })),
      fields: list('input,textarea,select').map(element => ({
        tag: element.tagName, type: element.getAttribute('type'),
        name: element.getAttribute('name'), placeholder: element.getAttribute('placeholder'),
        labels: [...(element.labels ?? [])].map(label => clean(label.innerText)),
        required: element.required, disabled: element.disabled, value: element.value,
      })),
      buttons: list('button').map(element => ({ text: clean(element.innerText), label: element.getAttribute('aria-label'), disabled: element.disabled, expanded: element.getAttribute('aria-expanded') })),
      tabs: list('[role="tab"]').map(element => ({ text: clean(element.innerText), selected: element.getAttribute('aria-selected') })),
    };
  });
}

async function stableSnapshot(page) {
  let previous;
  let repetitions = 0;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const snapshot = await visibleSnapshot(page);
    const serialized = JSON.stringify(snapshot);
    repetitions = serialized === previous ? repetitions + 1 : 0;
    if (repetitions >= 3 && snapshot.text.length > 20) return snapshot;
    previous = serialized;
    await page.waitForTimeout(200);
  }
  throw new Error('Visible UI did not settle for three consecutive 200ms samples');
}

async function expectations(page, route, viewport) {
  if (route === '/') {
    await page.getByRole('heading', { name: 'El sistema operativo de tu agencia de carga', exact: true }).waitFor();
    assert(await page.getByRole('link', { name: 'Crear cuenta gratis', exact: true }).first().isVisible(), 'Public signup CTA missing');
    const cta = page.getByRole('link', { name: 'Crear cuenta gratis', exact: true }).first();
    assert.equal(await cta.getAttribute('href'), '/login?tab=signup');
    const demoButtons = page.getByRole('button', { name: 'Demo no disponible', exact: true });
    assert(await demoButtons.count() > 0, 'Disabled demo CTA missing');
    for (const button of await demoButtons.all()) assert(await button.isDisabled(), 'Demo CTA must remain disabled');
    if (viewport.width < 1024) {
      const toggle = page.getByRole('button', { name: 'Abrir menú', exact: true });
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      assert(await page.getByRole('navigation', { name: 'Móvil', exact: true }).getByRole('link', { name: 'Iniciar sesión', exact: true }).isVisible());
      const mobileMenu = await stableSnapshot(page);
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      return { mobileMenu };
    }
    assert(await page.getByRole('banner').getByRole('link', { name: 'Iniciar sesión', exact: true }).isVisible());
    return {};
  }
  const email = page.getByLabel('Email', { exact: true });
  const password = page.getByLabel('Contraseña', { exact: true });
  await email.waitFor();
  assert.equal(await email.getAttribute('type'), 'email');
  assert.equal(await password.getAttribute('type'), 'password');
  assert.equal(await email.inputValue(), '');
  assert.equal(await password.inputValue(), '');
  assert(await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).isEnabled());
  assert.equal(await page.getByRole('tab', { name: 'Iniciar sesión', exact: true }).getAttribute('aria-selected'), 'true');
  assert.equal(await page.getByRole('tab', { name: 'Crear cuenta', exact: true }).getAttribute('aria-selected'), 'false');
  await page.getByRole('button', { name: 'Mostrar contraseña', exact: true }).click();
  assert.equal(await password.getAttribute('type'), 'text');
  await page.getByRole('button', { name: 'Ocultar contraseña', exact: true }).click();
  assert.equal(await password.getAttribute('type'), 'password');
  return { emptyPasswordToggle: true, formSubmitted: false };
}

async function smokeCase(browser, endpoint, route, viewport) {
  const context = await browser.newContext({
    viewport, locale: 'es-MX', timezoneId: 'UTC', colorScheme: 'light',
    permissions: [], serviceWorkers: 'block', acceptDownloads: false,
    storageState: { cookies: [], origins: [] },
  });
  const blocked = new Map();
  const blockedSockets = [];
  const pageerrors = [];
  const scripts = [];
  const resourcesFailed = [];
  const failedLocalRequests = [];
  const countBlocked = request => {
    let origin = 'invalid-url';
    try { origin = new URL(request.url()).origin; } catch { /* no raw URL in public evidence */ }
    const key = JSON.stringify({ origin, method: request.method(), type: request.resourceType() });
    blocked.set(key, (blocked.get(key) ?? 0) + 1);
  };
  try {
    await context.route('**/*', async interception => {
      const request = interception.request();
      const url = new URL(request.url());
      if (url.origin === endpoint.origin && ['GET', 'HEAD'].includes(request.method())) {
        await interception.continue();
      } else {
        countBlocked(request);
        await interception.abort('blockedbyclient');
      }
    });
    await context.routeWebSocket(/.*/, socket => {
      blockedSockets.push(new URL(socket.url()).origin);
      socket.close({ code: 1008, reason: 'Local static smoke only' });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.on('pageerror', error => pageerrors.push(normalize(error.message)));
    page.on('response', response => {
      const request = response.request();
      if (request.resourceType() === 'script') scripts.push({ path: new URL(response.url()).pathname, status: response.status() });
      if (['script', 'stylesheet', 'document'].includes(request.resourceType()) && response.status() >= 400) {
        resourcesFailed.push({ type: request.resourceType(), status: response.status() });
      }
    });
    page.on('requestfailed', request => {
      if (new URL(request.url()).origin === endpoint.origin) {
        failedLocalRequests.push({ type: request.resourceType(), path: new URL(request.url()).pathname });
      }
    });
    const response = await page.goto(`${endpoint.origin}${route}`, { waitUntil: 'load', timeout: 30_000 });
    assert.equal(response.status(), 200);
    const interaction = await expectations(page, route, viewport);
    const snapshot = await stableSnapshot(page);
    assert.equal(new URL(page.url()).pathname, route, 'Unexpected route redirect');
    assert.equal(pageerrors.length, 0, `Uncaught page errors: ${JSON.stringify(pageerrors)}`);
    assert(scripts.some(script => script.path.startsWith('/assets/') && script.status === 200), 'No application bundle executed');
    assert.equal(resourcesFailed.length, 0, 'Document, script or stylesheet failed');
    assert.equal(failedLocalRequests.length, 0, 'Local static request failed');
    assert.equal((await context.cookies()).length, 0, 'Unexpected cookie created');
    return {
      route, viewport, passed: true, pageerrors, interaction,
      scripts, resourcesFailed, failedLocalRequests, snapshotSha256: hash(JSON.stringify(snapshot)), snapshot,
      network: { allowedOrigin: 'own loopback static server only', blockedRequests: [...blocked.entries()].map(([key, count]) => ({ ...JSON.parse(key), count })), blockedWebSockets: blockedSockets },
    };
  } catch (error) {
    return { route, viewport, passed: false, error: normalize(error.message), pageerrors, scripts, resourcesFailed, failedLocalRequests, network: { blockedRequests: [...blocked.entries()].map(([key, count]) => ({ ...JSON.parse(key), count })), blockedWebSockets: blockedSockets } };
  } finally {
    await context.close();
  }
}

const args = parseArgs(process.argv.slice(2));
const report = {
  schemaVersion: 1, startedAt: new Date().toISOString(), node: process.version,
  playwright: require('@playwright/test/package.json').version,
  scope: 'Unauthenticated public routes, light theme, empty isolated contexts; text/links/fields/buttons and small local UI interactions. No form submission or backend. Remote fonts are unavailable. This does not establish complete functional or visual equivalence, authorization, authenticated modules, or performance.',
  networkPolicy: 'Before navigation, context routing aborts every request except GET/HEAD to its exact ephemeral loopback static origin; service workers blocked and every WebSocket closed without connecting. The temporary HTTP response removes preconnect/dns-prefetch links, and browser DNS resolution denies every hostname except 127.0.0.1. Input HTML/assets are not modified.',
  builds: [], comparison: null, passed: false,
};
let browser;
const endpoints = [];
try {
  const builds = [];
  for (const directory of args.builds) builds.push(await inspectBuild(directory));
  for (const build of builds) assert(!contained(build.root, args.output), 'Evidence output must be outside build directories');
  // Default chromium uses Playwright's own pinned headless binary. Do not add a
  // channel, custom executablePath, persistent context, profile, or browser state.
  const executable = chromium.executablePath();
  assert(/(?:chromium|chrome-headless-shell)[-_]\d+/.test(executable), 'Expected Playwright-managed Chromium');
  report.playwrightBrowserRevision = executable.match(/(?:chromium|chrome-headless-shell)[-_](\d+)/)[1];
  browser = await chromium.launch({ headless: true, args: [
    '--no-proxy-server', '--disable-background-networking', '--dns-prefetch-disable',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
  ] });
  report.chromium = browser.version();
  report.browserBinary = 'Playwright-managed Chromium; no channel or custom executablePath';
  for (let index = 0; index < builds.length; index += 1) {
    const build = builds[index];
    const endpoint = await serveBuild(build);
    endpoints.push(endpoint);
    const cases = [];
    for (const viewport of viewports) {
      for (const route of routes) cases.push(await smokeCase(browser, endpoint, route, viewport));
    }
    report.builds.push({ label: `build-${index + 1}`, directory: path.basename(build.root), indexSha256: build.indexSha256, javascriptFiles: build.javascriptFiles, syntheticUrlPresent: build.syntheticUrlPresent, syntheticKeyPresent: build.syntheticKeyPresent, cases, staticServer: { requests: endpoint.served.length, connectionHintsRemoved: endpoint.connectionHintsRemoved, failed: endpoint.served.filter(request => request.status >= 400) } });
  }
  if (report.builds.length === 2) {
    const comparisons = report.builds[0].cases.map((reference, index) => {
      const other = report.builds[1].cases[index];
      return { route: reference.route, viewport: reference.viewport, passed: reference.passed && other.passed && JSON.stringify(reference.snapshot) === JSON.stringify(other.snapshot) && JSON.stringify(reference.interaction) === JSON.stringify(other.interaction) };
    });
    report.comparison = { kind: 'Visible UI comparison only; caller identifies build variants', cases: comparisons, passed: comparisons.every(result => result.passed) };
  }
  report.passed = report.builds.every(build => build.cases.every(result => result.passed)) && (report.comparison?.passed ?? true);
} catch (error) {
  report.error = normalize(error.message);
} finally {
  if (browser) await browser.close().catch(error => {
    report.passed = false;
    report.shutdownError = normalize(error.message);
  });
  for (const endpoint of endpoints) {
    endpoint.server.closeAllConnections();
    await new Promise(resolve => endpoint.server.close(resolve));
  }
  report.finishedAt = new Date().toISOString();
  await mkdir(path.dirname(args.output), { recursive: true });
  await writeFile(args.output, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ passed: report.passed, builds: report.builds.length, cases: report.builds.flatMap(build => build.cases).length, output: args.output }));
if (!report.passed) process.exitCode = 1;
