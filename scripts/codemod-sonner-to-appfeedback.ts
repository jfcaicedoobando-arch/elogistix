#!/usr/bin/env bun
/**
 * Codemod Ola B — migra archivos `sonner` directo a helpers `notify*`.
 *
 * Estrategia conservadora: sólo transforma call sites en una sola línea
 *   toast.success("msg")
 *   toast.warning("msg", { description, duration, id })
 *   toast.info("msg", { ... })
 *   toast("msg", { ... })
 *
 * Casos multi-línea con `action: {...}` o closures anidados quedan intactos
 * y deben migrarse a mano. El script imprime al final los archivos que aún
 * contengan `toast(` para revisión manual.
 *
 * Uso:
 *   bun scripts/codemod-sonner-to-appfeedback.ts <ruta1> <ruta2> ...
 *   bun scripts/codemod-sonner-to-appfeedback.ts --file /tmp/lista.txt
 */
import { readFileSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

type CallKind = "success" | "warning" | "info";
const FN_MAP: Record<CallKind, string> = {
  success: "notifySuccess",
  warning: "notifyWarning",
  info: "notifyInfo",
};

/** Regex para `toast.X("...", { ...single-line-opts... })` o `toast.X("...")`. */
// El primer argumento puede ser template `...`, string "..." o expresión balanceada;
// dado que 99% son literales/templates simples, matcheamos hasta la coma o el `)`.
function transformLine(line: string): { line: string; used: Set<string> } {
  const used = new Set<string>();
  // Mapa de forma sonner → helper.
  const KINDS: Record<string, string> = {
    "toast.success": "notifySuccess",
    "toast.warning": "notifyWarning",
    "toast.info":    "notifyInfo",
    "toast.message": "notifyInfo",
    "toast":         "notifyInfo",
  };

  // Loop hasta que no queden matches para permitir múltiples toast en la misma línea.
  let iter = 0;
  while (iter++ < 10) {
    // Buscar el candidato más a la izquierda que aún sea `toast[.x](`.
    const m = line.match(/\btoast(\.(success|warning|info|message))?\(/);
    if (!m || m.index === undefined) break;
    const start = m.index;
    const key = m[0].slice(0, -1); // sin el `(`
    const fn = KINDS[key];
    if (!fn) break;
    // Extraer paréntesis balanceados desde `(`.
    const openIdx = start + m[0].length - 1;
    const closeIdx = findMatchingParen(line, openIdx);
    if (closeIdx < 0) break;
    const args = line.slice(openIdx + 1, closeIdx);
    const parsed = splitFirstArg(args);
    if (!parsed) break;
    const { first, rest } = parsed;
    let replacement: string;
    if (rest === null) {
      replacement = `${fn}(undefined, { title: ${first} })`;
    } else {
      const merged = injectTitle(rest, first);
      if (!merged) break;
      replacement = `${fn}(undefined, ${merged})`;
    }
    used.add(fn);
    line = line.slice(0, start) + replacement + line.slice(closeIdx + 1);
  }

  return { line, used };
}

/** Encuentra el índice del `)` que cierra el `(` en `openIdx`. -1 si no está. */
function findMatchingParen(s: string, openIdx: number): number {
  let depth = 0, inStr: string | null = null, tick = false, esc = false;
  for (let i = openIdx; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (inStr) {
      if (c === "\\") { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (tick) {
      if (c === "\\") { esc = true; continue; }
      if (c === "`") tick = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === "`") { tick = true; continue; }
    if (c === "(") depth++;
    else if (c === ")") { depth--; if (depth === 0) return i; }
  }
  return -1;
}


/** Divide `<first>, <rest>` respetando balance de llaves/paréntesis/backticks/comillas. */
// eslint-disable-next-line complexity -- parsing manual con balance de delimitadores; extraer helpers ocultaría el estado.
function splitFirstArg(s: string): { first: string; rest: string | null } | null {
  let depthP = 0, depthB = 0, depthC = 0, inStr: string | null = null, tick = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (inStr) {
      if (c === "\\") { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (tick) {
      if (c === "\\") { esc = true; continue; }
      if (c === "`") tick = false;
      continue;
    }
    if (c === '"' || c === "'") { inStr = c; continue; }
    if (c === "`") { tick = true; continue; }
    if (c === "(") depthP++;
    else if (c === ")") depthP--;
    else if (c === "{") depthB++;
    else if (c === "}") depthB--;
    else if (c === "[") depthC++;
    else if (c === "]") depthC--;
    if (c === "," && depthP === 0 && depthB === 0 && depthC === 0) {
      return { first: s.slice(0, i).trim(), rest: s.slice(i + 1).trim() };
    }
  }
  return { first: s.trim(), rest: null };
}

/** Inyecta `title: <first>` al inicio de un objeto literal `{ ... }`. */
function injectTitle(objectLit: string, first: string): string | null {
  const trimmed = objectLit.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return `{ title: ${first} }`;
  return `{ title: ${first}, ${inner} }`;
}

/** Reemplaza el import de sonner por notify* si NO quedan referencias a `toast.` o `toast(`. */
function rewriteImport(src: string, used: Set<string>): string {
  const remainingToast = /\btoast(\.\w+)?\s*\(/.test(stripImports(src));
  if (remainingToast) {
    // Aún hay usos crudos, no tocamos import.
    return src;
  }
  // Elimina el import `import { toast } from "sonner";` (con o sin otras cosas).
  const importRe = /^import\s*\{([^}]+)\}\s*from\s*["']sonner["'];?\s*$/m;
  const match = src.match(importRe);
  if (!match) return src;
  const names = match[1].split(",").map((s) => s.trim()).filter((s) => s && s !== "toast");
  const notifyImports = [...used].sort().join(", ");
  const notifyLine = `import { ${notifyImports} } from "@/lib/ui/appFeedback";`;
  let replacement = notifyLine;
  if (names.length > 0) {
    replacement += `\nimport { ${names.join(", ")} } from "sonner";`;
  }
  return src.replace(importRe, replacement);
}

function stripImports(src: string): string {
  return src.replace(/^import[\s\S]*?from\s*["'][^"']+["'];?\s*$/gm, "");
}

function processFile(path: string): { changed: boolean; leftover: boolean } {
  const abs = resolve(ROOT, path);
  const src = readFileSync(abs, "utf8");
  const lines = src.split("\n");
  const used = new Set<string>();
  let changed = false;
  const outLines = lines.map((line) => {
    const { line: newLine, used: u } = transformLine(line);
    if (newLine !== line) changed = true;
    u.forEach((x) => used.add(x));
    return newLine;
  });
  if (!changed) return { changed: false, leftover: /\btoast(\.\w+)?\s*\(/.test(stripImports(src)) };
  let out = outLines.join("\n");
  out = rewriteImport(out, used);
  writeFileSync(abs, out);
  const leftover = /\btoast(\.\w+)?\s*\(/.test(stripImports(out));
  return { changed: true, leftover };
}

// ─────────── main ───────────
const args = process.argv.slice(2);
let files: string[] = [];
const idx = args.indexOf("--file");
if (idx >= 0) {
  const list = readFileSync(args[idx + 1], "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
  files = list;
} else {
  files = args;
}
if (files.length === 0) {
  console.error("uso: codemod-sonner-to-appfeedback.ts <archivos...> | --file <lista>");
  process.exit(1);
}

let ok = 0, skipped = 0;
const leftover: string[] = [];
for (const f of files) {
  try {
    const r = processFile(f);
    if (r.changed) ok++;
    else skipped++;
    if (r.leftover) leftover.push(f);
  } catch (e) {
    console.error(`error en ${f}:`, e);
  }
}
console.log(`✓ transformados: ${ok}`);
console.log(`· sin cambios:   ${skipped}`);
if (leftover.length > 0) {
  console.log("\n⚠️  archivos con toast( residual (revisión manual):");
  for (const f of leftover) console.log(`  · ${relative(ROOT, resolve(ROOT, f))}`);
}
