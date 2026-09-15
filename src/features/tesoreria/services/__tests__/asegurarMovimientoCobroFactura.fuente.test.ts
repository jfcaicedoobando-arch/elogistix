/**
 * MNY-NEW-06 — contrato de la fuente SQL del abono bancario del cobro:
 * un cruce entre dos divisas extranjeras (USD↔EUR) debe fallar cerrado y jamás
 * insertar el monto nominal 1:1.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fuente = readFileSync(
  resolve(process.cwd(), "supabase/schema/tesoreria/asegurar_movimiento_cobro_factura.sql"),
  "utf8",
);

describe("asegurar_movimiento_cobro_factura · moneda fail-closed", () => {
  it("bloquea el cruce divisa↔divisa con LC_PAGO_CRUCE_NO_SOPORTADO", () => {
    expect(fuente).toContain("LC_PAGO_CRUCE_NO_SOPORTADO");
  });

  it("ya no cae en un abono nominal 1:1 (ELSE v_pago.monto)", () => {
    expect(fuente).not.toMatch(/ELSE\s+v_pago\.monto\s*\n\s*END;/);
  });

  it("conserva las dos conversiones canónicas contra MXN", () => {
    expect(fuente).toContain("v_pago.monto * v_pago.tipo_cambio");
    expect(fuente).toContain("v_pago.monto / v_pago.tipo_cambio");
  });

  it("sigue exigiendo tipo de cambio cuando las monedas difieren", () => {
    expect(fuente).toContain("LC_PAGO_TC_REQUERIDO");
  });
});
