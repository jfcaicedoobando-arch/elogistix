/**
 * MNY (item 5): el diálogo de movimiento manual debe pedir confirmación antes
 * de descartar captura, pero no cuando sólo se abrió y se cerró.
 */
import { describe, it, expect } from "vitest";
import { movimientoManualSucio } from "../movimientoManual";

describe("movimientoManualSucio", () => {
  it("sin captura no hay cambios", () => {
    expect(movimientoManualSucio({})).toBe(false);
    expect(movimientoManualSucio({ concepto: "   ", referencia: "" })).toBe(false);
    expect(movimientoManualSucio({ monto: 0 })).toBe(false);
  });

  it("detecta concepto, importe, referencia y fecha capturados", () => {
    expect(movimientoManualSucio({ concepto: "Comisión" })).toBe(true);
    expect(movimientoManualSucio({ monto: 150 })).toBe(true);
    expect(movimientoManualSucio({ referencia: "ABC" })).toBe(true);
    expect(movimientoManualSucio({ fecha: "2026-06-10" })).toBe(true);
  });
});
