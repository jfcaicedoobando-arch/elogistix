/**
 * Guardrail v13.301.77 — la hotfix del guard de REP no debe perderse.
 *
 * Verifica que la migración `20260718213500_*.sql` conserva:
 *  - `CREATE OR REPLACE FUNCTION public.assert_factura_viva_para_rep()`.
 *  - Early-exit basado sólo en uuid_rep + facturapi_rep_id (no en estado_rep).
 *  - Recreación del trigger `trg_pago_factura_rep_viva` con `WHEN` clause
 *    equivalente al early-exit para cortar antes de invocar la función.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readHotfixMigration(): string {
  const dir = path.resolve(__dirname, "../../../supabase/migrations");
  const match = fs
    .readdirSync(dir)
    .find((f) => f.startsWith("20260718213500") && f.endsWith(".sql"));
  if (!match) {
    throw new Error(
      "No se encontró la migración hotfix del guard de REP (20260718213500_*.sql)",
    );
  }
  return fs.readFileSync(path.join(dir, match), "utf8");
}

describe("Hotfix v13.301.76 — guard de REP (migración inmutable)", () => {
  const sql = readHotfixMigration();

  it("crea/reemplaza la función assert_factura_viva_para_rep", () => {
    expect(sql).toMatch(
      /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.assert_factura_viva_para_rep\s*\(\s*\)/i,
    );
  });

  it("aplica early-exit basado sólo en uuid_rep + facturapi_rep_id", () => {
    expect(sql).toMatch(
      /IF\s+NEW\.uuid_rep\s+IS\s+NULL\s+AND\s+NEW\.facturapi_rep_id\s+IS\s+NULL\s+THEN\s+RETURN\s+NEW\s*;/i,
    );
  });

  it("recrea el trigger trg_pago_factura_rep_viva con WHEN clause acorde", () => {
    expect(sql).toMatch(/DROP\s+TRIGGER\s+IF\s+EXISTS\s+trg_pago_factura_rep_viva/i);
    expect(sql).toMatch(/CREATE\s+TRIGGER\s+trg_pago_factura_rep_viva/i);
    expect(sql).toMatch(
      /WHEN\s*\(\s*NEW\.uuid_rep\s+IS\s+NOT\s+NULL\s+OR\s+NEW\.facturapi_rep_id\s+IS\s+NOT\s+NULL\s*\)/i,
    );
  });

  it("no reintroduce estado_rep dentro del early-exit de la función", () => {
    // El bug original de v13.301.75 era acoplar el early-exit a estado_rep,
    // cuyo default 'NoAplica' rompía cualquier INSERT sin uuid_rep.
    const earlyExitMatch = sql.match(
      /IF\s+NEW\.uuid_rep\s+IS\s+NULL[\s\S]*?RETURN\s+NEW\s*;/i,
    );
    expect(earlyExitMatch).not.toBeNull();
    expect(earlyExitMatch![0]).not.toMatch(/estado_rep/i);
  });
});
