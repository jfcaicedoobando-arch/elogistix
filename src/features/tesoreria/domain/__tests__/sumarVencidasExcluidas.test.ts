/**
 * FIN-NEW-02 — una factura vencida en divisa sin tipo de cambio se cuenta pero
 * no se puede convertir. Antes sólo se devolvía `{total_mxn, count}` y la
 * tarjeta de Tesorería podía decir "Total vencido MXN 0 (1 factura)" sin señal.
 */
import { describe, it, expect } from "vitest";
import { sumarVencidas } from "@/features/tesoreria/domain/resumenHelpers";

const filas = [
  { saldo: 1000, moneda: "MXN", estatus: "Vencida" },
  { saldo: 200, moneda: "EUR", estatus: "Vencida" },
];
const estatusOf = (r: { estatus: string }) => r.estatus;

describe("sumarVencidas · monedas excluidas por falta de T.C.", () => {
  it("sin T.C. de EUR expone el monto excluido y mantiene el total conservador", () => {
    const r = sumarVencidas(filas, estatusOf, { usdMxn: 20, eurMxn: null });
    expect(r.count).toBe(2);
    expect(r.total_mxn).toBe(1000);
    expect(r.excluidas_count).toBe(1);
    expect(r.excluido_por_moneda).toEqual({ EUR: 200 });
  });

  it("con T.C. disponible no excluye nada y suma todo", () => {
    const r = sumarVencidas(filas, estatusOf, { usdMxn: 20, eurMxn: 22 });
    expect(r.total_mxn).toBe(1000 + 200 * 22);
    expect(r.excluidas_count).toBe(0);
    expect(r.excluido_por_moneda).toEqual({});
  });
});
