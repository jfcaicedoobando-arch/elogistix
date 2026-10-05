import { describe, expect, it } from "vitest";
import { estadoConciliacionPago } from "../conciliacionPago";
import { saldoAplicacion, refPagoDeLibro, refPagoDeMovimiento, esDineroRecibido, type AplicacionPago } from "../pagoDetalle";
import { FILTROS_LIBRO_PAGOS_INICIALES, filtrarPagos, totalesLibroPagos, type PagoLibro } from "../libroPagos";
import { filasLibroPagosExport, libroPagosACsv, resumenLibroPagos } from "../../services/libroPagosExport";

function pago(over: Partial<PagoLibro> = {}): PagoLibro {
  return {
    id: "anticipo", tipo: "anticipo", fecha: "2026-10-03", contraparte: "Proveedor",
    contraparte_id: "p", documento_id: null, documento_folio: null, moneda: "MXN", monto: 0.03,
    tipo_cambio: 1, monto_mxn: 0.03, metodo_pago: "Transferencia", referencia: "Reserva documental",
    cuenta_bancaria_id: "cuenta", cuenta_alias: "Banco", cuenta_banco: "Banco", notas: null,
    embarque_id: null, diferencia_cambiaria_mxn: 0, estado_rep: null, folio_rep: null,
    es_ajuste: false, es_anticipo_aplicado: false, lote_id: null, conciliado: false,
    movimiento_id: null, created_at: null, ...over,
  };
}
const aplicacion: AplicacionPago = {
  documento_id: "fp11", documento_tipo: "proveedor", folio: "FP-000011", folio_proveedor: null,
  embarque_id: null, moneda: "USD", monto_aplicado: 0.5, total: 1, pagado: 0.5,
  notas_credito_aplicadas: 0.5, fecha_aplicacion: null, pago_id: "pago",
};

describe("AUD98 · saldo actual de aplicación", () => {
  it("FP11 USD1 menos pago0.50 y NC0.50 conserva saldo cero", () => {
    expect(saldoAplicacion(aplicacion)).toBe(0);
    expect(saldoAplicacion({ ...aplicacion, pagado: 0.2, notas_credito_aplicadas: 0.3 })).toBe(0.5);
    expect(saldoAplicacion({ ...aplicacion, pagado: 0.75 })).toBe(0);
  });
  it("sin NC aplicada conserva saldo y evita residuos de coma flotante", () => {
    expect(saldoAplicacion({ ...aplicacion, notas_credito_aplicadas: 0 })).toBe(0.5);
    expect(saldoAplicacion({ ...aplicacion, total: 0.3, pagado: 0.1, notas_credito_aplicadas: 0.2 })).toBe(0);
  });
});

describe("AUD99 · conciliación del efectivo", () => {
  it.each(["Efectivo", " efectivo ", "01"])("%s sin banco no requiere conciliación", (metodo_pago) => {
    const p = pago({ tipo: "pago", metodo_pago, cuenta_bancaria_id: null });
    expect(estadoConciliacionPago(p)).toBe("No aplica");
    expect(filtrarPagos([p], { ...FILTROS_LIBRO_PAGOS_INICIALES, conciliacion: "pendientes" })).toEqual([]);
    expect(filtrarPagos([p], FILTROS_LIBRO_PAGOS_INICIALES)).toHaveLength(1);
    expect(filasLibroPagosExport([p])[0].estado).toBe("No aplica");
    expect(totalesLibroPagos([p]).pagadoMxn).toBe(0.03);
  });
  it("transferencia sin banco sigue pendiente y un vínculo conciliado conserva su estado", () => {
    const pendiente = pago({ cuenta_bancaria_id: null });
    const conciliado = pago({ conciliado: true, movimiento_id: "m" });
    expect(estadoConciliacionPago(pendiente)).toBe("Pendiente");
    expect(filtrarPagos([pendiente, conciliado], { ...FILTROS_LIBRO_PAGOS_INICIALES, conciliacion: "pendientes" })).toEqual([pendiente]);
    expect(estadoConciliacionPago(conciliado)).toBe("Conciliado");
    expect(estadoConciliacionPago(pago({ metodo_pago: "Efectivo" }))).toBe("Pendiente");
  });
});

describe("AUD100 · devolución independiente del anticipo", () => {
  it("salida0.03 más devolución0.03 conserva bruto y neto cero en GUI y exportación", () => {
    const original = pago();
    const devolucion = pago({ tipo: "devolucion_anticipo", referencia: "Devolución de reserva documental" });
    const visibles = filtrarPagos([original, devolucion], { ...FILTROS_LIBRO_PAGOS_INICIALES, texto: "reserva" });
    const total = totalesLibroPagos(visibles);
    expect(total).toMatchObject({ cobradoMxn: 0, pagadoMxn: 0.03, devueltoMxn: 0.03, netoMxn: 0, conteo: 2 });
    expect(filtrarPagos(visibles, { ...FILTROS_LIBRO_PAGOS_INICIALES, vista: "recibidos" })).toEqual([devolucion]);
    expect(refPagoDeLibro(devolucion)).toEqual({ tipo: "devolucion_anticipo", id: "anticipo" });
    expect(esDineroRecibido("devolucion_anticipo")).toBe(true);
    expect(refPagoDeMovimiento({ anticipo_proveedor_id: "anticipo", abono: 0.03, cargo: 0 }))
      .toEqual({ tipo: "devolucion_anticipo", id: "anticipo" });
    expect(libroPagosACsv(filasLibroPagosExport(visibles))).toContain("Devolución de anticipo");
    expect(resumenLibroPagos("2026-10-03", "2026-10-03", total)).toMatchObject({ devuelto: "MXN 0.03", neto: "MXN 0.00" });
  });
  it("remanente devuelto no duplica aplicaciones y no se mezcla nominal USD con MXN", () => {
    const original = pago({ monto: 25, monto_mxn: 500, moneda: "USD", tipo_cambio: 20 });
    const devuelto = pago({ tipo: "devolucion_anticipo", monto: 15, monto_mxn: 300, moneda: "USD", tipo_cambio: 20 });
    const aplicada = pago({ tipo: "pago", monto_mxn: 200, es_anticipo_aplicado: true });
    expect(totalesLibroPagos([original, devuelto, aplicada])).toMatchObject({ pagadoMxn: 500, devueltoMxn: 300, netoMxn: -200 });
    expect(totalesLibroPagos([original]).netoMxn).toBe(-500);
    expect(filasLibroPagosExport([devuelto])[0].fuenteTc).toBe("TC registrado del anticipo original");
    expect(totalesLibroPagos([pago({ tipo: "devolucion_anticipo", moneda: "USD", monto_mxn: null, tipo_cambio: null })]))
      .toMatchObject({ devueltoMxn: 0, netoMxn: 0, sinTcCount: 1 });
  });
});
