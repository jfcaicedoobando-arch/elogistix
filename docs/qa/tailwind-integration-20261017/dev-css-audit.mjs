#!/usr/bin/env node
// Separate diagnostic: never changes the measured HMR harness or product files.
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { get } from 'node:http';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { integrationOverrides, isolatedEnvironment } from './integration.mjs';
import { repo, relative, contained, probeCss, targetFor, fixtureHtml, sourceSnapshot, installedVersions, sha256, evidence, redactText } from './hmr-common.mjs';
import { describeCss, firstDifferences } from './compare-css.mjs';

const self = fileURLToPath(import.meta.url);
const here = path.dirname(self);
const save = (name, value) => writeFile(name, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });

function cssGet(origin, pathname) {
  const url = new URL(pathname, origin);
  assert.equal(url.origin, origin);
  assert.equal(url.hostname, '127.0.0.1');
  return new Promise((resolve, reject) => {
    const request = get(url, { headers: { Accept: 'text/css,*/*;q=0.1', 'Cache-Control': 'no-cache' } }, response => {
      // Node http.get does not follow redirects or fetch CSS subresources.
      if (response.statusCode !== 200 || !response.headers['content-type']?.includes('text/css') || response.headers['content-encoding']) {
        response.resume();
        reject(new Error(`Unexpected CSS response: ${response.statusCode}/${response.headers['content-type']}/${response.headers['content-encoding']}`));
        return;
      }
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.once('error', reject);
      response.once('end', () => resolve({ css: Buffer.concat(chunks).toString('utf8'), status: response.statusCode, contentType: response.headers['content-type'] }));
    });
    request.setTimeout(60_000, () => request.destroy(new Error('CSS GET timeout')));
    request.once('error', reject);
  });
}

async function worker(config) {
  assert.equal(process.env.NODE_ENV, 'development');
  assert(contained(path.join(repo, 'reports'), config.probe));
  assert(contained(path.join(repo, 'reports'), config.cache));
  assert(!contained(config.cache, config.probe));
  const report = { variant: config.variant, node: process.version, passed: false, errors: [], startedAt: new Date().toISOString() };
  let server;
  try {
    const { createServer, createLogger } = await import('vite');
    const overrides = await integrationOverrides(config.variant);
    // The same input config as hmr-session.mjs. No browser, application JS,
    // WebSocket connection, transformed production config, or backend is used.
    server = await createServer({
      ...overrides, configFile: false, root: repo, envDir: false, mode: 'development',
      customLogger: createLogger('info', { allowClearScreen: false }), clearScreen: false, cacheDir: config.cache,
      css: { ...overrides.css, devSourcemap: false },
      optimizeDeps: { entries: [], noDiscovery: true, include: [] },
      server: { host: '127.0.0.1', port: 0, strictPort: true, open: false,
        ws: { host: '127.0.0.1' }, hmr: { overlay: false }, fs: { strict: true, allow: [repo] } },
    });
    await server.listen();
    const address = server.httpServer.address();
    assert.equal(address.address, '127.0.0.1');
    const origin = `http://127.0.0.1:${address.port}`;
    report.config = {
      configFile: false, envDir: server.config.envDir, root: '.', mode: server.config.mode,
      css: { devSourcemap: server.config.css.devSourcemap, postcss: config.variant === 'postcss' ? 'implicit root postcss.config.js discovery' : { plugins: [] } },
      plugins: server.config.plugins.map(plugin => plugin.name), cacheDir: relative(config.cache),
      optimizeDeps: { entries: [], noDiscovery: true, include: [] },
      server: { host: address.address, port: address.port, requestedPort: 0, strictPort: true, wsHost: '127.0.0.1', hmrOverlay: false },
      probe: relative(config.probe), fixture: relative(config.html),
    };
    assert.equal(server.config.envDir, false);
    assert.equal(server.config.css.devSourcemap, false);
    assert.equal(sha256(await readFile(config.probe)), config.probeSha256);
    Object.assign(report, await cssGet(origin, `/${relative(config.probe)}`));
    assert(/--hmr-step:\s*0(?:\D|$)/.test(report.css), 'Restored step-0 probe missing from CSS');
    report.probeUnchanged = sha256(await readFile(config.probe)) === config.probeSha256;
    assert(report.probeUnchanged);
    report.passed = true;
  } catch (error) { report.errors.push(error.stack ?? error.message); }
  finally {
    if (server) await server.close().catch(error => { report.errors.push(`Shutdown: ${error.message}`); });
    report.passed = report.passed && report.errors.length === 0;
    report.finishedAt = new Date().toISOString();
  }
  const { css, ...metadata } = report;
  // Public CSS is evidence and must cross IPC without rewriting any byte.
  process.send({ type: 'finished', report: { ...evidence(metadata), css } });
  process.disconnect();
  process.exitCode = report.passed ? 0 : 1;
}

