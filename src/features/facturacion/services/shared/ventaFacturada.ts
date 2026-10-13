/**
 * AUD-ANALISIS-8 — Fuente única de la VENTA de un embarque: facturas timbradas
 * vigentes (sin IVA) menos sus notas de crédito timbradas (sin IVA). Un
 * embarque sin factura vigente no aporta venta (0).
 *
 * Devuelve filas con forma de "concepto de venta" para que los cálculos
 * existentes (Utilidad, Cierre mensual, Tablero de dirección) no cambien:
 * - Con TC de la factura → una fila en MXN (`venta_mxn`).
 * - Sin TC confiable → la fila queda en su moneda original, y el canon de
 *   conversión la marca como "sin TC" en vez de inventar pesos.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchInChunks } from "@/lib/supabase/chunkedIn";
import { conAbortSignal } from "@/lib/supabase/paginadoPorClave";

export interface VentaFacturadaRow {
  embarque_id: string;
  descripcion: string;
  total: number;
  moneda: string;
}

export const DESCRIPCION_VENTA_FACTURADA = "Venta facturada";

export async function fetchVentaFacturadaEmbarques(
  ids: readonly string[],
  signal?: AbortSignal,
): Promise<VentaFacturadaRow[]> {
  return fetchInChunks(ids, async (lote) => {
    signal?.throwIfAborted();
    const { data, error } = await conAbortSignal(supabase.rpc("venta_facturada_embarques", {
      p_embarque_ids: lote,
    }), signal);
    signal?.throwIfAborted();
    if (error) throw error;
    return (data ?? []).map((r) => {
      const conTc = r.venta_mxn !== null && r.venta_mxn !== undefined;
      return {
        embarque_id: r.embarque_id,
        descripcion: DESCRIPCION_VENTA_FACTURADA,
        total: Number(conTc ? r.venta_mxn : r.venta_doc) || 0,
        moneda: conTc ? "MXN" : r.moneda,
      };
    });
  });
}
