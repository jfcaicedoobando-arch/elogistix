/**
 * Ola v17 — la cartera de Dirección debe excluir los cobros ANULADOS por REP
 * cancelado, igual que Portal, Cobranza, Cartera y Estado de Cuenta. Antes los
 * sumaba (el loader ni siquiera leía `estado_rep`) y mostraba menos adeudo.
 */
import { describe, it, expect } from "vitest";
import { saldoEnMonedaFactura } from "../saldoCartera";
import type { FacturaRow, PagoRow } from "../loaders";

const factura = { total: 17910, moneda: "USD", tipo_cambio: 18 } as Pick<
  FacturaRow, "total" | "moneda" | "tipo_cambio"
>;

const pago = (monto: number, estado_rep?: string): Pick<PagoRow, "monto_aplicado_factura" | "estado_rep"> => ({
  monto_aplicado_factura: monto,
  estado_rep: estado_rep ?? null,
});

describe("saldoEnMonedaFactura · pagos anulados", () => {
  it("ignora el cobro cuyo REP fue cancelado", () => {
    expect(saldoEnMonedaFactura(factura, [pago(17910, "Cancelado")], [])).toBe(17910);
  });

  it("resta el cobro vigente", () => {
    expect(saldoEnMonedaFactura(factura, [pago(17910)], [])).toBe(0);
  });

  it("mezcla vigente + anulado", () => {
    expect(saldoEnMonedaFactura(factura, [pago(7910), pago(10000, "Cancelado")], [])).toBe(10000);
  });

  it("compatibilidad: sin la columna estado_rep el cobro se considera vigente", () => {
    expect(saldoEnMonedaFactura(factura, [{ monto_aplicado_factura: 910 }], [])).toBe(17000);
  });
});
