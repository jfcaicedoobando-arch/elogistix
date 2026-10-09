import { describe, expect, it } from "vitest";
import { buildCostosDesdeTarifa } from "../../components/seccionRuta/buildCostosDesdeTarifa";
import { NOTA_AUTO_FLETE_LCL, reemplazarCostosAutoFleteLcl, reemplazarCostosAutoTarifa } from "../costosAutoGenerados";
import { prepararCostosConOrigen, sincronizarVentasConCostos } from "../sincronizarVentasConCostos";
import { buildCotizacionInitialCostos } from "../mappers/cotizacionForm";
import type { FilaCostoLocal, ConceptoVentaCotizacion } from "@/features/cotizacion/types";
const tarifa = (cantidad: number, id = "tarifa-A") => buildCostosDesdeTarifa({ tarifa: { id, flete_base: 100, naviera_nombre: "Naviera", tipo_contenedor_nombre: "40HC" }, recargos: [], markup: 0, cantidad });
const venta = (id: string): ConceptoVentaCotizacion => ({ origen_costo_id: id, descripcion: "Flete", cantidad: 1, precio_unitario: 100, moneda: "USD", unidad_medida: "contenedor", aplica_iva: true, tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 116 });
const clavesNuevas = (costos: FilaCostoLocal[]) => costos.map(c => c.origen_venta_id ? c : { ...c, origen_venta_id: crypto.randomUUID() });
describe("Audit145: recalcular preserva identidad exacta e impuestos de ventas", () => {
  it("misma tarifa, cantidad1→2 mantiene ventaIVA16 y origen", () => {
    const prev = tarifa(1).map(c => ({ ...c, origen_venta_id: "linea-A" }));
    const next = clavesNuevas(reemplazarCostosAutoTarifa(prev, tarifa(2)));
    expect(next[0].origen_venta_id).toBe("linea-A");
    const result = sincronizarVentasConCostos(next, prev, [venta("linea-A")], 0.16);
    expect(result.usd).toEqual([expect.objectContaining({ origen_costo_id: "linea-A", cantidad: 2, tipo_iva: "gravado_16", tasa_iva_aplicada: 0.16, total: 232 })]);
  });
  it("reabrir, rehidratar y recalcular tarifa/recargos conserva sus ventas e impuestos explícitos", () => {
    const base = tarifa(1)[0];
    const persistidos = [
      { ...base, origen_venta_id: "linea-base", costeo_tarifa_recargo_id: null },
      { ...base, concepto: "BAF", origen_venta_id: "linea-BAF", costeo_tarifa_recargo_id: "recargo-BAF" },
      { ...base, concepto: "ISPS", origen_venta_id: "linea-ISPS", costeo_tarifa_recargo_id: "recargo-ISPS" },
    ];
    const prev = buildCotizacionInitialCostos(persistidos);
    const nuevas = [persistidos[0], persistidos[2], persistidos[1]].map(c => ({ ...c, origen_venta_id: undefined, cantidad: 2 }));
    const next = clavesNuevas(reemplazarCostosAutoTarifa(prev, nuevas));
    expect(next.map(c => c.origen_venta_id)).toEqual(["linea-base", "linea-ISPS", "linea-BAF"]);
    const ventas = [venta("linea-base"),
      { ...venta("linea-BAF"), descripcion: "BAF", aplica_iva: false, tipo_iva: "no_objeto", tasa_iva_aplicada: 0, total: 100 },
      { ...venta("linea-ISPS"), descripcion: "ISPS", aplica_iva: false, tipo_iva: "exento", tasa_iva_aplicada: 0, total: 100 },
    ];
    const result = sincronizarVentasConCostos(next, prev, ventas, 0.16);
    expect(result.mxn).toEqual([]);
    expect(result.usd).toEqual(ventas.map(v => ({ ...v, cantidad: 2, total: v.total * 2 })));
  });
  it("singleton LCL sigue siendo la misma fuente al cambiar W/M", () => {
    const prev = tarifa(1).map(c => ({ ...c, notas: NOTA_AUTO_FLETE_LCL, origen_venta_id: "lcl-A" }));
    const nuevas = tarifa(3).map(c => ({ ...c, notas: NOTA_AUTO_FLETE_LCL }));
    const next = clavesNuevas(reemplazarCostosAutoFleteLcl(prev, nuevas));
    expect(sincronizarVentasConCostos(next, prev, [venta("lcl-A")], 0.16).usd[0]).toMatchObject({ origen_costo_id: "lcl-A", cantidad: 3, total: 348, tipo_iva: "gravado_16" });
  });
  it.each([null, "tarifa-antigua"])("tarifa pendiente %s recalculada conserva revisión sin duplicar ventas", (costeo_tarifa_id) => {
    const legacy = { ...venta("legacy"), origen_costo_id: undefined };
    const prev = prepararCostosConOrigen(tarifa(1).map(c => ({ ...c, costeo_tarifa_id })), [legacy]);
    const next = clavesNuevas(reemplazarCostosAutoTarifa(prev, tarifa(2)));
    expect(next[0].venta_vinculo_pendiente).toBe(true);
    expect(next[0].origen_venta_id).not.toBe(prev[0].origen_venta_id);
    expect(sincronizarVentasConCostos(next, prev, [legacy], 0.16).usd).toEqual([legacy]);
  });
  it("LCL ambiguo mantiene revisión pendiente en fuentes nuevas y no duplica la venta legacy", () => {
    const legacy = { ...venta("legacy"), origen_costo_id: undefined };
    const prev = prepararCostosConOrigen([1, 2].flatMap(q => tarifa(q).map(c => ({ ...c, notas: NOTA_AUTO_FLETE_LCL }))), [legacy]);
    const nuevas = tarifa(3).map(c => ({ ...c, notas: NOTA_AUTO_FLETE_LCL }));
    const next = clavesNuevas(reemplazarCostosAutoFleteLcl(prev, nuevas));
    expect(next[0].venta_vinculo_pendiente).toBe(true);
    expect(prev.map(c => c.origen_venta_id)).not.toContain(next[0].origen_venta_id);
    expect(sincronizarVentasConCostos(next, prev, [legacy], 0.16).usd).toEqual([legacy]);
  });
  it("tarifa distinta no adopta origen ni tratamiento de otro costo", () => {
    const prev = tarifa(1).map(c => ({ ...c, origen_venta_id: "linea-A" }));
    expect(reemplazarCostosAutoTarifa(prev, tarifa(2, "tarifa-B"))[0].origen_venta_id).toBeUndefined();
  });
  it("recargos distintos de la misma tarifa conservan sólo su identidad, aunque se reordenen", () => {
    const base = tarifa(1)[0];
    const prev = ["r1", "r2"].map(id => ({ ...base, costeo_tarifa_recargo_id: id, origen_venta_id: `venta-${id}` }));
    const nuevas = ["r2", "r1"].map(id => ({ ...base, costeo_tarifa_recargo_id: id, cantidad: 2 }));
    expect(reemplazarCostosAutoTarifa(prev, nuevas).map(c => c.origen_venta_id)).toEqual(["venta-r2", "venta-r1"]);
  });
});
