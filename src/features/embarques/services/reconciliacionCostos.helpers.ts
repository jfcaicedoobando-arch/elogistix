/**
 * Helpers puros de reconciliación de costos por renglón — sin Supabase.
 * Extraídos de `reconciliacionCostos.ts` para respetar el techo Power of 10.
 */

export interface FacturaVinculada {
  proveedor_factura_id: string;
  /** Folio interno de Libre Carga (FP-XXXXXX); es el que se busca en el sistema. */
  folio_interno: string | null;
  folio_proveedor: string;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  estatus_pago: string | null;
  descripcion: string | null;
  /** Monto YA convertido a la moneda del concepto de costo. 0 si `excluida`. */
  monto: number;
  /** MNY-NEW-03: monto tal como viene en la factura del proveedor. */
  monto_original?: number;
  /** Moneda de la factura del proveedor. */
  moneda?: string | null;
  /** true = no comparable (moneda distinta sin tipo de cambio); no suma. */
  excluida?: boolean;
  motivo_exclusion?: string | null;
}

export type EstatusRenglon = "sin_match" | "parcial" | "conciliado" | "excedente";

/** Tolerancia relativa para clasificar Conciliado (±1%). */
export const TOLERANCIA_CONCILIACION = 0.01;

export interface FilaReconciliacion {
  concepto_costo_id: string;
  concepto: string;
  proveedor_nombre: string;
  moneda: string;
  cotizado: number;
  real_facturado: number;
  diferencia: number;
  /** Positivo = nos pasamos del costo cotizado; negativo = ahorro. En %. */
  desviacion_pct: number;
  estado_liquidacion: string;
  estatus_renglon: EstatusRenglon;
  facturas: FacturaVinculada[];
  /** MNY-NEW-03: vínculos no comparables por moneda/TC faltante. */
  vinculos_excluidos?: number;
}

export interface ResumenReconciliacion {
  total_cotizado: number;
  total_real: number;
  diferencia_total: number;
  desviacion_pct_total: number;
  /** Líneas todavía sin ninguna factura proveedor vinculada. */
  conceptos_sin_factura: number;
}

export interface ResumenPorEstatus {
  sin_match: number;
  parcial: number;
  conciliado: number;
  excedente: number;
}

export interface ResumenPorMoneda {
  moneda: string;
  cotizado: number;
  real: number;
  diferencia: number;
  desviacion_pct: number;
}

export interface PFCRow {
  monto: number | string;
  concepto_costo_id: string | null;
  descripcion?: string | null;
  proveedor_facturas: {
    id: string;
    folio_interno?: string | null;
    folio_proveedor: string;
    fecha_emision?: string | null;
    fecha_vencimiento?: string | null;
    estado?: string | null;
    moneda?: string | null;
    tipo_cambio_usd?: number | string | null;
    deleted_at: string | null;
  } | null;
}

export interface CCRow {
  id: string;
  concepto: string;
  proveedor_nombre: string;
  moneda: string;
  monto: number | string;
  estado_liquidacion: string;
}

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

export function calcularResumen(filas: FilaReconciliacion[]): ResumenReconciliacion {
  let cot = 0, real = 0, sinFac = 0;
  for (const f of filas) {
    cot += f.cotizado;
    real += f.real_facturado;
    if (f.facturas.length === 0) sinFac += 1;
  }
  return {
    total_cotizado: cot,
    total_real: real,
    diferencia_total: real - cot,
    desviacion_pct_total: calcularDesviacionPct(cot, real),
    conceptos_sin_factura: sinFac,
  };
}

export function calcularResumenPorEstatus(filas: FilaReconciliacion[]): ResumenPorEstatus {
  const r: ResumenPorEstatus = { sin_match: 0, parcial: 0, conciliado: 0, excedente: 0 };
  for (const f of filas) r[f.estatus_renglon] += 1;
  return r;
}

/** Totales agrupados por moneda (los montos de distintas monedas no se suman). */
export function calcularResumenPorMoneda(filas: FilaReconciliacion[]): ResumenPorMoneda[] {
  const map = new Map<string, ResumenPorMoneda>();
  for (const f of filas) {
    const cur = map.get(f.moneda) ?? {
      moneda: f.moneda, cotizado: 0, real: 0, diferencia: 0, desviacion_pct: 0,
    };
    cur.cotizado += f.cotizado;
    cur.real += f.real_facturado;
    map.set(f.moneda, cur);
  }
  return Array.from(map.values()).map((m) => ({
    ...m,
    diferencia: m.real - m.cotizado,
    desviacion_pct: calcularDesviacionPct(m.cotizado, m.real),
  }));
}