async function runChild(configFile, directory) {
  const child = fork(self, ['--child', configFile], { cwd: repo, execPath: process.execPath,
    env: isolatedEnvironment('development'), stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  const stdout = [], stderr = [];
  child.stdout.on('data', chunk => stdout.push(chunk));
  child.stderr.on('data', chunk => stderr.push(chunk));
  let report;
  let forcedKill = false;
  const result = await new Promise(resolve => {
    const timeout = setTimeout(() => { forcedKill = true; child.kill(); }, 90_000);
    child.once('message', message => { if (message.type === 'finished') report = message.report; });
    child.once('error', error => { report = { passed: false, errors: [error.message] }; });
    child.once('close', (code, signal) => { clearTimeout(timeout); resolve({ ...report, processExit: { code, signal }, forcedKill }); });
  });
  await save(path.join(directory, 'node.stdout.log'), redactText(Buffer.concat(stdout).toString('utf8')));
  await save(path.join(directory, 'node.stderr.log'), redactText(Buffer.concat(stderr).toString('utf8')));
  result.passed = result.passed === true && result.processExit.code === 0 && !forcedKill;
  return result;
}

function ignoredDetails(css) {
  const comments = [], formatting = [];
  function visit(node, pointer = '$') {
    const raws = Object.fromEntries(['before', 'after', 'between', 'semicolon', 'ownSemicolon'].filter(key => node.raws?.[key] !== undefined).map(key => [key, node.raws[key]]));
    formatting.push({ path: pointer, type: node.type, raws });
    let index = 0;
    for (const child of node.nodes ?? []) {
      if (child.type === 'comment') comments.push({ beforeCanonicalChild: `${pointer}/children/${index}`, text: child.text });
      else visit(child, `${pointer}/children/${index++}`);
    }
  }
  visit(postcss.parse(css));
  return { comments, formatting };
}

function rawDifference(left, right) {
  let prefix = 0;
  while (prefix < Math.min(left.length, right.length) && left[prefix] === right[prefix]) prefix += 1;
  let suffix = 0;
  while (suffix < Math.min(left.length, right.length) - prefix && left.at(-suffix - 1) === right.at(-suffix - 1)) suffix += 1;
  return { firstDifferentCharacter: prefix, commonSuffixCharacters: suffix,
    baselineLine: left.slice(0, prefix).split('\n').length, candidateLine: right.slice(0, prefix).split('\n').length,
    baselineContext: left.slice(Math.max(0, prefix - 160), Math.min(left.length, prefix + 500)),
    candidateContext: right.slice(Math.max(0, prefix - 160), Math.min(right.length, prefix + 500)),
    baselineDifferentSpanCharacters: left.length - prefix - suffix, candidateDifferentSpanCharacters: right.length - prefix - suffix };
}

async function main() {
  const args = process.argv.slice(2);
  assert(args.length === 4 && args[0] === '--output' && args[2] === '--hmr-series', 'Usage: node dev-css-audit.mjs --output reports/tailwind-integration/dev-css-audit --hmr-series reports/tailwind-integration/hmr-series-local-permission/series.json');
  const output = path.resolve(repo, args[1]);
  const referencePath = path.resolve(repo, args[3]);
  assert(contained(path.join(repo, 'reports'), referencePath));
  const referenceBytes = await readFile(referencePath);
  const reference = JSON.parse(referenceBytes);
  assert(reference.passed && reference.sessions.length === 8, 'Require complete passing HMR reference series');
  const expected = {};
  for (const variant of ['postcss', 'vite']) {
    const initialResponses = reference.sessions.filter(session => session.variant === variant).map(session => session.child.cssResponses.filter(response => response.step === 0));
    assert.equal(initialResponses.length, 4, 'Require four HMR sessions per arm');
    assert(initialResponses.every(responses => responses.length === 1 && responses[0].status === 200));
    const responses = initialResponses.flat();
    assert.equal(new Set(responses.map(response => response.sha256)).size, 1, 'Initial CSS hashes must be stable across HMR sessions');
    expected[variant] = { sha256: responses[0].sha256, bytes: responses[0].bytes, hmrSessions: 4 };
  }
  assert(contained(path.join(repo, 'reports'), output));
  await mkdir(output, { recursive: true });
  assert.equal((await readdir(output)).length, 0, 'Use a new empty output directory; preserve prior evidence');
  const report = { schemaVersion: 1, startedAt: new Date().toISOString(), passed: false,
    scope: 'Direct development CSS GET for the restored HMR step-0 fixture, fresh isolated Node/Vite/cache per integration. No browser or backend. Ordered CSS AST inspection, not universal runtime/visual equivalence.',
    versions: await installedVersions(), sourceBefore: await sourceSnapshot(),
    hmrReference: { file: relative(referencePath), sha256: sha256(referenceBytes), expectedInitialCss: expected },
    checker: { file: 'compare-css.mjs', sha256: sha256(await readFile(path.join(here, 'compare-css.mjs'))), function: 'describeCss/canonicalNode + firstDifferences; preserves ordered selectors, declarations, duplicates, values, important, layers and property descriptors; ignores standalone comments/node formatting only' },
    upstream: {
      vitePluginSha256: sha256(await readFile(path.join(repo, 'node_modules/@tailwindcss/vite/dist/index.mjs'))),
      postcssPluginSha256: sha256(await readFile(path.join(repo, 'node_modules/@tailwindcss/postcss/dist/index.mjs'))),
      observation: 'Installed Vite plugin generate:serve returns generate() output without its build-only optimize() stage. Installed PostCSS plugin defaults optimize to NODE_ENV===production, false here. Distinct serialization paths alone do not establish the cause or harmlessness of the observed byte difference; inspect the captured AST/raw evidence.',
    }, captures: [], errors: [] };
  try {
    for (const variant of ['postcss', 'vite']) {
      const directory = path.join(output, variant);
      const fixture = path.join(directory, 'fixture');
      const probe = path.join(fixture, 'probe.css');
      const html = path.join(fixture, 'index.html');
      const cache = path.join(directory, 'cache/vite');
      await mkdir(fixture, { recursive: true });
      const content = probeCss(probe, targetFor(0));
      await save(probe, content);
      await save(html, fixtureHtml());
      await save(path.join(fixture, 'probe.mjs'), await readFile(path.join(here, 'hmr-client.mjs'), 'utf8'));
      const config = { variant, html, probe, cache, probeSha256: sha256(content) };
      const configFile = path.join(directory, 'config.json');
      await save(configFile, config);
      const captured = await runChild(configFile, directory);
      if (captured.css !== undefined) {
        const description = describeCss(captured.css, `${variant}.dev.css`);
        await save(path.join(output, `${variant}.dev.css`), captured.css);
        const { source: _source, canonical, ...inventory } = description;
        await save(path.join(directory, 'css-inventory.json'), inventory);
        await save(path.join(directory, 'ordered-ast.json'), canonical);
        captured.inventory = inventory;
        captured.matchesMeasuredHmrCss = description.sha256 === expected[variant].sha256 && description.rawBytes === expected[variant].bytes;
      }
      const { css: _css, ...publicCapture } = captured;
      report.captures.push({ variant, ...publicCapture });
      assert(captured.passed, `Capture failed: ${variant}`);
      assert(captured.matchesMeasuredHmrCss, `Captured ${variant} CSS differs from measured HMR initial response; do not use it to explain the measured difference`);
    }
    const left = describeCss(await readFile(path.join(output, 'postcss.dev.css'), 'utf8'));
    const right = describeCss(await readFile(path.join(output, 'vite.dev.css'), 'utf8'));
    const rawEqual = left.sha256 === right.sha256;
    const astEqual = left.canonicalSha256 === right.canonicalSha256;
    const ignoredLeft = ignoredDetails(left.source), ignoredRight = ignoredDetails(right.source);
    const differences = {
      byteEquivalent: rawEqual, orderedAstEquivalent: astEqual,
      candidateMinusBaselineBytes: right.rawBytes - left.rawBytes,
      firstOrderedAstDifferences: firstDifferences(left.canonical, right.canonical, 50),
      standaloneCommentDifferences: firstDifferences(ignoredLeft.comments, ignoredRight.comments, 50),
      nodeFormattingDifferences: firstDifferences(ignoredLeft.formatting, ignoredRight.formatting, 100),
      raw: rawEqual ? null : rawDifference(left.source, right.source),
    };
    await save(path.join(output, 'differences.json'), differences);
    report.comparison = differences;
    report.explanation = rawEqual ? 'Exact development CSS bytes match.'
      : astEqual ? 'Development CSS bytes differ, but the existing ordered checker finds identical CSS structure. Differences are confined to standalone comments and/or node formatting ignored by that checker; inspect differences.json for the actual locations. This does not establish complete visual/runtime equivalence.'
        : 'Ordered development CSS AST differs. No semantic equivalence claim is established. Preserve raw CSS and inspect firstOrderedAstDifferences before interpreting the HMR timing comparison.';
    await save(path.join(output, 'explanation.md'), `# Development CSS audit\n\n${report.explanation}\n\nPostCSS: ${left.rawBytes} raw bytes, SHA-256 ${left.sha256}.\n\nVite: ${right.rawBytes} raw bytes, SHA-256 ${right.sha256}.\n\nCandidate minus baseline: ${differences.candidateMinusBaselineBytes} bytes. Ordered AST equality: ${astEqual}.\n\nFull CSS is saved as postcss.dev.css and vite.dev.css; ordered ASTs/inventories are retained per arm. differences.json records the first ordered structural differences, standalone comments, formatting raw fields, and first raw byte context. The same canonicalizer as the production CSS checker is imported without modification.\n\n${report.upstream.observation}\n`);
    report.passed = astEqual;
  } catch (error) { report.errors.push(error.stack ?? error.message); }
  finally {
    report.sourceAfter = await sourceSnapshot();
    report.sourceUnchanged = report.sourceBefore.sha256 === report.sourceAfter.sha256;
    report.passed = report.passed && report.sourceUnchanged;
    report.finishedAt = new Date().toISOString();
    await save(path.join(output, 'audit.json'), report);
  }
  console.log(JSON.stringify({ passed: report.passed, output: relative(path.join(output, 'audit.json')) }));
  if (!report.passed) process.exitCode = 1;
}

if (process.argv[2] === '--child') await worker(JSON.parse(await readFile(process.argv[3], 'utf8')));
else await main();
