import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const slash = value => value.split(path.sep).join('/');
export const relative = target => slash(path.relative(repo, target));
export const order = [['postcss', 'vite'], ['vite', 'postcss'], ['vite', 'postcss'], ['postcss', 'vite']];
export const warmups = 2;
export const measured = 5;
export const redactText = value => String(value).replace(/([?&](?:token|access_token|key|apikey)=)[^&\s"'<>()[\]]+/gi, '$1[redacted]');
export const evidence = value => {
  if (typeof value === 'string') return redactText(value);
  if (Array.isArray(value)) return value.map(evidence);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, evidence(nested)]));
  return value;
};

export function contained(root, target) {
  const part = path.relative(root, target);
  return part !== '' && !path.isAbsolute(part) && part !== '..' && !part.startsWith(`..${path.sep}`);
}

export function targetFor(step) {
  assert(Number.isInteger(step) && step >= 0 && step <= warmups + measured);
  return { step, width: 120 + step * 7, height: 32, color: `rgb(${20 + step}, ${40 + step}, ${60 + step})` };
}

export function probeCss(probePath, target) {
  let imported = slash(path.relative(path.dirname(probePath), path.join(repo, 'src/index.css')));
  if (!imported.startsWith('.')) imported = `./${imported}`;
  return `@import ${JSON.stringify(imported)};\n/* Only this synthetic rule is edited. No utility class is introduced. */\n#hmr-probe { --hmr-step: ${target.step}; display: block; box-sizing: border-box; width: ${target.width}px; height: ${target.height}px; min-width: 0; max-width: none; color: ${target.color}; margin: 0; padding: 0; border: 0; transition: none; animation: none; }\n`;
}

export function fixtureHtml() {
  return '<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>Isolated CSS HMR probe</title><link rel="stylesheet" href="./probe.css"></head><body><div id="hmr-probe">HMR probe</div><script type="module" src="./probe.mjs"></script></body></html>\n';
}

export async function sourceSnapshot() {
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      assert(!entry.isSymbolicLink(), `Source symlink requires explicit review: ${relative(target)}`);
      if (entry.isDirectory()) await walk(target);
      else if (entry.isFile()) files.push(target);
    }
  }
  await walk(path.join(repo, 'src'));
  const configNames = ['vite.config.ts', 'postcss.config.js', 'tailwind.config.ts', 'package.json', 'bun.lock'];
  for (const name of configNames) files.push(path.join(repo, name));
  const manifest = [];
  let bytes = 0;
  for (const target of files.sort()) {
    const content = await readFile(target);
    bytes += content.length;
    manifest.push({ path: relative(target), bytes: content.length, sha256: sha256(content) });
  }
  const core = new Set([...configNames, 'src/index.css', 'src/styles.css', 'src/tailwind-compat.css']);
  return { sha256: sha256(JSON.stringify(manifest)), fileCount: manifest.length, bytes, core: manifest.filter(file => core.has(file.path)) };
}

export function statistics(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = fraction => {
    const index = (sorted.length - 1) * fraction;
    return sorted[Math.floor(index)] + (sorted[Math.ceil(index)] - sorted[Math.floor(index)]) * (index % 1);
  };
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const standardDeviation = values.length > 1 ? Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / (values.length - 1)) : null;
  return { count: values.length, min: sorted[0], max: sorted.at(-1), mean, median: quantile(0.5), q1: quantile(0.25), q3: quantile(0.75), iqr: quantile(0.75) - quantile(0.25), sampleStandardDeviation: standardDeviation, coefficientOfVariationPercent: standardDeviation === null || mean === 0 ? null : standardDeviation / mean * 100 };
}

export async function installedVersions() {
  const names = ['vite', 'tailwindcss', '@tailwindcss/postcss', '@tailwindcss/vite', 'postcss', '@playwright/test'];
  return Object.fromEntries(await Promise.all(names.map(async name => [name, JSON.parse(await readFile(path.join(repo, 'node_modules', name, 'package.json'), 'utf8')).version])));
}
