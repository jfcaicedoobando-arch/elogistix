/**
 * Guardrail Fase L (v13.301.83) — Multi-moneda en CxP (Bug 19).
 *
 * Blinda que la última migración de `v_proveedor_facturas_saldo` y del trigger
 * `check_no_sobrepago_proveedor` usen la nueva columna
 * `pagos_proveedor.monto_en_moneda_factura` (no `pagos_proveedor.monto`)
 * y que el trigger BEFORE que la puebla exista.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIG_DIR = path.resolve(__dirname, "../../../supabase/migrations");

function readLatestContaining(marker: string): string {
  const files = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const f of files) {
    const body = fs.readFileSync(path.join(MIG_DIR, f), "utf8");
    if (body.includes(marker)) return body;
  }
  throw new Error(`No se encontró migración con marker: ${marker}`);
}

describe("Fase L — Multi-moneda CxP", () => {
  it("agrega la columna monto_en_moneda_factura a pagos_proveedor", () => {
    // v13.303.10: marker más específico. Otras migraciones posteriores (p.ej.
    // `validar_cierre_embarque` en v13.303.8) referencian la columna en SELECTs
    // sin definir el ALTER TABLE, lo que hacía que `readLatestContaining` con
    // marker genérico resolviera al archivo equivocado.
    const sql = readLatestContaining("ADD COLUMN IF NOT EXISTS monto_en_moneda_factura");
    expect(sql).toMatch(
      /ALTER TABLE public\.pagos_proveedor[\s\S]*ADD COLUMN IF NOT EXISTS monto_en_moneda_factura/i,
    );
  });

  it("la conversión canónica exige T/C del pago y pivotea cruces en MXN", () => {
    // v13.821.1 — Antes se leía "la última migración que redefine la función" y
    // se exigía `LC_PAGO_CRUCE_NO_SOPORTADO`, error que dejó de existir cuando
    // M-2 (Ola 4 · v14) habilitó los cruces con EUR pivoteando en MXN. La fuente
    // de verdad del estado vigente es `supabase/schema/baseline.sql`.
    const cuerpo = leerFuncionCanonica("convertir_monto_pago_a_factura");
    expect(cuerpo).toMatch(/LC_PAGO_TC_REQUERIDO/);
    // Cruce que pivotea en MXN: si la factura no es MXN necesita su propio T/C.
    expect(cuerpo).toMatch(/LC_PAGO_TC_FACTURA_REQUERIDO/);
    // Ya no existe el rechazo de cruces: se convierte vía MXN.
    expect(cuerpo).not.toMatch(/LC_PAGO_CRUCE_NO_SOPORTADO/);
    expect(cuerpo).toMatch(/IMMUTABLE/);

    // Privilegios vigentes (los emite pg_dump al final del baseline).
    expect(BASELINE).toMatch(
      /REVOKE ALL ON FUNCTION public\.convertir_monto_pago_a_factura\([^)]*\) FROM PUBLIC;/,
    );
    for (const rol of ["authenticated", "service_role"]) {
      expect(BASELINE).toMatch(
        new RegExp(
          `GRANT ALL ON FUNCTION public\\.convertir_monto_pago_a_factura\\([^)]*\\) TO ${rol};`,
        ),
      );
    }
  });


  it("registra trigger BEFORE INSERT/UPDATE que puebla la columna", () => {
    // v13.309.35+ (FIX-R2-01): el trigger de conversión se consolidó con el guard
    // de sobrepago en `trg_pagos_proveedor_guard` / `guard_pago_proveedor`.
    const sql = readLatestContaining("trg_pagos_proveedor_guard");
    expect(sql).toMatch(
      /CREATE TRIGGER trg_pagos_proveedor_guard[\s\S]*BEFORE INSERT OR UPDATE/,
    );
    expect(sql).toMatch(/EXECUTE FUNCTION public\.guard_pago_proveedor/);
  });

  it("v_proveedor_facturas_saldo suma monto_en_moneda_factura (no `pp.monto`) y no clampa a 0", () => {
    const sql = readLatestContaining("CREATE OR REPLACE VIEW public.v_proveedor_facturas_saldo");
    const idx = sql.lastIndexOf("CREATE OR REPLACE VIEW public.v_proveedor_facturas_saldo");
    expect(idx, "no se encontró CREATE OR REPLACE VIEW").toBeGreaterThan(-1);
    const chunk = sql.slice(idx, idx + 3000);
    expect(chunk).toMatch(/SUM\(pp\.monto_en_moneda_factura\)/);
    expect(chunk).not.toMatch(/SUM\(pp\.monto\)(?!_)/);
    expect(chunk).not.toMatch(/GREATEST\([^,]+,\s*0\)/);
  });

  it("guard_pago_proveedor valida sobrepago en moneda de la factura", () => {
    // v13.309.35 (FIX-R2-01): el guard viejo `check_no_sobrepago_proveedor` /
    // `tg_pago_proveedor_no_sobrepago` era código muerto en INSERT (corría antes
    // que la conversión). Ahora la validación vive dentro de `guard_pago_proveedor`.
    const sql = readLatestContaining("CREATE OR REPLACE FUNCTION public.guard_pago_proveedor");
    const idx = sql.lastIndexOf("CREATE OR REPLACE FUNCTION public.guard_pago_proveedor");
    expect(idx).toBeGreaterThan(-1);
    const chunk = sql.slice(idx, idx + 4000);
    expect(chunk).toMatch(/SUM\(monto_en_moneda_factura\)/);
    expect(chunk).toMatch(/NEW\.monto_en_moneda_factura/);
    expect(chunk).toMatch(/LC_PAGO_EXCEDE_SALDO/);
    expect(chunk).toMatch(/FOR UPDATE/);
  });


  it("CHECK constraint exige la columna en pagos vivos", () => {
    const sql = readLatestContaining("pagos_proveedor_monto_convertido_no_null");
    expect(sql).toMatch(
      /CHECK \(deleted_at IS NOT NULL OR monto_en_moneda_factura IS NOT NULL\)/,
    );
    expect(sql).toMatch(/VALIDATE CONSTRAINT pagos_proveedor_monto_convertido_no_null/);
  });
});
