/**
 * Helpers puros de reconciliación de costos por renglón — sin Supabase.
 * Extraídos de `reconciliacionCostos.ts` para respetar el techo Power of 10.
 */

export interface FacturaVinculada {
  proveedor_factura_id: string;
  folio_proveedor: string;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  estatus_pago: string | null;
  descripcion: string | null;
  monto: number;
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
    folio_proveedor: string;
    fecha_emision?: string | null;
    fecha_vencimiento?: string | null;
    estado?: string | null;
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

export function buildFilasReconciliacion(
  conceptos: CCRow[],
  vinculos: PFCRow[],
): FilaReconciliacion[] {
  const porConcepto = new Map<string, FacturaVinculada[]>();
  for (const v of vinculos) {
    if (!v.concepto_costo_id || !v.proveedor_facturas || v.proveedor_facturas.deleted_at) continue;
    const arr = porConcepto.get(v.concepto_costo_id) ?? [];
    arr.push({
      proveedor_factura_id: v.proveedor_facturas.id,
      folio_proveedor: v.proveedor_facturas.folio_proveedor,
      fecha_emision: v.proveedor_facturas.fecha_emision ?? null,
      descripcion: v.descripcion ?? null,
      monto: Number(v.monto) || 0,
    });
    porConcepto.set(v.concepto_costo_id, arr);
  }
  return conceptos.map((c) => {
    const facs = porConcepto.get(c.id) ?? [];
    const real = facs.reduce((s, f) => s + f.monto, 0);
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
      estatus_renglon: clasificarRenglon(cotizado, real, facs.length > 0),
      facturas: facs,
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
