/**
 * Guardrail: los fixtures de las suites RLS deben insertar `expediente`s en un
 * formato aceptado por el CHECK `embarques_expediente_formato_valido`
 * (introducido en v13.301.49). Si un contribuidor agrega un nuevo fixture con
 * `EXP-XYZ-001` o similar, CI lo bloquea antes de romper la suite RLS del
 * workflow de GitHub Actions.
 *
 * Formatos aceptados (mismos que el CHECK de la DB):
 *   - `^EL[A-Z]{3}[0-9]+$`      p.ej. ELISO00001
 *   - `^DEMO-[0-9]{4}-[0-9]+$`  p.ej. DEMO-2026-042
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const RLS_DIR = join(process.cwd(), "supabase", "tests", "rls");
const VALID = /^(EL[A-Z]{3}[0-9]+|DEMO-[0-9]{4}-[0-9]+)$/;

/**
 * Extrae, línea por línea, cualquier literal SQL que aparezca como valor de
 * `expediente` en un INSERT o en un WHERE (`expediente IN (...)` /
 * `expediente = '...'`). No pretende ser un parser SQL completo: cubre los
 * patrones que usan las 7 suites actuales.
 */
function extractExpedientLiterals(sql: string): string[] {
  const literals = new Set<string>();

  // Caso 1: WHERE expediente [IN|=] ('EXP...', ...)
  for (const m of sql.matchAll(/expediente\s*(?:=|IN)\s*\(?\s*'([^']+)'/gi)) {
    literals.add(m[1]);
  }
  for (const m of sql.matchAll(/expediente\s*=\s*'([^']+)'/gi)) {
    literals.add(m[1]);
  }

  // Caso 2: INSERT ... embarques(... expediente ...) VALUES (...)
  // Buscamos bloques que declaran una columna `expediente` y luego capturamos
  // los tuple-literals que siguen hasta el `;`.
  const insertRe =
    /INSERT\s+INTO\s+public\.embarques\s*\(([^)]+)\)\s*VALUES([\s\S]*?);/gi;
  for (const m of sql.matchAll(insertRe)) {
    const cols = m[1].split(",").map((c) => c.trim().toLowerCase());
    const idx = cols.indexOf("expediente");
    if (idx === -1) continue;
    const body = m[2];
    // Cada tupla: (v0, v1, v2, ...)
    for (const t of body.matchAll(/\(([^)]*)\)/g)) {
      // Split top-level por comas — los valores son identificadores o literales,
      // sin paréntesis anidados en estos fixtures.
      const parts = t[1].split(",").map((p) => p.trim());
      const val = parts[idx];
      if (!val) continue;
      const strMatch = val.match(/^'([^']*)'$/);
      if (strMatch) literals.add(strMatch[1]);
      // Si es una variable PL/pgSQL (sin comillas) la ignoramos: se validará
      // en runtime por el CHECK constraint. Aquí sólo cazamos literales.
    }
  }

  return [...literals];
}

describe("RLS fixtures: formato de expediente", () => {
  const files = readdirSync(RLS_DIR).filter(
    (f) => f.startsWith("test_rls_") && f.endsWith(".sql"),
  );

  it("hay suites RLS que auditar", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} usa expedientes con formato válido`, () => {
      const sql = readFileSync(join(RLS_DIR, file), "utf8");
      const literals = extractExpedientLiterals(sql);
      const invalid = literals.filter((v) => !VALID.test(v));
      expect(
        invalid,
        `Expedientes con formato inválido en ${file}. ` +
          `Usa 'ELXXX00001' (3 letras + dígitos) o 'DEMO-YYYY-NNN'. ` +
          `Inválidos: ${JSON.stringify(invalid)}`,
      ).toEqual([]);
    });
  }
});
