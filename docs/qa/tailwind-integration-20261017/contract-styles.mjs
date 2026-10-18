#!/usr/bin/env node
/* global document, CSS, getComputedStyle, innerWidth, innerHeight, createImageBitmap, OffscreenCanvas, atob */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { firstDifferences, htmlAssetReferences, parseArguments, readCssBuild, sha256, writeJson } from './compare-css.mjs';
import { isolatedEnvironment } from './integration.mjs';

// This module lives outside Tailwind's explicit product content globs. It never
// passes these strings to Tailwind or rebuilds CSS. Missing generated utilities
// are reported as failures rather than silently synthesised.
const buttonClasses = 'rounded-md text-body bg-primary text-primary-foreground h-11 md:h-10 px-4 py-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
const pageClasses = 'mx-auto w-full p-4 sm:p-6 short:sm:p-4 max-w-screen-2xl space-y-6 short:space-y-4';
const requiredClasses = [...new Set(`${buttonClasses} ${pageClasses} container space-y-2 mb-2 sm:space-x-2 divide-x divide-y lg:divide-y-0 rounded-sm bg-card text-card-foreground shadow-card landing-scope`.split(' '))];
const fixtureHtml = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>CSS contracts only</title></head><body>
<main id="page" class="${pageClasses}">
  <div id="tokens" class="rounded-sm bg-card text-card-foreground shadow-card">LibreCarga: tipografía y tokens</div>
  <button id="focus" class="${buttonClasses}">Acción sintética</button>
  <button id="disabled" class="${buttonClasses}" disabled>Deshabilitado</button>
  <div id="container" class="container" style="height:12px"></div>
  <div id="space-y" class="space-y-2"><div id="space-first" class="mb-2">Primero</div><div hidden>Oculto</div><div id="space-last">Último</div></div>
  <div id="space-x" class="sm:space-x-2"><span style="display:inline-block">Primero</span><span hidden>Oculto</span><span id="space-x-last" style="display:inline-block">Último</span></div>
  <div id="divide" class="divide-x divide-y lg:divide-y-0"><div>Primero</div><div hidden>Oculto</div><div id="divide-last">Último</div></div>
  <div id="landing" class="landing-scope rounded-md">Landing: paleta independiente</div>
