/**
 * Clasificación, conversión de moneda y armado de filas de reconciliación.
 */
import {
  TOLERANCIA_CONCILIACION,
  type CCRow,
  type EstatusRenglon,
  type FacturaVinculada,
  type FilaReconciliacion,
  type PFCRow,
} from "./reconciliacionCostos.tipos";

export function calcularDesviacionPct(cotizado: number, real: number): number {
  if (cotizado <= 0) return real > 0 ? 100 : 0;
  return ((real - cotizado) / cotizado) * 100;
}

/**
 * Clasifica un renglón cotizado según el monto realmente facturado por
 * proveedor. Umbral ±`TOLERANCIA_CONCILIACION` (1%) para absorber redondeo/IVA.
 */
export function clasificarRenglon(
  cotizado: number,
  real: number,
  tieneFacturas: boolean,
): EstatusRenglon {
  if (!tieneFacturas) return "sin_match";
  if (cotizado <= 0) return real > 0 ? "excedente" : "conciliado";
  const superior = cotizado * (1 + TOLERANCIA_CONCILIACION);
  const inferior = cotizado * (1 - TOLERANCIA_CONCILIACION);
  if (real > superior) return "excedente";
  if (real < inferior) return "parcial";
  return "conciliado";
}

/**
 * MNY-NEW-03 — convierte el monto vinculado (que está en la moneda de la
 * factura del proveedor) a la moneda del concepto de costo. Devuelve `null`
 * cuando no se puede convertir con certeza: nunca 1:1 silencioso.
 */
export function convertirMontoVinculo(
  monto: number,
  monedaFactura: string | null,
  monedaConcepto: string,
  tipoCambioUsd: number | null,
): number | null {
  const origen = (monedaFactura ?? "").trim().toUpperCase();
  const destino = (monedaConcepto ?? "").trim().toUpperCase();
  if (!origen || !destino) return null;
  if (origen === destino) return monto;
  const tc = tipoCambioUsd && tipoCambioUsd > 0 ? tipoCambioUsd : null;
  if (!tc) return null;
  if (origen === "USD" && destino === "MXN") return monto * tc;
  if (origen === "MXN" && destino === "USD") return monto / tc;
  return null;
}

function aVinculo(v: PFCRow, monedaConcepto: string): FacturaVinculada | null {
  const pf = v.proveedor_facturas;
  if (!pf) return null;
  const original = Number(v.monto) || 0;
  const monedaFactura = pf.moneda ?? null;
  const convertido = convertirMontoVinculo(
    original,
    monedaFactura,
    monedaConcepto,
    pf.tipo_cambio_usd == null ? null : Number(pf.tipo_cambio_usd),
  );
  return {
    proveedor_factura_id: pf.id,
    folio_interno: pf.folio_interno ?? null,
    folio_proveedor: pf.folio_proveedor,
    fecha_emision: pf.fecha_emision ?? null,
    fecha_vencimiento: pf.fecha_vencimiento ?? null,
    estatus_pago: pf.estado ?? null,
    descripcion: v.descripcion ?? null,
    monto: convertido ?? 0,
    monto_original: original,
    moneda: monedaFactura,
    excluida: convertido === null,
    motivo_exclusion:
      convertido === null
        ? `Moneda distinta (${monedaFactura ?? "sin moneda"} vs ${monedaConcepto}) sin tipo de cambio`
        : null,
  };
}

export function buildFilasReconciliacion(
  conceptos: CCRow[],
  vinculos: PFCRow[],
): FilaReconciliacion[] {
  const porConcepto = new Map<string, PFCRow[]>();
  for (const v of vinculos) {
    if (!v.concepto_costo_id || !v.proveedor_facturas || v.proveedor_facturas.deleted_at) continue;
    // v13.505.0 — una factura Cancelada (p. ej. cancelada ante el SAT) no
    // cuenta como facturada: el concepto vuelve a quedar "sin factura".
    if ((v.proveedor_facturas.estado ?? "").toLowerCase() === "cancelada") continue;
    const arr = porConcepto.get(v.concepto_costo_id) ?? [];
    arr.push(v);
    porConcepto.set(v.concepto_costo_id, arr);
  }
  return conceptos.map((c) => {
    const facs = (porConcepto.get(c.id) ?? [])
      .map((v) => aVinculo(v, c.moneda))
      .filter((f): f is FacturaVinculada => f !== null);
    const comparables = facs.filter((f) => !f.excluida);
    const excluidas = facs.length - comparables.length;
    const real = comparables.reduce((s, f) => s + f.monto, 0);
    const cotizado = Number(c.monto) || 0;
    const diferencia = real - cotizado;
    return {
      concepto_costo_id: c.id,
      concepto: c.concepto,
      proveedor_nombre: c.proveedor_nombre,
      moneda: c.moneda,
      cotizado,
      real_facturado: real,
      diferencia,
      desviacion_pct: calcularDesviacionPct(cotizado, real),
      estado_liquidacion: c.estado_liquidacion,
      estatus_renglon: clasificarRenglon(cotizado, real, comparables.length > 0),
      facturas: facs,
      vinculos_excluidos: excluidas,
    };
  });
}
