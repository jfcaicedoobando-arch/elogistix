#!/usr/bin/env node
// Each CSS response is compressed separately; totals sum the emitted resources.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const metrics = ['raw', 'gzip', 'brotli'];
const budgetUrl = new URL('./css-size-budget.json', import.meta.url);

/** Measure all emitted CSS resources in a directory, in stable path order. */
export function measureCss(distDir) {
  const root = resolve(distDir);
  if (!statSync(root).isDirectory()) {
    throw new Error(`CSS directory is not a directory: ${root}`);
  }

  const paths = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile() && entry.name.endsWith('.css')) paths.push(path);
    }
  }
  visit(root);
  paths.sort();
  if (paths.length === 0) throw new Error(`No CSS files found in ${root}`);

  const files = paths.map((path) => {
    const bytes = readFileSync(path);
    return {
      file: relative(root, path).split(sep).join('/'),
      sha256: createHash('sha256').update(bytes).digest('hex'),
      raw: bytes.byteLength,
      gzip: gzipSync(bytes, { level: 9 }).byteLength,
      brotli: brotliCompressSync(bytes, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
          [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
          [constants.BROTLI_PARAM_SIZE_HINT]: bytes.byteLength,
        },
      }).byteLength,
    };
  });
  const total = { raw: 0, gzip: 0, brotli: 0 };
  for (const file of files) {
    for (const metric of metrics) total[metric] += file[metric];
  }
  return { files, total };
}

/** Equality passes; any byte above an explicit limit fails. */
export function checkCssBudget(report, budgets) {
  return metrics
    .filter((metric) => report.total[metric] > budgets[metric])
    .map((metric) => `CSS ${metric}: ${report.total[metric]} bytes exceeds limit ${budgets[metric]} bytes`);
}

/** Read the checked-in budget relative to this script, independent of cwd. */
export function readCssBudget() {
  const budgets = JSON.parse(readFileSync(budgetUrl, 'utf8'));
  for (const metric of metrics) {
    if (!Number.isSafeInteger(budgets?.[metric]) || budgets[metric] <= 0) {
      throw new Error(`CSS budget ${metric} must be a positive safe integer in bytes`);
    }
  }
  return { raw: budgets.raw, gzip: budgets.gzip, brotli: budgets.brotli };
}

function runCli() {
  try {
    const args = process.argv.slice(2);
    const json = args.includes('--json');
    const positional = args.filter((arg) => arg !== '--json');
    if (positional.length > 1 || positional.some((arg) => arg.startsWith('--'))) {
      throw new Error('Usage: node scripts/check-css-size.mjs [distDir] [--json]');
    }
    const report = measureCss(positional[0] || process.env.DIST_DIR || 'dist/assets');
    const budgets = readCssBudget();
    if (json) console.log(JSON.stringify(report, null, 2));
    else {
      for (const file of report.files) {
        console.log(`${file.file}: raw=${file.raw} gzip=${file.gzip} brotli=${file.brotli} bytes`);
      }
      for (const metric of metrics) {
        console.log(`CSS total ${metric}: ${report.total[metric]} bytes (limit ${budgets[metric]} bytes)`);
      }
    }
    const failures = checkCssBudget(report, budgets);
    for (const failure of failures) console.error(`::error::${failure}`);
    if (failures.length > 0) process.exitCode = 1;
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

// fileURLToPath handles Windows drive letters and escaped path characters.
function isDirectRun() {
  if (!process.argv[1]) return false;
  const script = realpathSync(fileURLToPath(import.meta.url));
  const invoked = realpathSync(resolve(process.argv[1]));
  return process.platform === 'win32'
    ? script.toLowerCase() === invoked.toLowerCase()
    : script === invoked;
}

if (isDirectRun()) runCli();
