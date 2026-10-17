#!/usr/bin/env node
// Static checks for generated, trusted Vite output. Does not execute the app.
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const textExtensions = new Set(['.html', '.js', '.mjs', '.cjs', '.css']);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const portablePath = (value) => value.split(path.sep).join('/');

async function listFiles(directory, root = directory) {
  const result = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink is not allowed in output: ${absolute}`);
    if (entry.isDirectory()) result.push(...await listFiles(absolute, root));
    else if (entry.isFile()) result.push(portablePath(path.relative(root, absolute)));
    else throw new Error(`Unsupported output entry: ${absolute}`);
  }
  return result;
}

function attributes(tag) {
  const result = {};
  const expression = /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of tag.matchAll(expression)) result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return result;
}

function localReference(reference, htmlFile) {
  // These checks address Vite's emitted HTML, not arbitrary HTML parsing.
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) return null;
  const url = new URL(reference, `https://build.invalid/${htmlFile}`);
  const decoded = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  if (decoded.includes('\\') || decoded.split('/').includes('..')) throw new Error(`Invalid local reference: ${reference}`);
  return decoded;
}

function cssInventory(files) {
  return files
    .filter((file) => file.name.endsWith('.css'))
    .map(({ name, bytes, digest }) => ({ name, bytes, sha256: digest }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function inspectBuild(directory) {
  const resolved = path.resolve(directory);
  if ((await lstat(resolved)).isSymbolicLink()) throw new Error(`Build root may not be a symlink: ${resolved}`);
  const root = await realpath(resolved);
  const names = await listFiles(root);
  const known = new Set(names);
  const failures = [];
  const files = [];
  const htmlChecks = [];
  for (const name of names) {
    const content = await readFile(path.join(root, name));
    files.push({ name, bytes: content.length, digest: sha256(content) });
    if (name.toLowerCase().endsWith('.map')) failures.push(`Sourcemap file: ${name}`);
    if (!textExtensions.has(path.extname(name).toLowerCase())) continue;
    const source = content.toString('utf8');
    // Intentionally conservative. A marker embedded in a string is also flagged
    // for review; this is not a JavaScript/CSS lexer or a full application test.
    if (/sourceMappingURL\s*=/.test(source)) failures.push(`sourceMappingURL marker: ${name}`);
    if (!name.endsWith('.html')) continue;
    const references = [];
    let moduleScripts = 0;
    for (const match of source.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
      const tag = match[0];
      const attrs = attributes(tag);
      const script = /^<script\b/i.test(tag);
      const stylesheet = !script && /(?:^|\s)stylesheet(?:\s|$)/i.test(attrs.rel ?? '');
      const preload = !script && /(?:^|\s)modulepreload(?:\s|$)/i.test(attrs.rel ?? '');
      if (!script && !stylesheet && !preload) continue;
      const reference = script ? attrs.src : attrs.href;
      if (!reference) continue;
      let local;
      try { local = localReference(reference, name); }
      catch (error) { failures.push(`${name}: ${error.message}`); continue; }
      references.push({ url: reference, local, kind: script ? 'script' : stylesheet ? 'stylesheet' : 'modulepreload' });
      if (local !== null && !known.has(local)) failures.push(`${name}: missing ${reference} (${local})`);
      if (script && attrs.type?.toLowerCase() === 'module' && local !== null && /\.m?js$/i.test(local) && known.has(local)) moduleScripts += 1;
    }
    htmlChecks.push({ name, moduleScripts, references });
    if (name === 'index.html') {
      if (![...source.matchAll(/<div\b[^>]*>/gi)].some((match) => attributes(match[0]).id === 'root')) failures.push('index.html: missing div#root');
      if (moduleScripts === 0) failures.push('index.html: missing local emitted module JS script');
    }
  }
  if (!known.has('index.html')) failures.push('Missing index.html');
  if (!names.some((name) => /\.m?js$/i.test(name))) failures.push('No emitted JavaScript');
  if (!names.some((name) => name.endsWith('.css'))) failures.push('No emitted CSS');
  return {
    root,
    ok: failures.length === 0,
    failures,
    fileCount: files.length,
    jsCount: names.filter((name) => /\.m?js$/i.test(name)).length,
    css: cssInventory(files),
    html: htmlChecks,
    files,
  };
}

export async function compareBuildOutputs(baselineDirectory, candidateDirectory = null) {
  const baseline = await inspectBuild(baselineDirectory);
  const candidate = candidateDirectory ? await inspectBuild(candidateDirectory) : null;
  // Content multiset, not filenames: JS hashes may change CSS asset names.
  // Duplicates count, so an added/removed duplicate stylesheet still fails.
  const cssKey = (build) => build.css.map((file) => `${file.sha256}:${file.bytes}`).sort();
  const cssEquivalent = candidate ? JSON.stringify(cssKey(baseline)) === JSON.stringify(cssKey(candidate)) : null;
  return {
    schemaVersion: 1,
    ok: baseline.ok && (!candidate || (candidate.ok && cssEquivalent)),
    scope: 'Static generated-output checks; does not execute or certify the application.',
    cssEquivalent,
    failures: cssEquivalent === false ? ['CSS content multiset differs (exact bytes, including duplicates).'] : [],
    baseline,
    candidate,
  };
}

async function main() {
  const arguments_ = process.argv.slice(2);
  let output;
  const directories = [];
  for (let index = 0; index < arguments_.length; index += 1) {
    if (arguments_[index] === '--output' && arguments_[index + 1]) output = arguments_[++index];
    else if (arguments_[index].startsWith('--')) throw new Error(`Unknown or incomplete argument: ${arguments_[index]}`);
    else directories.push(arguments_[index]);
  }
  if (directories.length < 1 || directories.length > 2) throw new Error('Usage: node check-output.mjs <build-dir> [comparison-build-dir] [--output report.json]');
  const result = await compareBuildOutputs(...directories);
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (output) {
    await mkdir(path.dirname(path.resolve(output)), { recursive: true });
    await writeFile(output, json);
  }
  process.stdout.write(json);
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${error.stack ?? error}\n`); process.exitCode = 1; });
}
