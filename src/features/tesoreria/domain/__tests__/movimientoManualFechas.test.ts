/**
 * N3 (v13.823.386) — límites de fecha del movimiento bancario manual:
 * no futura (día de negocio México) y no anterior al corte de la cuenta.
 */
import { describe, it, expect } from "vitest";
import { validarMovimientoManual, esMovimientoManualValido } from "../movimientoManual";

const base = {
  cuentaBancariaId: "c1",
  concepto: "Comisión bancaria",
  tipo: "cargo" as const,
  monto: 100,
};

describe("validarMovimientoManual · límites de fecha (N3)", () => {
  const limites = { hoyNegocio: "2026-09-14", fechaCorte: "2026-01-31" };

  it("rechaza una fecha que ya es mañana en México", () => {
    const errores = validarMovimientoManual({ ...base, fecha: "2026-09-15" }, limites);
    expect(errores.fecha).toContain("no puede ser posterior a hoy");
  });

  it("acepta la fecha de hoy en México", () => {
    expect(esMovimientoManualValido({ ...base, fecha: "2026-09-14" }, limites)).toBe(true);
  });

  it("rechaza una fecha anterior al corte de saldo inicial de la cuenta", () => {
    const errores = validarMovimientoManual({ ...base, fecha: "2026-01-30" }, limites);
    expect(errores.fecha).toContain("anterior al corte");
    expect(errores.fecha).toContain("31/01/2026");
  });

  it("acepta la fecha exacta del corte", () => {
    expect(esMovimientoManualValido({ ...base, fecha: "2026-01-31" }, limites)).toBe(true);
  });

  it("sigue exigiendo la fecha y no aplica límites cuando no se proporcionan", () => {
    expect(validarMovimientoManual({ ...base }, limites).fecha).toBe(
      "Captura la fecha del movimiento.",
    );
    expect(esMovimientoManualValido({ ...base, fecha: "2030-01-01" })).toBe(true);
  });
});
