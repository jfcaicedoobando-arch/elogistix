/**
 * Cotizaciones — mapeos costos↔filas del P&L de detalle.
 *
 * Extraído de `SeccionCostosInternosPLDetalle.tsx` (v13.823.165) para poder
 * reutilizar el MISMO mapeo en dos momentos: al hidratar desde la lectura de BD
 * y al renovar las filas con los costos canónicos que devuelve la RPC tras un
 * guardado exitoso. Antes sólo existía dentro del efecto de hidratación.
 */
import type { CostoCotizacion, ConceptoVentaCotizacion, FilaCostoDetalle } from "@/features/cotizacion/types";
// O3/A-5: match costos↔conceptos sólo por nombre normalizado (sin fallback posicional).
import { matchConceptoVenta } from "@/features/cotizacion/utils/matchConceptoVenta";

/**
 * Costos persistidos → filas editables.
 *
 * v13.823.165 (P1, criterio 2): se preservan `unidad_medida`,
 * `costeo_tarifa_id` y `costeo_tarifa_recargo_id` por fila. El guardado borra y
 * reinserta; al omitirlos, editar sólo una nota borraba el vínculo con la
 * tarifa de costeo que usa la revalidación de precios.
 */
export function mapearCostosAFilas(
  costos: CostoCotizacion[],
  conceptosUSD: ConceptoVentaCotizacion[],
  conceptosMXN: ConceptoVentaCotizacion[],
): FilaCostoDetalle[] {
  return costos.map((c) => {
    // Fuente única de venta: el `precio_venta` persistido en el costo. El match
    // por nombre queda sólo como respaldo para filas legacy sin `precio_venta`.
    const ventaCosto = (Number(c.precio_venta) || 0) * (Number(c.cantidad) || 0);
    const cv = matchConceptoVenta(c.moneda === "USD" ? conceptosUSD : conceptosMXN, c.concepto);
    const venta = ventaCosto > 0 ? ventaCosto : (cv ? cv.cantidad * cv.precio_unitario : 0);
    return {
      concepto: c.concepto,
      moneda: c.moneda,
      proveedor: c.proveedor,
      cantidad: c.cantidad,
      costo_unitario: c.costo_unitario,
      venta,
      aplica_iva: c.moneda === "USD" ? (cv?.aplica_iva ?? false) : false,
      notas: c.notas ?? "",
      unidad_medida: c.unidad_medida,
      costeo_tarifa_id: c.costeo_tarifa_id ?? null,
      costeo_tarifa_recargo_id: c.costeo_tarifa_recargo_id ?? null,
    };
  });
}

/** Cotización sin costos capturados: se siembran filas desde los conceptos de venta. */
export function mapearConceptosAFilas(
  conceptosUSD: ConceptoVentaCotizacion[],
  conceptosMXN: ConceptoVentaCotizacion[],
): FilaCostoDetalle[] {
  const fromUSD: FilaCostoDetalle[] = conceptosUSD.map((c) => ({
    concepto: c.descripcion, moneda: "USD" as const, proveedor: "", cantidad: c.cantidad,
    costo_unitario: 0, venta: c.cantidad * c.precio_unitario, aplica_iva: c.aplica_iva ?? false, notas: "",
  }));
  const fromMXN: FilaCostoDetalle[] = conceptosMXN.map((c) => ({
    concepto: c.descripcion, moneda: "MXN" as const, proveedor: "", cantidad: c.cantidad,
    costo_unitario: 0, venta: c.cantidad * c.precio_unitario, notas: "",
  }));
  return [...fromUSD, ...fromMXN];
}

/** Filas editables → payload de la RPC de reemplazo, conservando metadatos. */
export function mapearFilasACostos(
  cotizacionId: string,
  filas: FilaCostoDetalle[],
): CostoCotizacion[] {
  return filas.map((f) => ({
    id: "", cotizacion_id: cotizacionId, concepto: f.concepto, moneda: f.moneda,
    proveedor: f.proveedor, cantidad: f.cantidad, costo_unitario: f.costo_unitario,
    costo_total: f.cantidad * f.costo_unitario,
    // B-081: el upsert borra y reinserta; sin esto se perdía el precio de venta.
    precio_venta: f.cantidad > 0 ? f.venta / f.cantidad : f.venta,
    notas: f.notas ?? "",
    unidad_medida: f.unidad_medida,
    // B-073: vínculo con tarifa/recargo de costeo — se reenvía tal cual llegó.
    costeo_tarifa_id: f.costeo_tarifa_id ?? null,
    costeo_tarifa_recargo_id: f.costeo_tarifa_recargo_id ?? null,
    created_at: "", updated_at: "",
  }));
}
