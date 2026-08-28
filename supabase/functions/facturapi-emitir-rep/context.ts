/**
 * Helpers de contexto para facturapi-emitir-rep.
 * Extraídos para mantener el handler bajo el límite de líneas por función.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ParcialidadInfo {
  numParcialidad: number;
  saldoAnt: number;
  impPagado: number;
  saldoInsoluto: number;
}

export function calcularParcialidad(
  pagosPrev: Array<{ id: string; monto_aplicado_factura: number | null }> | null,
  pagoId: string,
  totalFactura: number,
  montoAplicado: number,
  /** N1 — notas de crédito aplicadas antes de este pago, en moneda del DR. */
  ncAplicadas = 0,
): ParcialidadInfo {
  let acumuladoAntes = 0;
  let numParcialidad = 1;
  for (const pp of pagosPrev ?? []) {
    if (pp.id === pagoId) break;
    acumuladoAntes += Number(pp.monto_aplicado_factura ?? 0);
    numParcialidad += 1;
  }
  const saldoAnt = round2(totalFactura - acumuladoAntes - Number(ncAplicadas ?? 0));
  const impPagado = Number(montoAplicado ?? 0);
  return { numParcialidad, saldoAnt, impPagado, saldoInsoluto: round2(saldoAnt - impPagado) };
}

export interface RefsEmbarque {
  expediente: string | null;
  bl_master: string | null;
  bl_house: string | null;
}

export async function resolverReferenciasEmbarque(
  supabase: SupabaseClient,
  factura: { expediente?: string | null; referencia_bl?: string | null; embarque_id?: string | null },
): Promise<RefsEmbarque> {
  const refs: RefsEmbarque = {
    expediente: factura.expediente ?? null,
    bl_master: null,
    bl_house: factura.referencia_bl ?? null,
  };
  if (!factura.embarque_id) return refs;
  const { data: emb } = await supabase
    .from("embarques")
    .select("expediente, bl_master, bl_house")
    .eq("id", factura.embarque_id)
    .maybeSingle();
  if (emb) {
    refs.expediente = (emb as { expediente?: string | null }).expediente ?? refs.expediente;
    refs.bl_master = (emb as { bl_master?: string | null }).bl_master ?? null;
    refs.bl_house = (emb as { bl_house?: string | null }).bl_house ?? refs.bl_house;
  }
  return refs;
}

/**
 * Tasas del catálogo SAT c_TasaOCuota aplicables a traslado de IVA.
 * El factor "Exento" no lleva tasa: lo resuelve `factorIvaFacturaOriginal`.
 */
const TASAS_IVA_SAT: readonly number[] = [0, 0.08, 0.16];

/**
 * Tasa de IVA del CFDI relacionado, derivada de la proporción impuesto/base y
 * anclada al catálogo c_TasaOCuota del SAT (R3P-20). El CFDI original ya está
 * timbrado, así que su tasa efectiva sólo puede estar a centavos de una tasa
 * del catálogo: se elige la MÁS CERCANA en vez de umbrales fijos (que mandaban
 * p.ej. 0.1199 → 8% siendo 16% por redondeo de centavos). Desempate hacia la
 * tasa mayor (punto medio 0.12 → 16%, conservando el comportamiento anterior).
 *
 * Limitación documentada: con mezcla de tasas/exentos en la misma factura la
 * tasa efectiva es un promedio ponderado (p.ej. 0.10) y se ancla a la del
 * catálogo más cercana (0.08); el desglose por renglón requiere agrupar
 * `conceptos_factura` por `tipo_iva/tasa_iva_aplicada` (pendiente R3P-18/19).
 */
export function tasaIvaFacturaOriginal(subtotal: number, iva: number): number {
  if (!(subtotal > 0) || !(iva > 0)) return 0;
  const efectiva = iva / subtotal;
  let mejor = 0;
  let distancia = Number.POSITIVE_INFINITY;
  for (const tasa of TASAS_IVA_SAT) {
    const d = Math.abs(efectiva - tasa);
    // Tolerancia por aritmética de punto flotante: en el punto medio exacto
    // (0.12) el desempate debe ir hacia la tasa mayor (16%).
    if (d <= distancia + 1e-9) {
      distancia = d;
      mejor = tasa;
    }
  }
  return mejor;
}

/**
 * Factor de IVA del CFDI original. Si la factura trae IVA > 0 es `Tasa`.
 * Si no trae IVA, se revisa el `tipo_iva` de sus conceptos: cuando todos son
 * exentos se declara `Exento`; en cualquier otro caso `Tasa` (0%).
 */
export function factorIvaFacturaOriginal(
  tasaIva: number,
  tiposIvaConceptos: Array<string | null | undefined> | null | undefined,
): "Tasa" | "Exento" {
  if (tasaIva > 0) return "Tasa";
  const tipos = (tiposIvaConceptos ?? [])
    .map((t) => String(t ?? "").trim().toLowerCase())
    .filter((t) => t.length > 0);
  if (tipos.length === 0) return "Tasa";
  return tipos.every((t) => t === "exento") ? "Exento" : "Tasa";
}
