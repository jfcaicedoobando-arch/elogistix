/**
 * MNY P1.3 — la tolerancia de conciliación debe ser la MISMA en sugerencias,
 * vinculación y disparador de base: 1.00 en MXN, 0.05 en USD/EUR y coincidencia
 * exacta cuando la moneda no se reconoce (fail-closed).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { toleranciaMonto } from "../../domain/tolerancia";

const leer = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const trigger = leer("supabase/schema/tesoreria/assert_movimiento_pago_consistente.sql");
const helper = leer("supabase/schema/tesoreria/tolerancia_conciliacion_moneda.sql");

describe("tolerancia por moneda · frontend y base alineados", () => {
  it("el frontend usa 1 en MXN, 0.05 en USD/EUR y 0 si no se reconoce", () => {
    expect(toleranciaMonto("MXN")).toBe(1);
    expect(toleranciaMonto("USD")).toBe(0.05);
    expect(toleranciaMonto("EUR")).toBe(0.05);
    expect(toleranciaMonto("JPY")).toBe(0);
  });

  it("la función de base declara los mismos importes y falla cerrado", () => {
    expect(helper).toMatch(/WHEN 'MXN' THEN 1\.00/);
    expect(helper).toMatch(/WHEN 'USD' THEN 0\.05/);
    expect(helper).toMatch(/WHEN 'EUR' THEN 0\.05/);
    expect(helper).toMatch(/ELSE 0/);
  });

  it("el disparador ya no usa una tolerancia fija en pesos", () => {
    expect(trigger).not.toContain("c_tol constant numeric := 1.00");
    expect(trigger).toContain("public.tolerancia_conciliacion_moneda(");
  });

  it("el disparador conserva los candados de sentido y divisa", () => {
    expect(trigger).toContain("LC_MOVIMIENTO_SENTIDO_COBRO");
    expect(trigger).toContain("LC_MOVIMIENTO_SENTIDO_PAGO");
    expect(trigger).toContain("LC_MOVIMIENTO_DIVISA_MISMATCH");
  });
});
