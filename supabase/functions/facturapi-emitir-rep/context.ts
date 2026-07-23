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
): ParcialidadInfo {
  let acumuladoAntes = 0;
  let numParcialidad = 1;
  for (const pp of pagosPrev ?? []) {
    if (pp.id === pagoId) break;
    acumuladoAntes += Number(pp.monto_aplicado_factura ?? 0);
    numParcialidad += 1;
  }
  const saldoAnt = round2(totalFactura - acumuladoAntes);
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

export function tasaIvaFacturaOriginal(subtotal: number, iva: number): number {
  const tasa = subtotal > 0 ? iva / subtotal : 0;
  if (tasa < 0.02) return 0;
  if (tasa < 0.12) return 0.08;
  return 0.16;
}