</main></body></html>`;

export function contractMatrix() {
  const scenarios = [];
  for (const theme of ['light', 'dark']) {
    for (const width of [390, 691, 1280]) {
      for (const height of [799, 800, 801, 900]) scenarios.push({ theme, width, height });
    }
    // Exercise the compatibility container and the page's actual width limits,
    // which cannot be established by viewports below 1400px alone.
    for (const width of [1400, 2000]) scenarios.push({ theme, width, height: 900 });
  }
  return scenarios;
}

function linkedStyles(build) {
  const html = build.files.get('index.html');
  assert.ok(html, 'Output must contain index.html');
  const references = htmlAssetReferences(html, 'index.html', new Set(build.names));
  const stylesheetReferences = references.filter((reference) => reference.tag === 'link' && /(?:^|\s)stylesheet(?:\s|$)/i.test(reference.attributes.rel ?? ''));
  const externalStylesheetsNotLoaded = stylesheetReferences.filter((reference) => reference.external).map((reference) => reference.external);
  const names = stylesheetReferences.filter((reference) => reference.fileName).map((reference) => reference.fileName);
  assert.ok(names.length, 'index.html must link emitted CSS');
  const css = names.map((name) => {
    const file = build.css.find((value) => value.fileName === name);
    assert.ok(file, `Stylesheet was not emitted: ${name}`);
    return file;
  });
  return { css, externalStylesheetsNotLoaded, omittedCss: build.css.map((file) => file.fileName).filter((name) => !names.includes(name)) };
}

async function readObservation(page) {
  return page.evaluate(() => {
    const properties = ['display', 'width', 'max-width', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-radius', 'border-color', 'background-color', 'color', 'font-family', 'font-size', 'font-weight', 'line-height', 'box-shadow', 'outline-style', 'outline-width', 'opacity', 'pointer-events'];
    const snapshot = {};
    for (const id of ['page', 'tokens', 'focus', 'disabled', 'container', 'space-first', 'space-last', 'space-x-last', 'divide-last', 'landing']) {
      const element = document.getElementById(id);
      const style = getComputedStyle(element);
      snapshot[id] = { computed: Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)])), rect: element.getBoundingClientRect().toJSON() };
    }
    const tokenNames = ['--background', '--foreground', '--primary', '--primary-foreground', '--radius', '--radius-sm', '--radius-lg', '--shadow-card'];
    const tokenValues = (element) => Object.fromEntries(tokenNames.map((name) => [name, getComputedStyle(element).getPropertyValue(name).trim()]));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = getComputedStyle(document.getElementById('tokens')).font;
    return {
      viewport: { width: innerWidth, height: innerHeight },
      theme: document.documentElement.className,
      elements: snapshot,
      rootTokens: tokenValues(document.documentElement),
      landingTokens: tokenValues(document.getElementById('landing')),
      activeElement: document.activeElement?.id,
      focusVisible: document.getElementById('focus').matches(':focus-visible'),
      typography: { declaredFont: getComputedStyle(document.body).fontFamily, fontSetStatus: document.fonts.status, localFontFaces: [...document.fonts].map((font) => ({ family: font.family, status: font.status })), textWidth: context.measureText('LibreCarga: tipografía y tokens').width },
    };
  });
}

async function inspectStylesheets(page) {
  return page.evaluate((classes) => {
    const selectors = [];
    function ruleSnapshot(rule) {
      if (rule.selectorText) selectors.push(rule.selectorText);
      const nested = rule.cssRules ? [...rule.cssRules].map(ruleSnapshot) : null;
      return {
        type: rule.constructor.name,
        selector: rule.selectorText ?? null,
        condition: rule.conditionText ?? null,
        name: rule.name ?? null,
        declarations: rule.style?.cssText ?? null,
        text: nested ? rule.cssText.slice(0, rule.cssText.indexOf('{')) : rule.cssText,
        children: nested,
      };
    }
    const cssom = [...document.styleSheets].map((sheet) => ({ rules: [...sheet.cssRules].map(ruleSnapshot) }));
    const missingClasses = classes.filter((name) => {
      const escaped = `.${CSS.escape(name)}`;
      return !selectors.some((selector) => {
        const index = selector.indexOf(escaped);
        const following = index < 0 ? '' : selector[index + escaped.length] ?? '';
        return index >= 0 && !/[\w-]/.test(following);
      });
    });
    return { cssom, missingClasses };
  }, requiredClasses);
}

function validateContracts(observation, scenario) {
  const failures = [];
  const css = (id, property) => observation.elements[id].computed[property];
  const expected = (label, actual, value) => { if (actual !== value) failures.push({ contract: label, actual, expected: value }); };
  expected('page max-width', css('page', 'max-width'), '1536px');
  expected('short height boundary / responsive page padding', css('page', 'padding-top'), scenario.width < 640 || scenario.height <= 800 ? '16px' : '24px');
  expected('container inline padding', css('container', 'padding-left'), '32px');
  expected('container media max-width', css('container', 'max-width'), scenario.width >= 1400 ? '1400px' : 'none');
  expected('explicit first-child bottom margin', css('space-first', 'margin-bottom'), '8px');
  expected('next visible sibling top margin', css('space-last', 'margin-top'), '8px');
  expected('responsive horizontal next visible sibling', css('space-x-last', 'margin-left'), scenario.width >= 640 ? '8px' : '0px');
  expected('divide leading horizontal border', css('divide-last', 'border-left-width'), '1px');
  expected('divide leading vertical border / lg removal', css('divide-last', 'border-top-width'), scenario.width >= 1024 ? '0px' : '1px');
  expected('semantic small radius', css('tokens', 'border-radius'), '6px');
  expected('semantic medium radius', css('focus', 'border-radius'), '6px');
  expected('body text utility size', css('focus', 'font-size'), '14px');
  expected('body text utility line height', css('focus', 'line-height'), '21px');
  expected('disabled opacity', css('disabled', 'opacity'), '0.5');
  expected('disabled pointer events', css('disabled', 'pointer-events'), 'none');
  expected('keyboard focus', observation.activeElement, 'focus');
  expected('keyboard focus visible', observation.focusVisible, true);
  if (css('focus', 'box-shadow') === 'none') failures.push({ contract: 'focus ring', actual: 'none', expected: 'visible ring shadow' });
  if (!observation.typography.declaredFont.includes('Inter')) failures.push({ contract: 'declared font stack', actual: observation.typography.declaredFont, expected: 'Inter, sans-serif' });
  if (scenario.width >= 2000 && observation.elements.page.rect.width !== 1536) failures.push({ contract: 'page actual width at wide viewport', actual: observation.elements.page.rect.width, expected: 1536 });
  return failures;
}

async function platformFonts(context, page) {
  const session = await context.newCDPSession(page);
  try {
    await session.send('DOM.enable');
    await session.send('CSS.enable');
    const { root } = await session.send('DOM.getDocument');
    const { nodeId } = await session.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#tokens' });
    return (await session.send('CSS.getPlatformFontsForNode', { nodeId })).fonts;
  } finally { await session.detach(); }
}

async function compareRgba(page, left, right) {
  return page.evaluate(async ({ baseline, candidate }) => {
    const decode = async (encoded) => {
      const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      const result = { width: bitmap.width, height: bitmap.height, data: context.getImageData(0, 0, bitmap.width, bitmap.height).data };
      bitmap.close();
      return result;
    };
    const first = await decode(baseline);
    const second = await decode(candidate);
    if (first.width !== second.width || first.height !== second.height) return { equal: false, reason: 'dimensions differ', baseline: [first.width, first.height], candidate: [second.width, second.height] };
    let differentPixels = 0;
    let maximumChannelDifference = 0;
    for (let offset = 0; offset < first.data.length; offset += 4) {
      let different = false;
      for (let channel = 0; channel < 4; channel += 1) {
        const delta = Math.abs(first.data[offset + channel] - second.data[offset + channel]);
        different ||= delta > 0;
        maximumChannelDifference = Math.max(maximumChannelDifference, delta);
      }
      if (different) differentPixels += 1;
    }
    return { equal: differentPixels === 0, width: first.width, height: first.height, differentPixels, maximumChannelDifference };
  }, { baseline: left.toString('base64'), candidate: right.toString('base64') });
}

export async function checkStyleContracts(baselineDirectory, candidateDirectory, output) {
  const builds = { baseline: await readCssBuild(baselineDirectory), candidate: await readCssBuild(candidateDirectory) };
  const styles = Object.fromEntries(Object.entries(builds).map(([name, build]) => [name, linkedStyles(build)]));
  const imagesDirectory = path.join(path.dirname(output), 'contract-styles-images');
  await mkdir(imagesDirectory, { recursive: true });
  const browser = await chromium.launch({ headless: true, env: isolatedEnvironment(), args: ['--disable-background-networking', '--disable-component-update', '--disable-sync', '--no-first-run'] });
  const result = {
    schemaVersion: 1,
    ok: false,
    scope: 'Synthetic DOM using only product CSS linked by emitted index.html, without application JS. Focused CSSOM/computed/geometry/RGBA checks, not application or universal visual equivalence.',
    fontPolicy: 'No injected fonts or external font downloads. Same controlled Chromium/OS fallback for both variants; actual platform fonts recorded. Does not certify Inter loading in the application.',
    browser: { name: 'chromium', version: browser.version(), executablePath: chromium.executablePath() },
    cssInputs: Object.fromEntries(Object.entries(styles).map(([name, style]) => [name, { linked: style.css.map((file) => ({ fileName: file.fileName, sha256: file.sha256 })), omittedUnlinkedCss: style.omittedCss, externalStylesheetsNotLoaded: style.externalStylesheetsNotLoaded }])),
    requiredGeneratedClasses: requiredClasses,
    stylesheetInspections: {},
    platformFonts: {},
    networkAttempts: [],
    pageErrors: [],
    scenarios: [],
  };
  try {
    for (const scenario of contractMatrix()) {
      const contexts = {};
      const pages = {};
      const screenshots = {};
      const observations = {};
      const scenarioName = `${scenario.theme}-${scenario.width}x${scenario.height}`;
      try {
        for (const variant of ['baseline', 'candidate']) {
          const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height }, colorScheme: scenario.theme, deviceScaleFactor: 1, locale: 'es-MX', timezoneId: 'America/Mexico_City', reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: false });
          contexts[variant] = context;
          await context.route('**/*', (route) => {
            const request = route.request();
            const url = new URL(request.url());
            result.networkAttempts.push({ variant, scenario: scenarioName, method: request.method(), url: `${url.origin}${url.pathname}` });
            return route.abort('blockedbyclient');
          });
          await context.routeWebSocket(/.*/, (socket) => { result.networkAttempts.push({ variant, scenario: scenarioName, websocket: true }); socket.close(); });
          const page = await context.newPage();
          pages[variant] = page;
          page.on('pageerror', (error) => result.pageErrors.push({ variant, scenario: scenarioName, message: error.message }));
          await page.setContent(fixtureHtml, { waitUntil: 'load' });
          await page.evaluate((theme) => document.documentElement.classList.toggle('dark', theme === 'dark'), scenario.theme);
          for (const file of styles[variant].css) await page.addStyleTag({ content: file.source });
          await page.evaluate(() => document.fonts.ready);
          if (!result.stylesheetInspections[variant]) result.stylesheetInspections[variant] = await inspectStylesheets(page);
          if (!result.platformFonts[variant]) result.platformFonts[variant] = await platformFonts(context, page);
          await page.keyboard.press('Tab');
          observations[variant] = await readObservation(page);
          screenshots[variant] = await page.screenshot({ animations: 'disabled', caret: 'hide' });
          await writeFile(path.join(imagesDirectory, `${scenarioName}-${variant}.png`), screenshots[variant]);
        }
        const computedEquivalent = JSON.stringify(observations.baseline) === JSON.stringify(observations.candidate);
        const rgba = await compareRgba(pages.candidate, screenshots.baseline, screenshots.candidate);
        const contracts = Object.fromEntries(['baseline', 'candidate'].map((variant) => [variant, validateContracts(observations[variant], scenario)]));
        result.scenarios.push({ ...scenario, ok: computedEquivalent && rgba.equal && !contracts.baseline.length && !contracts.candidate.length, computedEquivalent, firstDifferentProperties: computedEquivalent ? [] : firstDifferences(observations.baseline, observations.candidate), rgba, contracts, observations, screenshots: Object.fromEntries(['baseline', 'candidate'].map((variant) => [variant, { path: path.relative(path.dirname(output), path.join(imagesDirectory, `${scenarioName}-${variant}.png`)), sha256: sha256(screenshots[variant]) }])) });
      } finally { for (const context of Object.values(contexts)) await context.close(); }
    }
    result.cssomEquivalent = JSON.stringify(result.stylesheetInspections.baseline?.cssom) === JSON.stringify(result.stylesheetInspections.candidate?.cssom);
    result.cssomSha256 = Object.fromEntries(['baseline', 'candidate'].map((variant) => [variant, sha256(JSON.stringify(result.stylesheetInspections[variant]?.cssom))]));
    result.ok = result.cssomEquivalent && result.scenarios.every((scenario) => scenario.ok) && Object.values(result.stylesheetInspections).every((inspection) => !inspection.missingClasses.length) && !result.networkAttempts.length && !result.pageErrors.length;
  } catch (error) { result.error = error.stack ?? String(error); }
  finally { await browser.close(); }
  return result;
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  let result;
  try { result = await checkStyleContracts(arguments_.baseline, arguments_.candidate, arguments_.output); }
  catch (error) { result = { schemaVersion: 1, ok: false, error: error.stack ?? String(error) }; }
  await writeJson(arguments_.output, result);
  process.stdout.write(`${JSON.stringify({ ok: result.ok, scenarios: result.scenarios?.length, cssomEquivalent: result.cssomEquivalent, output: arguments_.output })}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
}
