import { describe, expect, it } from "vitest";
import { erroresPagoProgramado } from "../pagoProgramadoValidacion";
import { filtrarPagos, metodosDisponibles } from "../libroPagos.filtros";
import { FILTROS_LIBRO_PAGOS_INICIALES, type PagoLibro } from "../libroPagos.tipos";
import { totalesLibroPagos } from "../libroPagos";
import { calcularResumenTesoreria } from "../resumen";
import { etiquetaMetodoPago } from "../metodoPago";
import { filasLibroPagosExport, fuenteTcPago } from "../../services/libroPagosExport";

const pago = { cuentaBancariaId: "bank", fecha: "2026-10-05", monto: 1, metodoPago: "Transferencia", tipoCambio: 18.1903 };
const factura = { saldo: 16, moneda: "USD", fecha_emision: "2026-10-01" };
const hoy = "2026-10-05";

describe("AUD103/108/114 preflight de pago programado", () => {
  it.each(["Efectivo", "01", " efectivo "])("%s se registra sin banco", (metodoPago) => {
    expect(erroresPagoProgramado({ ...pago, metodoPago, cuentaBancariaId: null }, factura, hoy)).toEqual({});
  });
  it("transferencia requiere banco, MXN no requiere TC", () => {
    expect(erroresPagoProgramado({ ...pago, cuentaBancariaId: null }, factura, hoy).cuenta).toBeTruthy();
    expect(erroresPagoProgramado({ ...pago, tipoCambio: null }, { ...factura, moneda: "MXN" }, hoy)).toEqual({});
  });
  it.each([null, undefined, 0, -1, NaN, Infinity])("rechaza tipo de cambio %s para USD y EUR", (tipoCambio) => {
    for (const moneda of ["USD", "EUR"]) {
      expect(erroresPagoProgramado({ ...pago, tipoCambio }, { ...factura, moneda }, hoy).tipoCambio).toBeTruthy();
    }
  });
  it.each([0, -1, NaN, Infinity, 17])("rechaza monto inválido o sobre saldo %s", (monto) => {
    expect(erroresPagoProgramado({ ...pago, monto }, factura, hoy).monto).toBeTruthy();
  });
  it.each(["", "2026-10-06", "2026-09-30", "2026-02-30", "2026-13-01"])("rechaza fecha inválida o fuera del rango %s", (fecha) => {
    expect(erroresPagoProgramado({ ...pago, fecha }, factura, hoy).fecha).toBeTruthy();
  });
  it("acepta liquidación y fecha de emisión exactas", () => {
    expect(erroresPagoProgramado({ ...pago, monto: 16, fecha: "2026-10-01" }, factura, hoy)).toEqual({});
  });
});

function evento(id: string, metodo_pago: string, monto_mxn = 10): PagoLibro {
  return { id, tipo: "cobro", fecha: hoy, contraparte: "Cliente", contraparte_id: null,
    documento_id: null, documento_folio: null, moneda: "MXN", monto: monto_mxn,
    tipo_cambio: 1, monto_mxn, metodo_pago, referencia: null, cuenta_bancaria_id: null,
    cuenta_alias: null, cuenta_banco: null, notas: null, embarque_id: null,
    diferencia_cambiaria_mxn: 0, estado_rep: null, folio_rep: null, es_ajuste: false,
    es_anticipo_aplicado: false, lote_id: null, conciliado: false, movimiento_id: null, created_at: null };
}

describe("AUD104 filtro y etiqueta usan el mismo método", () => {
  const pagos = [evento("1", "03", 18.19), evento("2", "Transferencia", 20), evento("3", "01", 5), evento("4", "Efectivo", 2), evento("5", "02", 7)];
  it("ofrece una opción por categoría, preserva los códigos del registro", () => {
    expect(metodosDisponibles(pagos)).toEqual(["Cheque", "Efectivo", "Transferencia"]);
    expect(pagos[0].metodo_pago).toBe("03");
  });
  it.each(["Transferencia", "03", " transferencia "])("%s incluye todos los cobros que se muestran como transferencia", (metodo) => {
    const filtrados = filtrarPagos(pagos, { ...FILTROS_LIBRO_PAGOS_INICIALES, metodo });
    expect(filtrados.map((p) => p.id)).toEqual(["1", "2"]);
    expect(totalesLibroPagos(filtrados).cobradoMxn).toBeCloseTo(38.19);
  });
  it("efectivo y cheque no entran al filtro transferencia", () => {
    expect(filtrarPagos(pagos, { ...FILTROS_LIBRO_PAGOS_INICIALES, metodo: "Efectivo" }).map((p) => p.id)).toEqual(["3", "4"]);
    expect(etiquetaMetodoPago("03")).toBe("Transferencia");
    expect(etiquetaMetodoPago("Tarjeta propia")).toBe("Tarjeta propia");
  });
});

describe("AUD105 Top 5 independiente por divisa", () => {
  it("no elimina USD/EUR aunque haya cinco saldos nominales mayores en MXN", () => {
    const cxp = ["MXN", "USD", "EUR"].flatMap((moneda) => Array.from({ length: 7 }, (_, i) => ({
      id: `${moneda}-${i}`, folio_proveedor: `${i}`, proveedor_nombre: `Proveedor ${i}`, moneda,
      saldo: (i + 1) * (moneda === "MXN" ? 1000 : 1), fecha_vencimiento: "2026-10-01", estatus: "Vencida",
    })));
    const r = calcularResumenTesoreria({ cuentas: [], cobranza: [], cxp });
    expect(r.top_acreedores).toHaveLength(15);
    for (const moneda of ["MXN", "USD", "EUR"]) {
      const top = r.top_acreedores.filter((p) => p.moneda === moneda);
      expect(top).toHaveLength(5);
      expect(top.map((p) => p.nombre)).toEqual(["Proveedor 6", "Proveedor 5", "Proveedor 4", "Proveedor 3", "Proveedor 2"]);
    }
  });
});

describe("AUD120 procedencia neutral sin revaluar históricos", () => {
  it("mantiene TC20 y equivalente20 sin atribuir DOF", () => {
    const registrado = { ...evento("manual", "03"), moneda: "USD", monto: 1, tipo_cambio: 20, monto_mxn: 20 };
    expect(fuenteTcPago(registrado)).toBe("TC registrado del pago");
    expect(filasLibroPagosExport([registrado])[0]).toMatchObject({ tipoCambio: "20.0000", fuenteTc: "TC registrado del pago" });
    expect(filasLibroPagosExport([registrado])[0].montoMxn).toContain("20.00");
    expect(fuenteTcPago({ moneda: "USD", tipo_cambio: null })).toBe("Sin TC registrado");
  });
});
