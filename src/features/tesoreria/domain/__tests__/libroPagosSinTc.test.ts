/**
 * MNY-P2.3 — un pago legacy en moneda extranjera sin tipo de cambio registrado
 * NO se valúa con una tasa inventada de 1: queda fuera de los totales en pesos
 * y se reporta aparte.
 */
import { describe, it, expect } from "vitest";
import { totalesLibroPagos, type PagoLibro } from "@/features/tesoreria/domain/libroPagos";

function pago(over: Partial<PagoLibro>): PagoLibro {
  // SAFE-CAST: los totales sólo leen tipo, moneda, monto_mxn y estado_rep.
  return {
    id: "p",
    tipo: "cobro",
    moneda: "USD",
    monto: 100,
    tipo_cambio: null,
    monto_mxn: null,
    estado_rep: null,
    ...over,
  } as PagoLibro;
}

describe("totalesLibroPagos · sin T/C registrado (MNY-P2.3)", () => {
  it("excluye el pago sin equivalente en pesos y lo cuenta aparte", () => {
    const t = totalesLibroPagos([
      pago({ id: "a" }),
      pago({ id: "b", moneda: "MXN", monto_mxn: 500, tipo_cambio: 1 }),
    ]);
    expect(t.cobradoMxn).toBe(500);
    expect(t.sinTcCount).toBe(1);
    expect(t.conteo).toBe(2);
  });

  it("no reporta faltantes cuando todos tienen equivalente", () => {
    const t = totalesLibroPagos([
      pago({ id: "a", tipo_cambio: 18, monto_mxn: 1800 }),
      pago({ id: "b", tipo: "pago", tipo_cambio: 18, monto_mxn: 900 }),
    ]);
    expect(t.cobradoMxn).toBe(1800);
    expect(t.pagadoMxn).toBe(900);
    expect(t.netoMxn).toBe(900);
    expect(t.sinTcCount).toBe(0);
  });
});
