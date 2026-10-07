import { describe, expect, it } from "vitest";
import { derivarLoteCobro, puedeSeleccionarCobro } from "../carteraLote";
import { errorCobroPuePrevio } from "@/features/facturacion/domain/pueCobroPrevio";
import { errorRenglonPue, erroresPorRenglon } from "@/features/facturacion/services/cobroLoteValidaciones";
import { validarCobroLote, type FacturaCobroCandidata } from "@/features/facturacion/services/pagoClienteLote";
import { repartirFifo, repartirTodo } from "@/features/facturacion/services/cobroLoteReparto";
import { asignarSaldoFactura, asignarSobrante } from "@/features/facturacion/services/cobroLoteAtajos";
import { todayLocalISO } from "@/lib/date/today";
import type { CarteraRow } from "../carteraColumns.types";
const a8: CarteraRow = {
  factura_id: "A8", numero: "A8", cliente_id: "c1", cliente_nombre: "Ficticio", embarque_id: null, expediente: null,
  fecha_emision: "2026-10-01", fecha_vencimiento: "2026-10-02", dias_vencido: 1, moneda: "MXN",
  total: 1.16, pagado: 1.15, saldo: .01, ultimo_contacto: null, estado: "Pagada", metodo_pago: "PUE",
};
const ppd: CarteraRow = { ...a8, factura_id: "PPD", numero: "PPD", pagado: 0, saldo: 1.16, estado: "Emitida", metodo_pago: "PPD" };
const opts = { cuentaId: null, monedaCuenta: null, moneda: "MXN", fecha: todayLocalISO(), tcAplicable: null, formaPago: "03" };

describe("AUD54 P2: evidencia PUE en todas las fronteras del lote", () => {
  it("A8 permanece visible como dato, pero no es seleccionable ni derivable como lote", () => {
    expect(a8.saldo).toBe(.01);
    expect(puedeSeleccionarCobro(a8)).toBe(false);
    expect(puedeSeleccionarCobro(ppd)).toBe(true);
    expect(derivarLoteCobro([a8, ppd])).toBeNull();
    expect(errorCobroPuePrevio(a8)).toMatch(/Revisa el pago previo/);
  });
  it("la derivación legítima preserva pagado y permite PUE sin cobro + PPD parcial", () => {
    const lote = derivarLoteCobro([{ ...a8, pagado: 0, saldo: 1.16, estado: "Emitida" }, ppd]);
    expect(lote?.facturas.map((f) => f.pagado)).toEqual([0, 0]);
    expect(validarCobroLote(lote!.facturas, [{ factura_id: "A8", monto: 1.16 }, { factura_id: "PPD", monto: .01 }], 1.17, opts).error).toBeNull();
  });
  it.each([undefined, null, Number.NaN, -1])("PUE sin evidencia confiable (%s) falla cerrado", (pagado) => {
    expect(errorCobroPuePrevio({ metodo_pago: "PUE", pagado })).toMatch(/verificar/);
  });
  it("rechaza una candidata A8 reconstruida externamente aunque el centavo liquide su saldo", () => {
    const facturas: FacturaCobroCandidata[] = [a8, ppd];
    const renglones = [{ factura_id: "A8", monto: .01 }, { factura_id: "PPD", monto: 1.16 }];
    expect(errorRenglonPue(facturas, renglones)).toMatch(/segunda exhibición/);
    expect(erroresPorRenglon(facturas, renglones).A8).toMatch(/segunda exhibición/);
    expect(validarCobroLote(facturas, renglones, 1.17, opts).error).toMatch(/segunda exhibición/);
  });
  it("si el refetch elimina una factura del reparto, no asume que puede cobrarse", () => {
    expect(errorRenglonPue([ppd], [{ factura_id: "A8", monto: .01 }])).toMatch(/ya no está/);
  });
  it("FIFO, Liquidar todo y ambos atajos nunca asignan dinero a A8", () => {
    const facturas: FacturaCobroCandidata[] = [a8, ppd];
    const cero = [{ factura_id: "A8", monto: 0 }, { factura_id: "PPD", monto: 0 }];
    expect(repartirFifo(facturas, 1.17).renglones.find((r) => r.factura_id === "A8")?.monto).toBe(0);
    expect(repartirTodo(facturas)[0].monto).toBe(0);
    expect(asignarSaldoFactura(facturas, cero, "A8", 1.17)[0].monto).toBe(0);
    expect(asignarSobrante(facturas, cero, 1.17)[0].monto).toBe(0);
  });
  it("la misma evidencia de pago previo no bloquea un abono PPD", () => {
    const f = { ...a8, metodo_pago: "PPD" };
    expect(puedeSeleccionarCobro(f)).toBe(true);
    expect(errorRenglonPue([f], [{ factura_id: "A8", monto: .01 }])).toBeNull();
  });
});
