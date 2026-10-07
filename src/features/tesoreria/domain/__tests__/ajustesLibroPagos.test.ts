import { describe, expect, it } from "vitest";
import { estadoConciliacionPago } from "../conciliacionPago";
import { FILTROS_LIBRO_PAGOS_INICIALES, etiquetaTipoPagoLibro, filtrarPagos, totalesLibroPagos, type PagoLibro } from "../libroPagos";
import { filasLibroPagosExport, libroPagosACsv } from "../../services/libroPagosExport";

function pago(overrides: Partial<PagoLibro> = {}): PagoLibro {
  return {
    id: "ajuste", tipo: "pago", fecha: "2026-10-06", contraparte: "Proveedor fixture",
    contraparte_id: "proveedor", documento_id: "factura", documento_folio: "FP-FIXTURE", moneda: "MXN",
    monto: 1, tipo_cambio: null, monto_mxn: 1, metodo_pago: "Ajuste", referencia: "Cierre sin pago: condonacion",
    cuenta_bancaria_id: null, cuenta_alias: null, cuenta_banco: null, notas: null, embarque_id: null,
    diferencia_cambiaria_mxn: 0, estado_rep: null, folio_rep: null, es_ajuste: true,
    es_anticipo_aplicado: false, lote_id: null, conciliado: false, movimiento_id: null, created_at: null,
    ...overrides,
  };
}

describe("AUD99/121 · ajustes no monetarios en el libro de pagos", () => {
  it("conserva el registro y el importe, pero excluye el ajuste de ambas colas bancarias y del dinero", () => {
    const ajuste = Object.freeze(pago());
    const original = { ...ajuste };
    expect(estadoConciliacionPago(ajuste)).toBe("No aplica");
    expect(etiquetaTipoPagoLibro(ajuste)).toBe("Ajuste no monetario");
    for (const conciliacion of ["pendientes", "conciliados"] as const) {
      expect(filtrarPagos([ajuste], { ...FILTROS_LIBRO_PAGOS_INICIALES, conciliacion })).toEqual([]);
    }
    expect(filtrarPagos([ajuste], FILTROS_LIBRO_PAGOS_INICIALES)).toEqual([ajuste]);
    expect(totalesLibroPagos([ajuste])).toEqual({ cobradoMxn: 0, pagadoMxn: 0, devueltoMxn: 0, netoMxn: 0, conteo: 1, sinTcCount: 0 });
    expect(filasLibroPagosExport([ajuste])[0]).toMatchObject({ tipo: "Ajuste no monetario", monto: "MXN 1.00", estado: "No aplica" });
    expect(libroPagosACsv(filasLibroPagosExport([ajuste]))).toContain("Ajuste no monetario");
    expect(ajuste).toEqual(original);
  });

  it("clasifica por es_ajuste, sin convertir referencias ni métodos libres en evidencia", () => {
    const ajuste = pago({ metodo_pago: "03", referencia: null });
    const real = pago({ id: "real", es_ajuste: false });
    expect(estadoConciliacionPago(ajuste)).toBe("No aplica");
    expect(estadoConciliacionPago(real)).toBe("Pendiente");
    expect(etiquetaTipoPagoLibro(real)).toBe("Pago a proveedor");
    expect(totalesLibroPagos([ajuste, real]).pagadoMxn).toBe(1);
  });

  it("un flag de conciliación incoherente no convierte el ajuste en transacción bancaria", () => {
    const ajuste = pago({ conciliado: true, cuenta_bancaria_id: "banco", movimiento_id: "movimiento" });
    expect(estadoConciliacionPago(ajuste)).toBe("No aplica");
    expect(filtrarPagos([ajuste], { ...FILTROS_LIBRO_PAGOS_INICIALES, conciliacion: "conciliados" })).toEqual([]);
  });

  it("conserva transferencias pendientes, conciliadas, efectivo y filtros ordinarios", () => {
    const pendiente = pago({ id: "pendiente", es_ajuste: false, metodo_pago: "03", cuenta_bancaria_id: "banco" });
    const conciliado = pago({ ...pendiente, id: "conciliado", conciliado: true, movimiento_id: "movimiento" });
    const efectivo = pago({ id: "efectivo", es_ajuste: false, metodo_pago: "01" });
    const cobro = pago({ id: "cobro", tipo: "cobro", es_ajuste: false, metodo_pago: "03", moneda: "USD", monto: 2, monto_mxn: 40, tipo_cambio: 20, estado_rep: "Timbrado" });
    const filas = [pago(), pendiente, conciliado, efectivo, cobro];
    expect(filtrarPagos(filas, { ...FILTROS_LIBRO_PAGOS_INICIALES, conciliacion: "pendientes" })).toEqual([pendiente, cobro]);
    expect(filtrarPagos(filas, { ...FILTROS_LIBRO_PAGOS_INICIALES, conciliacion: "conciliados" })).toEqual([conciliado]);
    expect(filtrarPagos(filas, { ...FILTROS_LIBRO_PAGOS_INICIALES, cuentaId: "banco" })).toEqual([pendiente, conciliado]);
    expect(filtrarPagos(filas, { ...FILTROS_LIBRO_PAGOS_INICIALES, vista: "recibidos", moneda: "USD", rep: "timbrado" })).toEqual([cobro]);
    expect(estadoConciliacionPago(efectivo)).toBe("No aplica");
    expect(totalesLibroPagos(filas)).toMatchObject({ pagadoMxn: 3, cobradoMxn: 40, netoMxn: 37, conteo: 5 });
  });
});
