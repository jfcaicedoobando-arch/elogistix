#!/usr/bin/env bun
/**
 * Regresión de la baseline SONNER-LEGACY.
 *
 * Compara los archivos que hoy importan `sonner` directo contra la allowlist
 * declarada en `eslint.config.js` (bloque `no-raw-table-and-sonner`). Falla
 * si:
 *   - Existe un archivo importando `sonner` que NO está en la allowlist
 *     (fuga: alguien escribió un import crudo sin actualizar la baseline).
 *   - Existe una entrada en la allowlist que ya no importa `sonner` (dead
 *     entry: la migración se hizo pero la baseline no se limpió).
 *
 * El objetivo es que la baseline sólo baje, nunca suba, y quede vacía al
 * cerrar Ola B de la migración.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

function listFilesImportingSonner(): string[] {
  const out = execSync(
    `rg -l --no-messages "from ['\\"]sonner['\\"]" src`,
    { cwd: ROOT, encoding: "utf8" },
  );
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((f) => !f.includes("__tests__") && !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"))
    .map((f) => relative(ROOT, resolve(ROOT, f)))
    .sort();
}

function parseAllowlist(): string[] {
  const cfg = readFileSync(resolve(ROOT, "eslint.config.js"), "utf8");
  // Buscamos el bloque "no-raw-table-and-sonner" completo.
  const blockStart = cfg.indexOf("no-raw-table-and-sonner");
  if (blockStart < 0) throw new Error("bloque no-raw-table-and-sonner no encontrado");
  const blockEnd = cfg.indexOf("\n    },\n", blockStart);
  const block = cfg.slice(blockStart, blockEnd > 0 ? blockEnd : cfg.length);
  const paths = [...block.matchAll(/"(src\/[^"]+)"/g)].map((m) => m[1]);
  // Wrappers autorizados adicionales (siempre válidos).
  const wrappers = [
    "src/lib/ui/appFeedback.ts",
    "src/hooks/shared/useToast.ts",
    "src/hooks/shared/useCopyText.ts",
    "src/components/ui/sonner.tsx",
    "src/components/ui/ErrorDetailsDialog.tsx",
  ];
  return [...new Set([...paths, ...wrappers])].sort();
}

const actual = new Set(listFilesImportingSonner());
const allowed = new Set(parseAllowlist());

const fugas = [...actual].filter((f) => !allowed.has(f)).sort();
const deadEntries = [...allowed].filter((f) => !actual.has(f)).sort();

let failed = false;
if (fugas.length > 0) {
  console.error("❌ Archivos que importan `sonner` directo pero NO están en la baseline:");
  for (const f of fugas) console.error(`  · ${f}`);
  console.error("\n  → Migrar a `notify*` de @/lib/ui/appFeedback, o (excepción) agregar a la allowlist en eslint.config.js con comentario.");
  failed = true;
}
if (deadEntries.length > 0) {
  console.error("\n⚠️  Entradas de la baseline que ya no importan `sonner` (limpiar):");
  for (const f of deadEntries) console.error(`  · ${f}`);
  failed = true;
}
if (!failed) {
  console.log(`✅ Baseline SONNER-LEGACY consistente (${actual.size} archivos, 0 fugas, 0 dead entries).`);
}
process.exit(failed ? 1 : 0);
