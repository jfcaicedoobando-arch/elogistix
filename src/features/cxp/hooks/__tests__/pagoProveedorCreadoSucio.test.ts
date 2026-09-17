/**
 * MNY (item 6): abrir y cerrar el diálogo de registrar pago NO debe pedir
 * confirmación de "descartar cambios": el monto llega prellenado con el saldo.
 * Lote P2 (item 1): cambiar sólo la fecha, la cuenta, el T/C o la diferencia
 * cambiaria SÍ debe advertir antes de cerrar.
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

  it("no marca cambios por precargas automáticas que el usuario no tocó", () => {
    // T/C del DOF, diferencia sugerida y cuenta preseleccionada.
    const conPrecargas = { ...actual, tc: "18.5", diffMxn: "12", cuentaId: "cta-1" };
    expect(pagoProveedorCreadoSucio(conPrecargas, iniciales)).toBe(false);
  });

  it("marca cambios al capturar referencia, notas, método, moneda o monto", () => {
    expect(pagoProveedorCreadoSucio({ ...actual, referencia: "REF" }, iniciales)).toBe(true);
    expect(pagoProveedorCreadoSucio({ ...actual, notas: "nota" }, iniciales)).toBe(true);
    expect(pagoProveedorCreadoSucio({ ...actual, metodo: "Efectivo" }, iniciales)).toBe(true);
    expect(pagoProveedorCreadoSucio({ ...actual, moneda: "USD" }, iniciales)).toBe(true);
    expect(pagoProveedorCreadoSucio({ ...actual, monto: "500.00" }, iniciales)).toBe(true);
  });

  it("marca cambios al mover la fecha de pago", () => {
    expect(pagoProveedorCreadoSucio({ ...actual, fecha: "2026-06-11" }, iniciales)).toBe(true);
  });

  it("marca cambios al elegir cuenta, T/C o diferencia a mano", () => {
    expect(
      pagoProveedorCreadoSucio({ ...actual, cuentaId: "cta-2" }, iniciales, { cuentaId: true }),
    ).toBe(true);
    expect(
      pagoProveedorCreadoSucio({ ...actual, tc: "19.1" }, iniciales, { tc: true }),
    ).toBe(true);
    expect(
      pagoProveedorCreadoSucio({ ...actual, diffMxn: "35" }, iniciales, { diffMxn: true }),
    ).toBe(true);
  });
});
