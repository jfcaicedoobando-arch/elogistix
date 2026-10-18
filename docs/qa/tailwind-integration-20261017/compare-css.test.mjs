import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { compareCssBuilds } from './compare-css.mjs';

async function output(t, source, overrides = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'tailwind-css-gate-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, 'assets'));
  await writeFile(path.join(directory, 'assets/style.css'), source);
  await writeFile(path.join(directory, 'assets/main.js'), 'const styles="assets/style.css";');
  await writeFile(path.join(directory, 'index.html'), '<link rel="stylesheet" href="/assets/style.css"><script type="module" src="/assets/main.js"></script>');
  await writeFile(path.join(directory, '.qa-build-metadata.json'), JSON.stringify({
    schemaVersion: 1,
    chunks: [{ fileName: 'assets/main.js', facadeModuleId: 'src/main.tsx', moduleIds: ['src/main.tsx', 'src/index.css'], imports: [], dynamicImports: [], css: ['assets/style.css'], ...overrides }],
  }));
  return directory;
}

test('node formatting and standalone comments may differ while ordered CSS/associations match', async (t) => {
  const baseline = await output(t, '/* license */\n.a { color: red; background: blue; }');
  const candidate = await output(t, '.a{color:red;background:blue}');
  const result = await compareCssBuilds(baseline, candidate);
  assert.equal(result.byteEquivalent, false);
  assert.equal(result.cssEquivalent, true);
  assert.equal(result.associationEquivalent, true);
  assert.equal(result.ok, true);
});

for (const [name, baselineCss, candidateCss] of [
  ['rule cascade order', '.a{color:red}.a{color:blue}', '.a{color:blue}.a{color:red}'],
  ['declaration cascade order', '.a{color:red;color:blue}', '.a{color:blue;color:red}'],
  ['layer ordering', '@layer base,utilities;@layer base{.a{color:red}}', '@layer utilities,base;@layer base{.a{color:red}}'],
  ['property value', '.a{color:red}', '.a{color:blue}'],
  ['custom token value', ':root{--brand:1 2 3}.a{color:rgb(var(--brand))}', ':root{--brand:4 5 6}.a{color:rgb(var(--brand))}'],
  ['important priority', '.a{color:red!important}', '.a{color:red}'],
  ['property registration', '@property --size{syntax:"<length>";inherits:false;initial-value:0px}', '@property --size{syntax:"<length>";inherits:true;initial-value:0px}'],
  ['comment between value tokens', '.a{margin:1/**/px}', '.a{margin:1px}'],
]) {
  test(`reject changes to ${name}`, async (t) => {
    const result = await compareCssBuilds(await output(t, baselineCss), await output(t, candidateCss));
    assert.equal(result.ok, false);
    assert.equal(result.cssEquivalent, false);
    assert.ok(result.comparisons[0].firstDifferentNodes.length);
  });
}

test('same CSS cannot hide different chunk-to-stylesheet association', async (t) => {
  const result = await compareCssBuilds(await output(t, '.a{color:red}'), await output(t, '.a{color:red}', { css: [] }));
  assert.equal(result.cssEquivalent, true);
  assert.equal(result.associationEquivalent, false);
  assert.equal(result.ok, false);
});

test('missing metadata or ambiguous chunk origins cannot approve association', async (t) => {
  const baseline = await output(t, '.a{color:red}');
  const candidate = await output(t, '.a{color:red}');
  await rm(path.join(candidate, '.qa-build-metadata.json'));
  assert.equal((await compareCssBuilds(baseline, candidate)).ok, false);
  await writeFile(path.join(candidate, 'assets/duplicate.js'), 'void 0;');
  const chunk = { facadeModuleId: 'src/main.tsx', moduleIds: ['src/main.tsx', 'src/index.css'], imports: [], dynamicImports: [], css: ['assets/style.css'] };
  await writeFile(path.join(candidate, '.qa-build-metadata.json'), JSON.stringify({ chunks: [{ ...chunk, fileName: 'assets/main.js' }, { ...chunk, fileName: 'assets/duplicate.js' }] }));
  const result = await compareCssBuilds(baseline, candidate);
  assert.equal(result.ok, false);
  assert.ok(result.candidate.associations.failures.some((failure) => failure.includes('Ambiguous chunk identity')));
});

test('dangling HTML stylesheet references fail even when CSS bytes match', async (t) => {
  const baseline = await output(t, '.a{color:red}');
  const candidate = await output(t, '.a{color:red}');
  await writeFile(path.join(candidate, 'index.html'), '<link rel="stylesheet" href="/assets/missing.css"><script type="module" src="/assets/main.js"></script>');
  assert.equal((await compareCssBuilds(baseline, candidate)).ok, false);
});

test('preload helper extension suffix is not a resource, while a missing real CSS filename still fails', async (t) => {
  const baseline = await output(t, '.a{color:red}');
  const candidate = await output(t, '.a{color:red}');
  const helper = 'function isCss(asset){return asset.endsWith(".css")}const assets=["assets/style.css"];';
  await writeFile(path.join(baseline, 'assets/main.js'), helper);
  await writeFile(path.join(candidate, 'assets/main.js'), helper);
  assert.equal((await compareCssBuilds(baseline, candidate)).ok, true);
  await writeFile(path.join(candidate, 'assets/main.js'), `${helper}const missing="missing-real.css";`);
  const result = await compareCssBuilds(baseline, candidate);
  assert.equal(result.cssEquivalent, true);
  assert.equal(result.associationEquivalent, false);
  assert.equal(result.ok, false);
  assert.ok(result.candidate.associations.failures.some((failure) => failure.includes('Unresolved static asset missing-real.css')));
});
