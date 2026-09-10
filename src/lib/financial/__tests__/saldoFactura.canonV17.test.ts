/**
 * Ola v17 — el saldo dejó de depender del ESTADO de la factura (circularidad).
 * Espejo de `public._saldo_factura_calc`: sólo Cancelada/Sustituida fuerzan 0.
 */
import { describe, it, expect } from "vitest";
import { calcularSaldoFactura, esEstadoSinSaldo, ESTADOS_SIN_SALDO } from "../saldoFactura";

describe("canon del saldo (Ola v17)", () => {
  it("una factura marcada 'Pagada' sin cobros vigentes SÍ reporta saldo", () => {
    const r = calcularSaldoFactura(17910, [{ monto_aplicado_factura: 17910, estado_rep: "Cancelado" }], [], "Pagada");
    expect(r.pagado).toBe(0);
    expect(r.saldo).toBe(17910);
    expect(r.liquidada).toBe(false);
  });

  it("'Cancelada' y 'Sustituida' siguen sin saldo", () => {
    expect(calcularSaldoFactura(1000, [], [], "Cancelada").saldo).toBe(0);
    expect(calcularSaldoFactura(1000, [], [], "Sustituida").saldo).toBe(0);
    expect(ESTADOS_SIN_SALDO).toEqual(["Cancelada", "Sustituida"]);
  });

  it("'Pagada' y 'Borrador' ya no son estados sin saldo", () => {
    expect(esEstadoSinSaldo("Pagada")).toBe(false);
    expect(esEstadoSinSaldo("Borrador")).toBe(false);
  });

  it("un cobro vigente sí liquida la factura", () => {
    const r = calcularSaldoFactura(1000, [{ monto_aplicado_factura: 1000 }], [], "Emitida");
    expect(r.saldo).toBe(0);
    expect(r.liquidada).toBe(true);
  });

  it("mezcla de cobros vigentes y anulados: sólo cuentan los vigentes", () => {
    const r = calcularSaldoFactura(
      1000,
      [{ monto_aplicado_factura: 400 }, { monto_aplicado_factura: 600, estado_rep: "Cancelado" }],
      [],
      "Parcialmente pagada",
    );
    expect(r.pagado).toBe(400);
    expect(r.saldo).toBe(600);
  });
});
