import type { FilaCostoLocal, ConceptoVentaCotizacion } from "@/features/cotizacion/types";
import { buildConceptosFromCostos } from "./cotizacion.conceptos";
import { calcularTotalConIVA, resolverTasaConcepto, subtotalLinea } from "@/lib/financial/financialUtils";

/** A draft's unknown lineage requires a user choice, never a match by text/amount. */
export function prepararCostosConOrigen(costos: FilaCostoLocal[], ventas: ConceptoVentaCotizacion[]): FilaCostoLocal[] {
  const hayVentas = ventas.some(v => v.descripcion?.trim());
  return costos.map(c => ({ ...c, origen_venta_id: c.origen_venta_id || crypto.randomUUID(),
    venta_vinculo_pendiente: hayVentas && !ventas.some(v => !!c.origen_venta_id && v.origen_costo_id === c.origen_venta_id) }));
}

export function actualizarVentaVinculada(venta: ConceptoVentaCotizacion, costo: FilaCostoLocal, tasaIva: number, previo?: FilaCostoLocal): ConceptoVentaCotizacion {
  const cambiaCantidad = !previo || previo.cantidad !== costo.cantidad;
  const cambiaPrecio = !previo || previo.precio_venta !== costo.precio_venta;
  const actualizada = { ...venta, origen_costo_id: costo.origen_venta_id ?? undefined,
    cantidad: cambiaCantidad ? costo.cantidad : venta.cantidad,
    precio_unitario: cambiaPrecio ? costo.precio_venta : venta.precio_unitario,
    moneda: !previo || previo.moneda !== costo.moneda ? costo.moneda : venta.moneda };
  return { ...actualizada, total: cambiaCantidad || cambiaPrecio
    ? calcularTotalConIVA(subtotalLinea(actualizada.cantidad, actualizada.precio_unitario), resolverTasaConcepto(actualizada, actualizada.tasa_iva_aplicada ?? tasaIva))
    : venta.total };
}

const firma = (c: FilaCostoLocal) => JSON.stringify([c.concepto, c.moneda, c.unidad_medida, c.cantidad, c.precio_venta, c.notas]);

/** Update only linked changed costs. Manual and unresolved legacy entries survive. */
export function sincronizarVentasConCostos(costos: FilaCostoLocal[], anteriores: FilaCostoLocal[], ventas: ConceptoVentaCotizacion[], tasaIva: number) {
  const activas = new Map(costos.filter(c => c.concepto.trim()).map(c => [c.origen_venta_id, c]));
  const previas = new Map(anteriores.map(c => [c.origen_venta_id, c]));
  const result: ConceptoVentaCotizacion[] = [];
  for (const venta of ventas) {
    if (!venta.origen_costo_id) { if (venta.descripcion?.trim()) result.push(venta); continue; }
    const costo = activas.get(venta.origen_costo_id);
    if (!costo) {
      // Only a known removed source proves the sale was derived from that cost.
      // Orphaned legacy/copy lineage is preserved for explicit review.
      if (!previas.has(venta.origen_costo_id)) result.push(venta);
      continue;
    }
    const previo = previas.get(venta.origen_costo_id);
    if (previo && firma(previo) === firma(costo)) { result.push(venta); continue; }
    const actualizada = actualizarVentaVinculada(venta, costo, tasaIva, previo);
    // User-edited sale descriptions/notes survive unless that source field changed.
    if (!previo || previo.concepto !== costo.concepto) actualizada.descripcion = costo.concepto;
    if (!previo || previo.unidad_medida !== costo.unidad_medida) actualizada.unidad_medida = costo.unidad_medida;
    if (previo?.notas !== costo.notas) actualizada.notas = costo.notas;
    result.push(actualizada);
  }
  const vinculados = new Set(result.map(v => v.origen_costo_id).filter(Boolean));
  const nuevos = costos.filter(c => !c.venta_vinculo_pendiente && !vinculados.has(c.origen_venta_id ?? "") && !previas.get(c.origen_venta_id)?.concepto.trim() && c.concepto.trim());
  const generated = buildConceptosFromCostos(nuevos, tasaIva);
  result.push(...generated.usd, ...generated.mxn);
  return { usd: result.filter(v => v.moneda === "USD"), mxn: result.filter(v => v.moneda === "MXN") };
}
