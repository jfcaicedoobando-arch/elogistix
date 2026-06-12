/**
 * Conciliación cotizado vs real por embarque (Fase 2).
 *
 * Trae los `conceptos_costo` del embarque y la suma de
 * `proveedor_facturas_conceptos` vinculados a cada uno. La aritmética
 * (diferencias y % desviación) vive en una función pura para poder testearse
 * sin tocar Supabase y para respetar la regla "centralizar matemática".
 */
import { supabase } from "@/integrations/supabase/client";

export interface FacturaVinculada {
  proveedor_factura_id: string;
  folio_proveedor: string;
  monto: number;
}

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

interface PFCRow {
  monto: number | string;
  concepto_costo_id: string | null;
  proveedor_facturas: {
    id: string;
    folio_proveedor: string;
    deleted_at: string | null;
  } | null;
}

interface CCRow {
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

export async function fetchReconciliacionEmbarque(
  embarqueId: string,
): Promise<FilaReconciliacion[]> {
  if (!embarqueId) return [];
  const { data: cc, error: errCc } = await supabase
    .from("conceptos_costo")
    .select("id, concepto, proveedor_nombre, moneda, monto, estado_liquidacion")
    .eq("embarque_id", embarqueId)
    .is("deleted_at", null);
  if (errCc) throw errCc;
  const conceptos = (cc ?? []) as unknown as CCRow[];
  if (conceptos.length === 0) return [];

  const ids = conceptos.map((c) => c.id);
  const { data: pfc, error: errPfc } = await supabase
    .from("proveedor_facturas_conceptos")
    .select("monto, concepto_costo_id, proveedor_facturas(id, folio_proveedor, deleted_at)")
    .in("concepto_costo_id", ids);
  if (errPfc) throw errPfc;
  // SAFE-CAST: shape modelado por PFCRow a partir del select con embed.
  return buildFilasReconciliacion(conceptos, (pfc ?? []) as unknown as PFCRow[]);
}
