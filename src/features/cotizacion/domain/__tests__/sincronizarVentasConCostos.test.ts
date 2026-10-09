import { describe, expect, it } from "vitest";
import type { FilaCostoLocal, ConceptoVentaCotizacion } from "@/features/cotizacion/types";
import { actualizarVentaVinculada, prepararCostosConOrigen, sincronizarVentasConCostos } from "../sincronizarVentasConCostos";
const costo = (over: Partial<FilaCostoLocal> = {}): FilaCostoLocal => ({ origen_venta_id: "cost-A", concepto: "Flete", moneda: "USD", proveedor: "Naviera", cantidad: 1, costo_unitario: 1, precio_venta: 100, unidad_medida: "Servicio", ...over });
const venta = (over: Partial<ConceptoVentaCotizacion> = {}): ConceptoVentaCotizacion => ({ origen_costo_id: "cost-A", descripcion: "Flete", moneda: "USD", cantidad: 1, precio_unitario: 100, unidad_medida: "Servicio", aplica_iva: true, tasa_iva_aplicada: 0.16, tipo_iva: "gravado_16", total: 116, ...over });
describe("Audit145: sincronización por vínculo estable", () => {
  it("cambiar costo USD conserva manualMXN10200, manualUSD e IVA16", () => {
    const manual = venta({ origen_costo_id: undefined, moneda: "MXN", descripcion: "Manual", precio_unitario: 10200, total: 11832 });
    const manualUSD = venta({ origen_costo_id: undefined, descripcion: "Manual USD" });
    const result = sincronizarVentasConCostos([costo({ precio_venta: 2 })], [costo()], [venta(), manual, manualUSD], 0.16);
    expect(result.usd).toHaveLength(2);
    expect(result.usd[0]).toMatchObject({ precio_unitario: 2, total: 2.32, tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16 });
    expect(result.usd[1]).toBe(manualUSD);
    expect(result.mxn).toEqual([manual]);
  });
  it.each(["no_objeto", "exento", "tasa_0"])("conserva tratamiento %s explícito", (tipo_iva) => {
    expect(actualizarVentaVinculada(venta({ tipo_iva, aplica_iva: false, tasa_iva_aplicada: 0 }), costo({ cantidad: 2, precio_venta: 2 }), 0.16)).toMatchObject({ tipo_iva, total: 4, cantidad: 2 });
  });
  it.each([
    { tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 232 },
    { tipo_iva: "gravado_8", tasa_iva_aplicada: 0.08, total: 216 },
    { tipo_iva: "tasa_0", tasa_iva_aplicada: 0, total: 200 },
    { tipo_iva: "no_objeto", tasa_iva_aplicada: 0, total: 200 },
    { tipo_iva: "exento", tasa_iva_aplicada: 0, total: 200 },
  ])("regenerar conserva tasa explícita $tipo_iva aunque cambie la global", (fiscal) => {
    const previa = venta({ ...fiscal, aplica_iva: fiscal.tasa_iva_aplicada > 0 });
    expect(sincronizarVentasConCostos([costo({ precio_venta: 200 })], [costo()], [previa], 0.08).usd[0])
      .toMatchObject({ ...fiscal, precio_unitario: 200 });
  });
  it("costo quitado borra sólo su venta vinculada, conserva manual y huérfana histórica", () => {
    const manual = venta({ origen_costo_id: undefined });
    const huerfana = venta({ origen_costo_id: "desconocido" });
    expect(sincronizarVentasConCostos([], [costo()], [venta(), manual, huerfana], 0.16).usd).toEqual([manual, huerfana]);
  });
  it("no resucita una venta borrada deliberadamente si su costo ya existía", () => {
    expect(sincronizarVentasConCostos([costo({ precio_venta: 200 })], [costo()], [], 0.16).usd).toEqual([]);
  });
  it("no modifica edición manual de una partida si su costo no cambió", () => {
    const editada = venta({ precio_unitario: 150, descripcion: "Texto personal", total: 174 });
    expect(sincronizarVentasConCostos([costo()], [costo()], [editada], 0.16).usd[0]).toBe(editada);
  });
  it.each([
    { cambio: { notas: "Nota nueva" }, esperado: { notas: "Nota nueva" } },
    { cambio: { concepto: "Nombre nuevo" }, esperado: { descripcion: "Nombre nuevo" } },
    { cambio: { unidad_medida: "Kg" }, esperado: { unidad_medida: "Kg" } },
  ])("actualiza sólo el campo fuente modificado: $cambio", ({ cambio, esperado }) => {
    const editada = venta({ cantidad: 3, precio_unitario: 150, descripcion: "Texto personal", notas: "Nota personal", unidad_medida: "Caja", total: 522 });
    expect(sincronizarVentasConCostos([costo(cambio)], [costo()], [editada], 0.16).usd).toEqual([{ ...editada, ...esperado }]);
  });
  it("cambiar precio fuente conserva cantidad manual y recalcula su total con IVA explícito", () => {
    const editada = venta({ cantidad: 3, precio_unitario: 150, total: 522 });
    expect(sincronizarVentasConCostos([costo({ precio_venta: 200 })], [costo()], [editada], 0.16).usd)
      .toEqual([{ ...editada, precio_unitario: 200, total: 696 }]);
  });
  it("cambiar cantidad fuente conserva precio manual y recalcula su total con IVA explícito", () => {
    const editada = venta({ cantidad: 3, precio_unitario: 150, total: 522 });
    expect(sincronizarVentasConCostos([costo({ cantidad: 2 })], [costo()], [editada], 0.16).usd)
      .toEqual([{ ...editada, cantidad: 2, total: 348 }]);
  });
  it("cambiar moneda fuente conserva precio y cantidad manuales", () => {
    const editada = venta({ cantidad: 3, precio_unitario: 150, total: 522 });
    const result = sincronizarVentasConCostos([costo({ moneda: "MXN" })], [costo()], [editada], 0.16);
    expect(result.usd).toEqual([]);
    expect(result.mxn).toEqual([{ ...editada, moneda: "MXN" }]);
  });
  it("no vincula legado por coincidencia de nombre/importe, conserva antes de revisión explícita", () => {
    const manual = venta({ origen_costo_id: undefined });
    const old = prepararCostosConOrigen([costo({ origen_venta_id: null })], [manual]);
    expect(old[0].venta_vinculo_pendiente).toBe(true);
    expect(sincronizarVentasConCostos([{ ...old[0], precio_venta: 2 }], old, [manual], 0.16).usd).toEqual([manual]);
  });
  it("completar una fila antes vacía genera su venta una vez sin perder las existentes", () => {
    const vacia = costo({ origen_venta_id: "cost-B", concepto: "", proveedor: "", cantidad: 1, costo_unitario: 0, precio_venta: 0 });
    const completa = { ...vacia, concepto: "Despacho", proveedor: "Agente", costo_unitario: 50, precio_venta: 150 };
    const anteriores = [costo(), vacia];
    const actuales = [costo(), completa];
    const original = venta();
    const result = sincronizarVentasConCostos(actuales, anteriores, [original], 0.16);
    expect(result.usd).toHaveLength(2);
    expect(result.usd[0]).toBe(original);
    expect(result.usd[1]).toMatchObject({ origen_costo_id: "cost-B", descripcion: "Despacho", precio_unitario: 150 });
    expect(sincronizarVentasConCostos(actuales, actuales, result.usd, 0.16)).toEqual(result);
  });
  it("costo nuevo genera venta con origen y es idempotente tras sincronizar", () => {
    const result = sincronizarVentasConCostos([costo()], [], [], 0.16);
    expect(result.usd[0].origen_costo_id).toBe("cost-A");
    expect(sincronizarVentasConCostos([costo()], [costo()], result.usd, 0.16)).toEqual(result);
  });
});
