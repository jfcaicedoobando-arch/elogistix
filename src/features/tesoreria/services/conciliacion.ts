/**
 * Service de conciliación bancaria.
 * - importarMovimientos: upsert por (cuenta_id, hash_dedupe). Reporta nuevas vs duplicadas.
 * - listarMovimientos: filtrado por cuenta + estado.
 * - conciliarConPago / desconciliar: vincular un movimiento a pago_factura o pago_proveedor.
 * - ignorarMovimiento: marcar como Ignorado con motivo.
 * - sugerirCandidatos: matching por monto (±$1) y fecha (±5 días) contra CxC/CxP pendientes.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { unwrapOr } from "@/lib/supabase/response";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";

export type MovimientoBBVA = Tables<"bbva_movimientos">;

/** Shape del jsonb de `conciliacion_resumen` (C3c). */
export interface ConciliacionResumen {
  total_movimientos: number;
  pendientes: number;
  conciliados: number;
  ignorados: number;
  cargos_pendientes: number;
  abonos_pendientes: number;
}

/**
 * FIX C3c (S6-05): conteos y totales por estado calculados en SQL, sobre el
 * universo completo de movimientos de la cuenta (la tabla sigue paginada).
 */
export async function fetchConciliacionResumen(
  cuentaBancariaId: string,
): Promise<ConciliacionResumen> {
  const { data, error } = await supabase.rpc("conciliacion_resumen", {
    p_cuenta_bancaria_id: cuentaBancariaId,
  });
  if (error) throw error;
  // SAFE-CAST: jsonb con el shape de la migración C3c.
  return data as unknown as ConciliacionResumen;
}

export {
  importarMovimientos,
  ImportacionParcialError,
  type ImportarResultado,
} from "./conciliacionImportar";

export interface FiltrosMovimientos {
  cuenta_bancaria_id: string;
  estado?: "Pendiente" | "Conciliado" | "Ignorado" | "todos";
  desde?: string;
  hasta?: string;
}

// v13.56.1 — Columnas explícitas (evita SELECT * en tabla financiera grande).
const BBVA_MOVIMIENTO_COLUMNS =
  // MNY-01: `pago_factura_lote_id` es necesario para abrir el detalle de un
  // depósito de cliente que cubre varias facturas (cobro en lote).
  "id, organization_id, cuenta_bancaria_id, fecha, concepto, referencia, cargo, abono, saldo, hash_dedupe, estado_conciliacion, pago_factura_id, pago_factura_lote_id, pago_proveedor_id, pago_proveedor_lote_id, anticipo_proveedor_id, motivo_ignorar, conciliado_por, conciliado_at, importado_por, importado_en";

// FIX C3 (S6-05): bbva_movimientos es append-only; es la primera tabla que
// supera 1000 filas en una org activa.
const LIMITE_MOVIMIENTOS = 2000;

export async function listarMovimientos(f: FiltrosMovimientos): Promise<MovimientoBBVA[]> {
  let q = supabase
    .from("bbva_movimientos")
    .select(BBVA_MOVIMIENTO_COLUMNS)
    .eq("cuenta_bancaria_id", f.cuenta_bancaria_id)
    .is("deleted_at", null)
    .order("fecha", { ascending: false })
    .limit(LIMITE_MOVIMIENTOS);
  if (f.estado && f.estado !== "todos") q = q.eq("estado_conciliacion", f.estado);
  if (f.desde) q = q.gte("fecha", f.desde);
  if (f.hasta) q = q.lte("fecha", f.hasta);
  const filas = (await unwrapOr(q, [] as MovimientoBBVA[])) as MovimientoBBVA[];
  return assertNotTruncated(filas, LIMITE_MOVIMIENTOS, "tesoreria.listarMovimientos");
}

export { sugerirCandidatos, sugerirCandidatosDetalle } from "./sugerirCandidatos";

export { MovimientoVinculoError } from "./conciliacionErrors";


export { conciliarConPago } from "./conciliacionVincular";

export {
  desconciliarMovimiento,
  ignorarMovimiento,
} from "./conciliacionEstados";

export {
  registrarMovimientoManual,
  esMovimientoManual,
  eliminarMovimientoManual,
  type MovimientoManualPayload,
} from "./conciliacionManual";
