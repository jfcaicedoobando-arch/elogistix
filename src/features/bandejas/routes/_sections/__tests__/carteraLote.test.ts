/**
 * Pruebas de `derivarLoteCobro`: sólo permite lote con mismo cliente,
 * misma moneda y al menos dos facturas.
 */
import { describe, it, expect } from "vitest";
import { derivarLoteCobro } from "../carteraLote";
import type { CarteraRow } from "../carteraColumns";

function row(over: Partial<CarteraRow>): CarteraRow {
  return {
    factura_id: "f1",
    numero: "A-1",
    cliente_id: "cli-1",
    cliente_nombre: "ACME",
    moneda: "MXN",
    saldo: 100,
    fecha_vencimiento: "2026-01-01",
    ...over,
  } as CarteraRow;
}

describe("derivarLoteCobro", () => {
  it("devuelve null con menos de dos facturas", () => {
    expect(derivarLoteCobro([row({})])).toBeNull();
  });

  it("devuelve null si hay clientes distintos", () => {
    const res = derivarLoteCobro([row({}), row({ factura_id: "f2", cliente_id: "cli-2" })]);
    expect(res).toBeNull();
  });

  it("devuelve null si hay monedas distintas", () => {
    const res = derivarLoteCobro([row({}), row({ factura_id: "f2", moneda: "USD" })]);
    expect(res).toBeNull();
  });

  it("arma el lote con las facturas seleccionadas", () => {
    const res = derivarLoteCobro([
      row({}),
      row({ factura_id: "f2", numero: "A-2", saldo: 250 }),
    ]);
    expect(res).toEqual({
      clienteId: "cli-1",
      clienteNombre: "ACME",
      moneda: "MXN",
      facturas: [
        { factura_id: "f1", numero: "A-1", fecha_vencimiento: "2026-01-01", saldo: 100 },
        { factura_id: "f2", numero: "A-2", fecha_vencimiento: "2026-01-01", saldo: 250 },
      ],
    });
  });
});
