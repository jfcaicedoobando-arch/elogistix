/**
 * Service de conciliación bancaria.
 * - importarMovimientos: upsert por (cuenta_id, hash_dedupe). Reporta nuevas vs duplicadas.
 * - listarMovimientos: filtrado por cuenta + estado.
 * - conciliarConPago / desconciliar: vincular un movimiento a pago_factura o pago_proveedor.
 * - ignorarMovimiento: marcar como Ignorado con motivo.
 * - sugerirCandidatos: matching por monto (±$1) y fecha (±5 días) contra CxC/CxP pendientes.
 */
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { MovimientoParseado } from "@/features/tesoreria/domain/import/bbva";
import { unwrapOr, run } from "@/lib/supabase/response";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";
import {
  bitacoraImportarMovimientos,
  bitacoraConciliarMovimiento,
  bitacoraDesconciliarMovimiento,
  bitacoraIgnorarMovimiento,
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
  // upsert: si ya existe por (cuenta_bancaria_id, hash_dedupe), ignora
  const data = await unwrapOr(
    supabase
      .from("bbva_movimientos")
      .upsert(payload, {
        onConflict: "cuenta_bancaria_id,hash_dedupe",
        ignoreDuplicates: true,
      })
      .select("id"),
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
import { mapConciliacionError } from "./conciliacionErrors";


export async function conciliarConPago(
  movId: string,
  tipo: "cxc" | "cxp",
  pagoId: string,
  userId: string | null,
) {
  const patch = tipo === "cxc"
    ? { pago_factura_id: pagoId, pago_proveedor_id: null }
    : { pago_proveedor_id: pagoId, pago_factura_id: null };
  const { error } = await supabase
    .from("bbva_movimientos")
    .update({
      ...patch,
      estado_conciliacion: "Conciliado",
      conciliado_por: userId,
      conciliado_at: new Date().toISOString(),
    })
    .eq("id", movId)
    .is("deleted_at", null);
  if (error) {
    reportCaughtError(error, {
      feature: "tesoreria",
      op: "conciliacion.failed",
      tipo,
    }, { pgCode: error.code ?? "unknown", movId, pagoId });
    mapConciliacionError(error);
  }
  await bitacoraConciliarMovimiento(movId, tipo, pagoId);
}


export async function desconciliarMovimiento(movId: string) {
  await run(
    supabase
      .from("bbva_movimientos")
      .update({
        pago_factura_id: null,
        pago_proveedor_id: null,
        estado_conciliacion: "Pendiente",
        conciliado_por: null,
        conciliado_at: null,
      })
      .eq("id", movId)
      .is("deleted_at", null),
  );
  await bitacoraDesconciliarMovimiento(movId);
}

export async function ignorarMovimiento(movId: string, motivo: string) {
  await run(
    supabase
      .from("bbva_movimientos")
      .update({ estado_conciliacion: "Ignorado", motivo_ignorar: motivo })
      .eq("id", movId)
      .is("deleted_at", null),
  );
  await bitacoraIgnorarMovimiento(movId, motivo);
}

export {
  registrarMovimientoManual,
  esMovimientoManual,
  eliminarMovimientoManual,
  type MovimientoManualPayload,
} from "./conciliacionManual";
