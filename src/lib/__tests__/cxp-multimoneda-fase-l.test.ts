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
    const sql = readLatestContaining("monto_en_moneda_factura");
    expect(sql).toMatch(
      /ALTER TABLE public\.pagos_proveedor[\s\S]*ADD COLUMN IF NOT EXISTS monto_en_moneda_factura/i,
    );
  });

  it("existe la función de conversión con guard MXN↔USD y rechazo de EUR cruzado", () => {
    const sql = readLatestContaining("convertir_monto_pago_a_factura");
    expect(sql).toMatch(/LC_PAGO_TC_REQUERIDO/);
    expect(sql).toMatch(/LC_PAGO_CRUCE_NO_SOPORTADO/);
    // GRANT restringido
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.convertir_monto_pago_a_factura[\s\S]*TO authenticated, service_role/,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.convertir_monto_pago_a_factura[\s\S]*FROM PUBLIC/,
    );
  });

  it("registra trigger BEFORE INSERT/UPDATE que puebla la columna", () => {
    const sql = readLatestContaining("trg_pagos_proveedor_monto_convertido");
    expect(sql).toMatch(
      /CREATE TRIGGER trg_pagos_proveedor_monto_convertido[\s\S]*BEFORE INSERT OR UPDATE/,
    );
    expect(sql).toMatch(/EXECUTE FUNCTION public\.tg_pagos_proveedor_monto_convertido/);
  });

  it("v_proveedor_facturas_saldo suma monto_en_moneda_factura (no `pp.monto`) y no clampa a 0", () => {
    const sql = readLatestContaining("v_proveedor_facturas_saldo");
    // Extraer la última definición
    const idx = sql.lastIndexOf("v_proveedor_facturas_saldo");
    const chunk = sql.slice(idx, idx + 2000);
    expect(chunk).toMatch(/SUM\(pp\.monto_en_moneda_factura\)/);
    // No debe quedar `SUM(pp.monto)` (moneda cruda)
    expect(chunk).not.toMatch(/SUM\(pp\.monto\)/);
    // Sin GREATEST(...,0) clamp
    expect(chunk).not.toMatch(/GREATEST\([^,]+,\s*0\)/);
  });

  it("check_no_sobrepago_proveedor compara en moneda de la factura", () => {
    const sql = readLatestContaining("check_no_sobrepago_proveedor");
    const idx = sql.lastIndexOf("FUNCTION public.check_no_sobrepago_proveedor");
    const chunk = sql.slice(idx, idx + 3000);
    expect(chunk).toMatch(/SUM\(monto_en_moneda_factura\)/);
    expect(chunk).toMatch(/NEW\.monto_en_moneda_factura/);
  });

  it("CHECK constraint exige la columna en pagos vivos", () => {
    const sql = readLatestContaining("pagos_proveedor_monto_convertido_no_null");
    expect(sql).toMatch(
      /CHECK \(deleted_at IS NOT NULL OR monto_en_moneda_factura IS NOT NULL\)/,
    );
    expect(sql).toMatch(/VALIDATE CONSTRAINT pagos_proveedor_monto_convertido_no_null/);
  });
});
