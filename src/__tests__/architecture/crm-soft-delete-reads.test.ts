/**
 * Guardrail (BL-01): toda LECTURA de las tablas con borrado lógico del CRM
 * (`crm_oportunidades`, `crm_leads`, `crm_actividades`,
 * `crm_comentarios_oportunidad`, `crm_plantillas_mensaje`) desde el frontend
 * debe excluir los registros borrados con `.is("deleted_at", null)`.
 *
 * Bug que motiva el test: leads/oportunidades/actividades "eliminados" (papelera)
 * reaparecían en pipeline, KPIs, forecast, leaderboard y búsqueda global porque
 * las lecturas principales no filtraban por borrado lógico. Misma clase de bug
 * que el de `fetchCobranza` corregido en v13.520.0 (ver
 * `facturas-soft-delete-reads.test.ts`).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..", "..");
const SRC = path.join(ROOT, "src");

const TABLAS = [
  "crm_oportunidades",
  "crm_leads",
  "crm_actividades",
  "crm_comentarios_oportunidad",
  "crm_plantillas_mensaje",
] as const;

/**
 * Lecturas por id/relación donde ver el registro borrado es intencional:
 * lookups internos de un flujo de escritura ya autorizado (automatizaciones
 * al mover etapa, propagación de conversión de prospecto, lineage histórico),
 * análogo a los EXENTOS de `facturas-soft-delete-reads.test.ts`.
 */
const EXENTOS = new Set<string>([
  "src/features/crm/services/vincularCotizacion/propagarConversion.ts",
  "src/features/crm/services/automatizacionesEtapa.ts",
  "src/features/crm/services/lineage.ts",
  "src/features/crm/services/prospectoSearch.ts",
]);

/**
 * RBD-06: la exención de "detalle por id" es por BLOQUE, no por archivo —
 * análogo a `detail.ts` en facturas: abrir un registro borrado por deep-link
 * (`.eq("id", …).maybeSingle()`) es intencional. Así `oportunidades.ts` y
 * `leads/queries.ts` (los archivos del bug original BL-01) vuelven a quedar
 * cubiertos por el guardrail en sus lecturas de LISTA.
 */
const ES_DETALLE_POR_ID = /\.eq\(\s*"id"\s*,[^)]*\)\s*\.maybeSingle\(\)/;

function listarArchivos(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      listarArchivos(full, acc);
    } else if (/\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Devuelve los bloques de query que arrancan en `.from("<tabla>")`. */
function bloquesDeLectura(fuente: string, tabla: string): string[] {
  // Quita comentarios de línea: un ";" dentro de un comentario cortaría el bloque.
  const src = fuente.replace(/\/\/[^\n]*/g, "");
  const bloques: string[] = [];
  const regex = new RegExp(`\\.from\\(\\s*"${tabla}"\\s*\\)`, "g");
  let m: RegExpExecArray | null;
  while ((m = regex.exec(src)) !== null) {
    const resto = src.slice(m.index);
    const fin = resto.indexOf(";");
    const bloque = fin === -1 ? resto : resto.slice(0, fin);
    if (/\.(update|insert|upsert|delete)\(/.test(bloque)) continue; // escritura
    bloques.push(bloque);
  }
  return bloques;
}

describe("lecturas de tablas CRM excluyen borradas lógicamente", () => {
  const archivos = listarArchivos(SRC)
    .filter((f) => !f.includes("integrations/supabase/types"))
    .map((f) => path.relative(ROOT, f));

  it.each(TABLAS)("no hay lecturas de %s sin filtro de deleted_at", (tabla) => {
    const infractores: string[] = [];
    for (const rel of archivos) {
      if (EXENTOS.has(rel)) continue;
      const src = readFileSync(path.join(ROOT, rel), "utf-8");
      for (const bloque of bloquesDeLectura(src, tabla)) {
        if (ES_DETALLE_POR_ID.test(bloque)) continue; // detalle por id (RBD-06)
        if (!/\.is\(\s*"deleted_at"\s*,\s*null\s*\)/.test(bloque)) {
          infractores.push(rel);
          break;
        }
      }
    }
    expect(
      infractores,
      `Agrega .is("deleted_at", null) o registra el archivo en EXENTOS: ${infractores.join(", ")}`,
    ).toEqual([]);
  });

  // RBD-06: ancla explícita — las listas donde vivía BL-01 nunca más sin filtro.
  it.each([
    ["src/features/crm/services/oportunidades.ts", "crm_oportunidades"],
    ["src/features/crm/services/leads/queries.ts", "crm_leads"],
  ] as const)("la lista principal de %s conserva el filtro de borrado", (rel, tabla) => {
    const src = readFileSync(path.join(ROOT, rel), "utf-8");
    const listas = bloquesDeLectura(src, tabla).filter((b) => b.includes('count: "exact"'));
    expect(listas.length, `${rel} debería tener una lectura de lista paginada`).toBeGreaterThan(0);
    for (const bloque of listas) {
      expect(bloque).toMatch(/\.is\(\s*"deleted_at"\s*,\s*null\s*\)/);
    }
  });
});
