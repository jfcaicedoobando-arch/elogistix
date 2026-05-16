#!/usr/bin/env node
/**
 * CLI: agrega una nueva entrada al changelog actualizando atómicamente
 * - src/content/changelog/v8/chunks/0.ts (fuente de verdad para v8)
 * - src/content/changelogData.ts (recentChangelog, rotado a top 5)
 * - src/constants/appVersion.ts (APP_VERSION)
 *
 * Uso:
 *   npm run changelog:add -- \
 *     --version 8.106.0 \
 *     --type minor \
 *     --title "Mi feature" \
 *     --description "Descripción larga..." \
 *     [--summary "1 línea user-facing"]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Args = Record<string, string>;
function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = val;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const required = ["version", "type", "title", "description"] as const;
for (const k of required) {
  if (!args[k]) {
    console.error(`Falta --${k}`);
    process.exit(1);
  }
}

const version = args.version;
const type = args.type as "major" | "minor" | "patch";
const title = args.title;
const description = args.description;
const summary = args.summary;
const date = args.date ?? new Date().toISOString().slice(0, 10);

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Versión inválida (semver requerido): ${version}`);
  process.exit(1);
}
if (!["major", "minor", "patch"].includes(type)) {
  console.error(`Type debe ser major|minor|patch, recibido: ${type}`);
  process.exit(1);
}

const ROOT = resolve(process.cwd());
const CHUNK0 = resolve(ROOT, "src/content/changelog/v8/chunks/0.ts");
const DATA = resolve(ROOT, "src/content/changelogData.ts");
const APP_VER = resolve(ROOT, "src/constants/appVersion.ts");

function escapeStr(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

const entryBlock = `  {
    version: "${version}",
    date: "${date}",
    type: "${type}",
    title: "${escapeStr(title)}",
${summary ? `    summary: "${escapeStr(summary)}",\n` : ""}    description: "${escapeStr(description)}",
  },
`;

// 1) Prepend a chunk0
{
  const src = readFileSync(CHUNK0, "utf8");
  const marker = "export const chunk0: ChangelogEntry[] = [\n";
  const idx = src.indexOf(marker);
  if (idx < 0) throw new Error("No se encontró export const chunk0");
  if (src.includes(`version: "${version}"`)) {
    console.error(`v${version} ya existe en chunk0`);
    process.exit(1);
  }
  const next = src.slice(0, idx + marker.length) + entryBlock + src.slice(idx + marker.length);
  writeFileSync(CHUNK0, next);
}

// 2) Prepend a recentChangelog y rotar a top 5
{
  const src = readFileSync(DATA, "utf8");
  const marker = "export const recentChangelog: ChangelogEntry[] = [\n";
  const idx = src.indexOf(marker);
  if (idx < 0) throw new Error("No se encontró recentChangelog");
  const closeIdx = src.indexOf("\n];", idx);
  const head = src.slice(0, idx + marker.length);
  const body = src.slice(idx + marker.length, closeIdx);
  const tail = src.slice(closeIdx);
  // Parsear bloques: cada entrada empieza con "  {" y termina con "  },"
  const blocks: string[] = [];
  const blockRe = / {2}\{\n[\s\S]*?\n {2}\},\n/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(body)) !== null) blocks.push(m[0]);
  const newBlocks = [entryBlock, ...blocks].slice(0, 5);
  writeFileSync(DATA, head + newBlocks.join("") + tail);
}

// 3) Bump APP_VERSION
{
  const src = readFileSync(APP_VER, "utf8");
  const next = src.replace(/export const APP_VERSION = "[^"]+";/, `export const APP_VERSION = "${version}";`);
  writeFileSync(APP_VER, next);
}

console.log(`✅ Changelog actualizado a v${version} (${type}) — ${title}`);
