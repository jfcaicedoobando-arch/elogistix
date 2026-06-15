#!/usr/bin/env node
// scripts/check-bundle-budget.mjs
// Verifica budgets de bundle por chunk usando .github/bundle-budget.json.
// Falla con código != 0 si algún chunk excede su budget gzipped.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, basename } from "node:path";

const BUDGET_FILE = process.env.BUNDLE_BUDGET_FILE ?? ".github/bundle-budget.json";
const DIST_DIR = process.env.DIST_DIR ?? "dist/assets";

let budget;
try {
  budget = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
} catch (err) {
  console.error(`::error::No se pudo leer ${BUDGET_FILE}: ${err.message}`);
  process.exit(1);
}

const defaultKb = budget.default_kb ?? 250;
const rules = (budget.chunks ?? []).map((r) => ({
  ...r,
  re: new RegExp(r.pattern),
}));

let files;
try {
  files = readdirSync(DIST_DIR).filter((f) => f.endsWith(".js"));
} catch (err) {
  console.error(`::error::No se pudo listar ${DIST_DIR}: ${err.message}`);
  process.exit(1);
}

if (files.length === 0) {
  console.error(`::error::No hay .js en ${DIST_DIR}. ¿Corriste 'vite build'?`);
  process.exit(1);
}

let failed = 0;
for (const file of files.sort()) {
  const full = join(DIST_DIR, file);
  if (!statSync(full).isFile()) continue;
  const gz = gzipSync(readFileSync(full));
  const kb = Math.ceil(gz.length / 1024);
  const rule = rules.find((r) => r.re.test(basename(file)));
  const limit = rule?.budget_kb ?? defaultKb;
  const label = rule?.label ?? "lazy";
  const ok = kb <= limit;
  const mark = ok ? "✓" : "✗";
  console.log(`${mark} [${label}] ${file} = ${kb} KB (budget ${limit} KB)`);
  if (!ok) {
    console.log(`::error file=${full}::Chunk '${file}' (${label}) ${kb} KB excede budget ${limit} KB`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`::error::${failed} chunk(s) exceden su budget. Revisa .github/bundle-budget.json o aplica lazy().`);
  process.exit(1);
}
console.log("✓ Bundle budget OK (todos los chunks dentro de presupuesto)");
