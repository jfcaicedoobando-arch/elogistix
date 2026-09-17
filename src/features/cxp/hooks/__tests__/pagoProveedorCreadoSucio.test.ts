/**
 * MNY (item 6): abrir y cerrar el diálogo de registrar pago NO debe pedir
 * confirmación de "descartar cambios": el monto llega prellenado con el saldo.
 */
import { describe, it, expect } from "vitest";
import { pagoProveedorCreadoSucio } from "../usePagoProveedorForm.editar";

const iniciales = {
  fecha: "2026-06-10", monto: "1000.00", moneda: "MXN", tc: "",
  metodo: "Transferencia", referencia: "", notas: "", diffMxn: "", cuentaId: "",
};

const actual = { ...iniciales };

describe("pagoProveedorCreadoSucio", () => {
  it("sin captura del usuario no marca cambios", () => {
    expect(pagoProveedorCreadoSucio(actual, iniciales)).toBe(false);
  });

  it("no marca cambios sin baseline (formulario aún sin abrir)", () => {
    expect(pagoProveedorCreadoSucio(actual, null)).toBe(false);
  });

  it("marca cambios al capturar referencia, notas, método, moneda o monto", () => {
    expect(pagoProveedorCreadoSucio({ ...actual, referencia: "REF" }, iniciales)).toBe(true);
    expect(pagoProveedorCreadoSucio({ ...actual, notas: "nota" }, iniciales)).toBe(true);
    expect(pagoProveedorCreadoSucio({ ...actual, metodo: "Efectivo" }, iniciales)).toBe(true);
    expect(pagoProveedorCreadoSucio({ ...actual, moneda: "USD" }, iniciales)).toBe(true);
    expect(pagoProveedorCreadoSucio({ ...actual, monto: "500.00" }, iniciales)).toBe(true);
  });
});
