/**
 * Guardrail v13.301.72: la migración de auto-revincular proformas backfilleadas
 * a facturas vivas dentro del mismo embarque DEBE aplicar la política 1:1
 * inequívoca. Sin estos filtros, el UPDATE podría sobrescribir vínculos
 * proforma↔factura ya establecidos y crear doble contabilización.
 *
 * El test lee el SQL de la migración (no consulta BD).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

const migrations = readdirSync(MIGRATIONS_DIR)
  .sort()
  .map((f) => readFileSync(resolve(MIGRATIONS_DIR, f), "utf8"));

const revincularMigration = migrations.find((m) =>
  /revincular_proformas_backfill/i.test(m),
);

describe("Fase C bis — auto-revincular proformas backfill 1:1", () => {
  it("existe una migración de auto-revincular", () => {
    expect(revincularMigration).toBeDefined();
  });

  it("filtra por cancellation_status IS NULL", () => {
    expect(revincularMigration!).toMatch(/cancellation_status\s+IS\s+NULL/i);
  });

  it("excluye estados 'Cancelada' y 'Sustituida'", () => {
    expect(revincularMigration!).toMatch(/'Cancelada'/);
    expect(revincularMigration!).toMatch(/'Sustituida'/);
  });

  it("exige count(factura viva) = 1 por embarque", () => {
    expect(revincularMigration!).toMatch(/count[\s\S]{0,80}=\s*1/i);
  });

  it("exige count(proforma backfill) = 1 por embarque", () => {
    // dos HAVING/count con = 1
    const matches = revincularMigration!.match(/=\s*1\b/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("sólo actualiza facturas.proforma_id cuando es NULL (no sobrescribe)", () => {
    expect(revincularMigration!).toMatch(
      /UPDATE\s+public\.facturas[\s\S]{0,600}proforma_id\s+IS\s+NULL/i,
    );
  });

  it("registra la operación en bitacora_actividad", () => {
    expect(revincularMigration!).toMatch(/bitacora_actividad/i);
    expect(revincularMigration!).toMatch(/revincular_proforma_backfill/);
  });
});
