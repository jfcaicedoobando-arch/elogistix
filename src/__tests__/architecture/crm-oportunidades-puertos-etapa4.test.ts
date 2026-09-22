/**
 * Etapa 4 · guardrail de la migración que agrega identidad de puerto a
 * `crm_oportunidades`: columnas nullable con FK a `puertos`, CHECK de puertos
 * distintos y SIN backfill heurístico de históricos.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "supabase/migrations";

function sqlDeLaMigracion(): string {
  const archivo = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .find((f) => readFileSync(`${DIR}/${f}`, "utf8").includes("crm_oportunidades_puertos_distintos_chk"));
  expect(archivo, "falta la migración de puertos en crm_oportunidades").toBeTruthy();
  return readFileSync(`${DIR}/${archivo}`, "utf8");
}

describe("crm_oportunidades · identidad opcional de puerto", () => {
  const sql = sqlDeLaMigracion();

  it("agrega ambas columnas nullable con FK ON DELETE SET NULL", () => {
    for (const col of ["puerto_origen_id", "puerto_destino_id"]) {
      expect(sql).toMatch(
        new RegExp(`${col} uuid NULL REFERENCES public\\.puertos\\(id\\) ON DELETE SET NULL`),
      );
    }
    expect(sql).toContain("ALTER TABLE public.crm_oportunidades");
  });

  it("exige puertos distintos permitiendo captura parcial", () => {
    expect(sql).toContain(
      "CHECK (puerto_origen_id IS NULL OR puerto_destino_id IS NULL OR puerto_origen_id <> puerto_destino_id)",
    );
  });

  it("no hace backfill de históricos", () => {
    expect(sql).not.toMatch(/UPDATE\s+public\.crm_oportunidades/i);
    expect(sql).not.toMatch(/FROM\s+public\.puertos/i);
  });
});
