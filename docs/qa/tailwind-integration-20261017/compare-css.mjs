#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const portable = (value) => value.split(path.sep).join('/');
const stringify = (value) => JSON.stringify(value);

async function listFiles(directory, root = directory) {
  const files = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink in build output: ${absolute}`);
    if (entry.isDirectory()) files.push(...await listFiles(absolute, root));
    else if (entry.isFile()) files.push(portable(path.relative(root, absolute)));
    else throw new Error(`Unsupported output entry: ${absolute}`);
  }
  return files;
}

export function canonicalNode(node) {
  // Do not sort anything. Declaration order, duplicates, selectors, @layer
  // order, @property descriptors and nested conditions all affect the cascade.
  if (node.type === 'comment') return null;
  const result = { type: node.type };
  if (node.type === 'rule') result.selector = node.raws.selector?.raw ?? node.selector;
  if (node.type === 'decl') Object.assign(result, { property: node.prop, value: node.raws.value?.raw ?? node.value, important: Boolean(node.important) });
  if (node.type === 'atrule') Object.assign(result, { name: node.name, params: node.raws.params?.raw ?? node.params });
  if (node.nodes) result.children = node.nodes.map(canonicalNode).filter((value) => value !== null);
  return result;
}

export function describeCss(source, fileName = 'input.css') {
  const root = postcss.parse(source, { from: fileName });
  const selectors = [];
  const tokens = [];
  const urls = [];
  const properties = [];
  let declarations = 0;
  root.walkRules((rule) => selectors.push(rule.selector));
  root.walkAtRules('property', (rule) => properties.push({ name: rule.params, descriptors: canonicalNode(rule).children ?? [] }));
  root.walkDecls((declaration) => {
    declarations += 1;
    if (declaration.prop.startsWith('--')) tokens.push({ property: declaration.prop, value: declaration.value, important: Boolean(declaration.important) });
    for (const match of declaration.value.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi)) {
      urls.push({ property: declaration.prop, url: match[1] ?? match[2] ?? match[3] });
    }
  });
  const canonical = canonicalNode(root);
  return {
    fileName,
    rawBytes: Buffer.byteLength(source),
    sha256: sha256(source),
    canonicalSha256: sha256(stringify(canonical)),
    rules: selectors.length,
    declarations,
    selectorGroups: selectors,
    customPropertyDeclarations: tokens,
    registeredProperties: properties,
    urls,
    canonical,
    source,
  };
}

export function firstDifferences(baseline, candidate, limit = 12, pointer = '$', result = []) {
  if (result.length >= limit || Object.is(baseline, candidate)) return result;
  if (baseline === null || candidate === null || typeof baseline !== 'object' || typeof candidate !== 'object' || Array.isArray(baseline) !== Array.isArray(candidate)) {
    result.push({ path: pointer, baseline: baseline ?? null, candidate: candidate ?? null });
    return result;
  }
  const keys = [...new Set([...Object.keys(baseline), ...Object.keys(candidate)])];
  for (const key of keys) {
    if (result.length >= limit) break;
    firstDifferences(baseline[key], candidate[key], limit, `${pointer}/${key}`, result);
  }
  return result;
}

function attributes(tag) {
  const result = {};
  for (const match of tag.matchAll(/([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  delete result.script;
  delete result.link;
  return result;
}

export function resolveAsset(reference, owner, names) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) return { external: reference };
  const plain = decodeURIComponent(reference.split(/[?#]/)[0]).replace(/^\/+/, '');
  if (plain.includes('\\')) throw new Error(`Backslash in asset URL: ${reference}`);
  if (names.has(plain)) return { fileName: plain };
  const relative = path.posix.normalize(path.posix.join(path.posix.dirname(owner), plain));
  if (relative.startsWith('../') || !names.has(relative)) throw new Error(`Unresolved static asset ${reference} in ${owner}`);
  return { fileName: relative };
}

export function htmlAssetReferences(source, owner, names) {
  const references = [];
  for (const match of source.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
    const tag = /^<script\b/i.test(match[0]) ? 'script' : 'link';
    const attrs = attributes(match[0]);
    const reference = tag === 'script' ? attrs.src : attrs.href;
    if (!reference) continue;
    delete attrs.src;
    delete attrs.href;
    references.push({ tag, attributes: Object.fromEntries(Object.entries(attrs).sort(([a], [b]) => a.localeCompare(b))), ...resolveAsset(reference, owner, names) });
  }
  return references;
}

export async function readCssBuild(directory) {
  const resolved = path.resolve(directory);
  if ((await lstat(resolved)).isSymbolicLink()) throw new Error(`Build root may not be a symlink: ${resolved}`);
  const root = await realpath(resolved);
  const names = await listFiles(root);
  const files = new Map();
  const css = [];
  for (const fileName of names) {
    if (!/\.(?:css|html|[cm]?js)$/.test(fileName)) continue;
    const source = await readFile(path.join(root, fileName), 'utf8');
    files.set(fileName, source);
    if (fileName.endsWith('.css')) css.push(describeCss(source, fileName));
  }
  let metadata = null;
  let metadataError = null;
  try { metadata = JSON.parse(await readFile(path.join(root, '.qa-build-metadata.json'), 'utf8')); }
  catch (error) { metadataError = error.message; }
  return { root, names, files, css, metadata, metadataError };
}

const publicCss = ({ source: _source, canonical: _canonical, ...rest }) => rest;

function associationGraph(build) {
  const failures = [];
  const cssByName = new Map(build.css.map((file) => [file.fileName, file]));
  const names = new Set(build.names);
  const chunks = build.metadata?.chunks;
  if (!Array.isArray(chunks)) return { ok: false, failures: [`Missing/invalid .qa-build-metadata.json: ${build.metadataError ?? 'chunks must be an array'}`], graph: null };
  const identities = new Map();
  const seen = new Set();
  for (const chunk of chunks) {
    if (!Array.isArray(chunk.moduleIds) || !Array.isArray(chunk.imports) || !Array.isArray(chunk.dynamicImports) || !Array.isArray(chunk.css) || !names.has(chunk.fileName)) {
      failures.push(`Incomplete chunk metadata: ${chunk.fileName ?? '(unnamed)'}`);
      continue;
    }
    const origins = { facadeModuleId: chunk.facadeModuleId ?? null, moduleIds: [...chunk.moduleIds].sort() };
    const identity = sha256(stringify(origins));
    if (seen.has(identity)) failures.push(`Ambiguous chunk identity (same facade/modules): ${chunk.fileName}`);
    if (identities.has(chunk.fileName)) failures.push(`Duplicate chunk filename metadata: ${chunk.fileName}`);
    seen.add(identity);
    identities.set(chunk.fileName, { identity, origins });
  }
  for (const fileName of build.names.filter((name) => /\.[cm]?js$/.test(name))) {
    // Static public JavaScript copied without bundling is also recorded, by
    // bytes, rather than incorrectly assigned a module identity.
    if (!identities.has(fileName)) identities.set(fileName, { identity: `copied:${sha256(build.files.get(fileName))}`, origins: { copiedFile: fileName } });
  }
  function target(reference, owner) {
    try {
      const asset = typeof reference === 'string' ? resolveAsset(reference, owner, names) : reference;
      if (asset.external) return { external: asset.external };
      if (cssByName.has(asset.fileName)) return { css: cssByName.get(asset.fileName).canonicalSha256 };
      if (identities.has(asset.fileName)) return { js: identities.get(asset.fileName).identity };
      return { asset: asset.fileName };
    } catch (error) {
      failures.push(error.message);
      return { unresolved: reference };
    }
  }
  const html = [];
  for (const [fileName, source] of build.files) {
    if (!fileName.endsWith('.html')) continue;
    try {
      html.push({ fileName, references: htmlAssetReferences(source, fileName, names).map(({ tag, attributes: attrs, ...asset }) => ({ tag, attributes: attrs, target: target(asset, fileName) })) });
    } catch (error) { failures.push(error.message); }
  }
  if (!html.some((file) => file.fileName === 'index.html')) failures.push('Missing index.html');
  const graphChunks = chunks.map((chunk) => {
    const owner = identities.get(chunk.fileName);
    // This is only a literal-occurrence inventory, not execution order or an
    // assertion that a lazy route downloads every literal in the dependency map.
    const literalCssReferences = [...(build.files.get(chunk.fileName) ?? '').matchAll(/(['"`])([^'"`\r\n]*?\.css(?:[?#][^'"`\r\n]*)?)\1/g)]
      // Vite's preload helper uses endsWith('.css'). That extension token has
      // no filename and does not identify an asset. Keep real basenames,
      // including missing-real.css, subject to the normal resolution guard.
      .filter((match) => match[2] !== '.css')
      .map((match) => target(match[2], chunk.fileName));
    return {
      identity: owner?.identity ?? `invalid:${chunk.fileName}`,
      origins: owner?.origins ?? null,
      imports: (chunk.imports ?? []).map((file) => target(file, chunk.fileName)),
      dynamicImports: (chunk.dynamicImports ?? []).map((file) => target(file, chunk.fileName)),
      css: (chunk.css ?? []).map((file) => target(file, chunk.fileName)),
      literalCssReferences,
    };
  }).sort((a, b) => a.identity.localeCompare(b.identity));
  return { ok: failures.length === 0, failures, graph: { html, chunks: graphChunks } };
}

