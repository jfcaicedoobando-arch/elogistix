/**
 * Service de conciliación bancaria.
 * - importarMovimientos: upsert por (cuenta_id, hash_dedupe). Reporta nuevas vs duplicadas.
 * - listarMovimientos: filtrado por cuenta + estado.
 * - conciliarConPago / desconciliar: vincular un movimiento a pago_factura o pago_proveedor.
 * - ignorarMovimiento: marcar como Ignorado con motivo.
 * - sugerirCandidatos: matching por monto (±$1) y fecha (±5 días) contra CxC/CxP pendientes.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { MovimientoParseado } from "@/features/tesoreria/domain/import/bbva";
import { unwrapOr } from "@/lib/supabase/response";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";
import {
  bitacoraImportarMovimientos,
} from "./conciliacionBitacora";

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

export interface ImportarResultado {
  total: number;
  nuevos: number;
  duplicados: number;
}

export async function importarMovimientos(
  cuentaBancariaId: string,
  movimientos: MovimientoParseado[],
  userId: string | null,
): Promise<ImportarResultado> {
  if (movimientos.length === 0) return { total: 0, nuevos: 0, duplicados: 0 };
  const payload: TablesInsert<"bbva_movimientos">[] = movimientos.map((m) => ({
    cuenta_bancaria_id: cuentaBancariaId,
    fecha: m.fecha,
    concepto: m.concepto,
    referencia: m.referencia,
    cargo: m.cargo,
    abono: m.abono,
    saldo: m.saldo,
    hash_dedupe: m.hash_dedupe,
    importado_por: userId,
  }));
  // Ola 11 · RNF-11: el UNIQUE pasó a índice parcial (sólo vivos,
  // uq_bbva_movimientos_hash_dedupe_vivo) y un índice parcial no sirve de
  // árbitro para ON CONFLICT vía PostgREST. Se deduplica contra los hashes
  // VIVOS y se inserta el resto; un hash en papelera ya NO bloquea la
  // re-importación. Una carrera entre importaciones simultáneas sigue
  // protegida por el índice (23505 → error visible, no duplicado silencioso).
  const hashes = payload.map((p) => p.hash_dedupe as string);
  const existentes = await unwrapOr(
    supabase
      .from("bbva_movimientos")
      .select("hash_dedupe")
      .eq("cuenta_bancaria_id", cuentaBancariaId)
      .is("deleted_at", null)
      .in("hash_dedupe", hashes),
    [] as { hash_dedupe: string }[],
  );
  const vistos = new Set(existentes.map((e) => e.hash_dedupe));
  const nuevosPayload = payload.filter((p) => !vistos.has(p.hash_dedupe as string));
  const data =
    nuevosPayload.length === 0
      ? []
      : await unwrapOr(
          supabase.from("bbva_movimientos").insert(nuevosPayload).select("id"),
          [] as { id: string }[],
        );
  const nuevos = data.length;
  const duplicados = movimientos.length - nuevos;
  await bitacoraImportarMovimientos(cuentaBancariaId, movimientos.length, nuevos, duplicados);
  return { total: movimientos.length, nuevos, duplicados };
}

export interface FiltrosMovimientos {
  cuenta_bancaria_id: string;
  estado?: "Pendiente" | "Conciliado" | "Ignorado" | "todos";
  desde?: string;
  hasta?: string;
}

// v13.56.1 — Columnas explícitas (evita SELECT * en tabla financiera grande).
const BBVA_MOVIMIENTO_COLUMNS =
  "id, organization_id, cuenta_bancaria_id, fecha, concepto, referencia, cargo, abono, saldo, hash_dedupe, estado_conciliacion, pago_factura_id, pago_proveedor_id, pago_proveedor_lote_id, anticipo_proveedor_id, motivo_ignorar, conciliado_por, conciliado_at, importado_por, importado_en";

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

export { sugerirCandidatos,  } from "./sugerirCandidatos";

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
