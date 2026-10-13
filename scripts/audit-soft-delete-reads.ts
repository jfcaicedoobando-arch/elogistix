#!/usr/bin/env bun
/**
 * Regresión de lecturas con borrado lógico (soft delete).
 *
 * Objetivo: que un registro eliminado NUNCA reaparezca en listados,
 * contadores o buscadores de ningún módulo. Toda lectura del cliente
 * (`supabase.from("<tabla con deleted_at>").select(...)`) debe filtrar
 * `deleted_at IS NULL`, salvo excepción declarada.
 *
 * Cómo se declara una excepción legítima (p. ej. la Papelera, que
 * justamente lista lo eliminado):
 *   // SOFT-DELETE-OK: motivo corto
 * en la misma cadena de la consulta.
 *
 * Deuda histórica: `scripts/audit-soft-delete-baseline.json`. La baseline
 * sólo puede bajar, nunca subir:
 *   - lectura nueva sin filtro y sin marca  => ❌ falla (fuga)
 *   - entrada sin hallazgo vigente          => ❌ falla (revisar antes de retirar)
 *
 * Uso:
 *   bun run audit:soft-delete            # verifica
 *   bun run audit:soft-delete -- --update # reduce la baseline; rechaza claves nuevas
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { analizarContenido } from "./lib/softDeleteReads/analyzer.ts";
import type { Hallazgo } from "./lib/softDeleteReads/model.ts";
export { analizarContenido, ventanaConsulta, lecturaProtegida } from "./lib/softDeleteReads/analyzer.ts";
export type { Hallazgo } from "./lib/softDeleteReads/model.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "src");
const BASELINE_PATH = resolve(ROOT, "scripts/audit-soft-delete-baseline.json");

export function claveDe(h: Hallazgo): string { return `${h.archivo.replace(/\\/g, "/")}::${h.tabla}`; }
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === "__tests__" || entry.name === "__mocks__") return [];
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}
export function auditarLecturas(): Hallazgo[] {
  return walk(SRC).flatMap(archivo => analizarContenido(readFileSync(archivo, "utf8"), relative(ROOT, archivo)))
    .sort((a, b) => `${a.archivo}${a.tabla}`.localeCompare(`${b.archivo}${b.tabla}`) || a.linea - b.linea);
}
export function leerBaseline(path = BASELINE_PATH): string[] {
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!raw || typeof raw !== "object" || !("deuda" in raw) || !Array.isArray(raw.deuda) || raw.deuda.some(key => typeof key !== "string")) {
    throw new Error("Baseline de soft-delete inválida: se requiere deuda: string[]. No se escribió ningún cambio.");
  }
  return raw.deuda;
}
/** Es reducción de conjunto, no de tamaño: una sustitución también se rechaza. */
export function actualizarBaseline(claves: readonly string[], path = BASELINE_PATH): void {
  const anteriores = new Set(leerBaseline(path));
  const nuevas = [...new Set(claves)].filter(key => !anteriores.has(key)).sort();
  if (nuevas.length) throw new Error(`Baseline rechazada: ${nuevas.length} clave(s) nueva(s). Corrige las lecturas; no se escribió la baseline.\n${nuevas.join("\n")}`);
  writeFileSync(path, `${JSON.stringify({
    _doc: "Deuda histórica de lecturas sin filtro `deleted_at IS NULL`. Sólo puede bajar. " +
      "Regenerar con `bun run audit:soft-delete -- --update` SÓLO al corregir entradas.",
    deuda: [...new Set(claves)].sort(),
  }, null, 2)}\n`, "utf8");
}
function main(): void {
  const hallazgos = auditarLecturas(), claves = hallazgos.map(claveDe);
  if (process.argv.includes("--update")) {
    actualizarBaseline(claves);
    console.log(`✅ Baseline reducida/verificada: ${new Set(claves).size} lectura(s) en deuda.`);
    return;
  }
  const baseline = new Set(leerBaseline()), vigentes = new Set(claves);
  const fugas = hallazgos.filter(h => !baseline.has(claveDe(h)));
  const muertas = [...baseline].filter(key => !vigentes.has(key)).sort();
  for (const fuga of fugas) console.error(`❌ [${fuga.tipo}] ${fuga.archivo}:${fuga.linea} → ${fuga.tabla}: lectura sin filtro deleted_at IS NULL de su propio builder.`);
  for (const key of muertas) console.error(`❌ Baseline sin hallazgo vigente (verificar antes de retirar): ${key}`);
  if (!fugas.length && !muertas.length) console.log(`✅ audit:soft-delete — sin fugas nuevas (${baseline.size} lectura(s) en deuda histórica).`);
  process.exit(fugas.length || muertas.length ? 1 : 0);
}
if (import.meta.main) main();