export async function compareCssBuilds(baselineDirectory, candidateDirectory) {
  const baseline = await readCssBuild(baselineDirectory);
  const candidate = await readCssBuild(candidateDirectory);
  const remaining = new Set(candidate.css);
  const comparisons = [];
  const failures = [];
  const stableName = (name) => name.replace(/-[\w-]{8}(?=\.css$)/, '-[hash]');
  for (const left of baseline.css) {
    const available = [...remaining];
    const right = available.find((file) => file.fileName === left.fileName)
      ?? available.find((file) => file.sha256 === left.sha256)
      ?? available.find((file) => file.canonicalSha256 === left.canonicalSha256)
      ?? available.find((file) => stableName(file.fileName) === stableName(left.fileName));
    if (!right) { failures.push(`No unambiguous matching candidate stylesheet: ${left.fileName}`); continue; }
    remaining.delete(right);
    const byteEquivalent = left.sha256 === right.sha256;
    const astEquivalent = left.canonicalSha256 === right.canonicalSha256;
    comparisons.push({
      baselineFile: left.fileName,
      candidateFile: right.fileName,
      byteEquivalent,
      astEquivalent,
      ok: byteEquivalent || astEquivalent,
      explanation: byteEquivalent ? 'Exact bytes.' : astEquivalent ? 'Only standalone comments/node formatting raws differ; ordered AST is identical.' : 'Ordered CSS AST differs; semantic equivalence is not established.',
      firstDifferentNodes: astEquivalent ? [] : firstDifferences(left.canonical, right.canonical),
    });
  }
  for (const file of remaining) failures.push(`Unmatched candidate stylesheet: ${file.fileName}`);
  if (!baseline.css.length || !candidate.css.length) failures.push('Both builds must contain emitted CSS');
  const baselineAssociations = associationGraph(baseline);
  const candidateAssociations = associationGraph(candidate);
  const associationEquivalent = baselineAssociations.ok && candidateAssociations.ok && stringify(baselineAssociations.graph) === stringify(candidateAssociations.graph);
  const cssEquivalent = failures.length === 0 && comparisons.every((comparison) => comparison.ok);
  return {
    schemaVersion: 1,
    ok: cssEquivalent && associationEquivalent,
    scope: 'Ordered emitted CSS AST and static HTML/chunk/literal asset associations. No assertion of complete runtime, initial-route downloads, or universal visual equivalence.',
    canonicalization: 'Ignore standalone comments, source locations and node formatting raws; retain raw selector/value/params spellings when PostCSS provides them. Preserve every selector, value, duplicate, declaration/order, important flag and nested at-rule/condition/layer/property.',
    cssEquivalent,
    byteEquivalent: cssEquivalent && comparisons.every((comparison) => comparison.byteEquivalent),
    associationEquivalent,
    failures,
    comparisons,
    associationFirstDifferences: associationEquivalent ? [] : firstDifferences(baselineAssociations.graph, candidateAssociations.graph),
    baseline: { root: baseline.root, css: baseline.css.map(publicCss), associations: baselineAssociations },
    candidate: { root: candidate.root, css: candidate.css.map(publicCss), associations: candidateAssociations },
  };
}

export function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!['--baseline', '--candidate', '--output'].includes(argv[index]) || !argv[index + 1]) throw new Error('Usage: --baseline <builddir> --candidate <builddir> --output <report.json>');
    if (result[argv[index].slice(2)]) throw new Error(`Duplicate argument: ${argv[index]}`);
    result[argv[index].slice(2)] = path.resolve(argv[index + 1]);
  }
  if (!result.baseline || !result.candidate || !result.output) throw new Error('Required arguments: --baseline, --candidate, --output');
  return result;
}

export async function writeJson(output, result) {
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  let result;
  try { result = await compareCssBuilds(arguments_.baseline, arguments_.candidate); }
  catch (error) { result = { schemaVersion: 1, ok: false, error: error.stack ?? String(error) }; }
  await writeJson(arguments_.output, result);
  process.stdout.write(`${JSON.stringify({ ok: result.ok, byteEquivalent: result.byteEquivalent, cssEquivalent: result.cssEquivalent, associationEquivalent: result.associationEquivalent, output: arguments_.output })}\n`);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
}
