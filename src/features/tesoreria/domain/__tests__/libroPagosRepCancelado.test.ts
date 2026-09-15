/**
 * MNY-07 — un cobro con complemento de pago (REP) cancelado se conserva en la
 * lista, pero no debe sumar en los KPIs de cobrado / neto.
 */
import { describe, it, expect } from "vitest";
import {
  repCancelado,
  totalesLibroPagos,
  type PagoLibro,
} from "@/features/tesoreria/domain/libroPagos";

function pago(over: Partial<PagoLibro> = {}): PagoLibro {
  return {
    id: "p1",
    tipo: "cobro",
    fecha: "2026-09-01",
    contraparte: "Cliente SA",
    contraparte_id: "c1",
    documento_id: "f1",
    documento_folio: "A-1",
    moneda: "MXN",
    monto: 1000,
    tipo_cambio: 1,
    monto_mxn: 1000,
    metodo_pago: "Transferencia",
    referencia: null,
    cuenta_bancaria_id: null,
    cuenta_alias: null,
    cuenta_banco: null,
    notas: null,
    embarque_id: null,
    diferencia_cambiaria_mxn: 0,
    estado_rep: "Timbrado",
    folio_rep: "REP-1",
    es_ajuste: false,
    es_anticipo_aplicado: false,
    lote_id: null,
    conciliado: true,
    movimiento_id: null,
    created_at: null,
    ...over,
  };
}

describe("totalesLibroPagos · REP cancelado (MNY-07)", () => {
  it("excluye el cobro cancelado de cobrado y neto, pero lo cuenta como fila", () => {
    const t = totalesLibroPagos([
      pago(),
      pago({ id: "p2", estado_rep: "Cancelado", monto_mxn: 500 }),
    ]);
    expect(t.cobradoMxn).toBe(1000);
    expect(t.netoMxn).toBe(1000);
    expect(t.conteo).toBe(2);
  });

  it("no aplica a pagos a proveedor ni a estados vigentes", () => {
    expect(repCancelado(pago({ tipo: "pago", estado_rep: "Cancelado" }))).toBe(false);
    expect(repCancelado(pago())).toBe(false);
    expect(repCancelado(pago({ estado_rep: "cancelado" }))).toBe(true);
  });
});
