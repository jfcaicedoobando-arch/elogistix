import { describe, expect, it } from "vitest";
import { mapProveedorFacturaRows, mapProveedorNotaCreditoRows } from "@/lib/mappers/estadoResultadosRows";
import { costosDeProveedorFacturas, costosDeNotasProveedor, type CostosBucket } from "../estadoResultadosBuckets";
import { buildEstadoResultados } from "@/features/profit/domain/estadoResultados";
import { buildEstadoResultadosCsvRows } from "@/features/profit/components/EstadoResultadosTable.helpers";
import { baseNcProveedor, valuacionNcProveedor } from "@/lib/financial/baseNcProveedor";

const tc = { usd: 18.1903, eur: 20.4368 };
const bucket = (): CostosBucket => ({ embarques: [], costos: [] });
const embarque = { id: "e", modo: "Aéreo", tipo_cambio_usd: 19, tipo_cambio_eur: 23 };

describe("AUD106/122/125 · costo documental sin impuestos", () => {
  it.each([null, "e"])("EUR 1 con TC20 conserva costo20 con embarque %s", (embarque_id) => {
    const out = bucket();
    costosDeProveedorFacturas(mapProveedorFacturaRows([{ id: "f", subtotal: 1, moneda: "EUR", tipo_cambio_usd: 20, embarque_id }]), [embarque], out, tc);
    expect(buildEstadoResultados(out.embarques, [], out.costos).totalCostos.total).toBe(20);
  });
  it.each([
    { subtotal: 100, monto: 116 },
    { subtotal: 200, monto: 216 }, // 100 IVA16 + 100 tasa0
    { subtotal: 100, monto: 108 }, // mitad del desglose mixto
    { subtotal: 100, monto: 94 }, // retenciones superiores a traslados
    { subtotal: 0, monto: 16 }, // corrección exclusiva de impuestos
  ])("revierte base $subtotal sin confundir crédito total $monto", ({ subtotal, monto }) => {
    const out = bucket();
    costosDeNotasProveedor(mapProveedorNotaCreditoRows([{ id: "n", proveedor_factura_id: "f", subtotal, monto, moneda: "MXN" }]), [], new Map(), out, tc);
    expect(buildEstadoResultados(out.embarques, [], out.costos).totalCostos.total).toBeCloseTo(-subtotal);
  });
  it("EUR/EUR revierte 20 y conserva la deuda nominal independiente", () => {
    const out = bucket();
    const [nc] = mapProveedorNotaCreditoRows([{ id: "n", proveedor_factura_id: "f", subtotal: 1, monto: 1, moneda: "EUR", tipo_cambio: null, tipo_cambio_mxn: 20 }]);
    costosDeNotasProveedor([nc], [embarque], new Map([["f", "e"]]), out, tc);
    expect(nc.monto).toBe(1);
    expect(buildEstadoResultados(out.embarques, [], out.costos).totalCostos.total).toBe(-20);
  });
  it("legacy sin base queda señalado y nunca revierte el total bruto", () => {
    const out = bucket();
    costosDeNotasProveedor(mapProveedorNotaCreditoRows([{ id: "legacy", proveedor_factura_id: "f", monto: 116, moneda: "MXN" }]), [], new Map(), out, tc);
    expect(out.costos).toEqual([]);
    expect(out.notasSinBase).toEqual(["legacy"]);
    const estado = { ...buildEstadoResultados([], [], []), notas_proveedor_sin_base: out.notasSinBase };
    expect(buildEstadoResultadosCsvRows(estado)[0]).toMatchObject({ seccion: "Advertencia", concepto: expect.stringContaining("Reporte provisional") });
  });
  it.each([null, undefined, "", "NaN", Infinity, -1])("base inválida %s no se convierte en cero", (base) => {
    expect(baseNcProveedor(base)).toBeNull();
    expect(mapProveedorNotaCreditoRows([{ subtotal: base }])[0].subtotal).toBeNull();
  });
  it("sólo hereda una tasa cuyo denominador coincide", () => {
    expect(valuacionNcProveedor({ moneda: "EUR" }, { moneda: "EUR", tipo_cambio_usd: 20 })).toBe(20);
    expect(valuacionNcProveedor({ moneda: "EUR" }, { moneda: "USD", tipo_cambio_usd: 18 })).toBeNull();
    expect(valuacionNcProveedor({ moneda: "MXN", tipo_cambio: 20 }, { moneda: "USD" })).toBe(1);
  });
});
