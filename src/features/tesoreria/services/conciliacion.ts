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

export type MovimientoBBVA = Tables<"bbva_movimientos">;

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
  return { total: movimientos.length, nuevos, duplicados: movimientos.length - nuevos };
}

export interface FiltrosMovimientos {
  cuenta_bancaria_id: string;
  estado?: "Pendiente" | "Conciliado" | "Ignorado" | "todos";
  desde?: string;
  hasta?: string;
}

// v13.56.1 — Columnas explícitas (evita SELECT * en tabla financiera grande).
const BBVA_MOVIMIENTO_COLUMNS =
  "id, organization_id, cuenta_bancaria_id, fecha, concepto, referencia, cargo, abono, saldo, hash_dedupe, estado_conciliacion, pago_factura_id, pago_proveedor_id, motivo_ignorar, conciliado_por, conciliado_at, importado_por, importado_en";

export async function listarMovimientos(f: FiltrosMovimientos): Promise<MovimientoBBVA[]> {
  let q = supabase
    .from("bbva_movimientos")
    .select(BBVA_MOVIMIENTO_COLUMNS)
    .eq("cuenta_bancaria_id", f.cuenta_bancaria_id)
    .order("fecha", { ascending: false })
    .limit(2000);
  if (f.estado && f.estado !== "todos") q = q.eq("estado_conciliacion", f.estado);
  if (f.desde) q = q.gte("fecha", f.desde);
  if (f.hasta) q = q.lte("fecha", f.hasta);
  return unwrapOr(q, [] as MovimientoBBVA[]) as Promise<MovimientoBBVA[]>;
}

export { sugerirCandidatos,  } from "./sugerirCandidatos";

/**
 * S.1 (N-1): errores tipados por la guarda de BD
 * `assert_movimiento_pago_consistente` que valida org/moneda/duplicidad.
 */
export class MovimientoVinculoError extends Error {
  constructor(
    public readonly code:
      | "LC_MOVIMIENTO_ORG_MISMATCH"
      | "LC_MOVIMIENTO_DIVISA_MISMATCH"
      | "LC_MOVIMIENTO_DOBLE_VINCULO"
      | "LC_MOVIMIENTO_PAGO_INEXISTENTE"
      | "LC_MOVIMIENTO_YA_VINCULADO",
    message: string,
  ) {
    super(message);
    this.name = "MovimientoVinculoError";
  }
}

function mapConciliacionError(err: { code?: string; message?: string } | null): never {
  const msg = err?.message ?? "";
  // Índices únicos parciales uq_bbva_movimientos_pago_{factura,proveedor}
  if (err?.code === "23505" && /uq_bbva_movimientos_pago_/.test(msg)) {
    throw new MovimientoVinculoError(
      "LC_MOVIMIENTO_YA_VINCULADO",
      "Este pago ya fue vinculado a otro movimiento bancario. Desconcilia el movimiento anterior antes de reasignarlo.",
    );
  }
  for (const code of [
    "LC_MOVIMIENTO_ORG_MISMATCH",
    "LC_MOVIMIENTO_DIVISA_MISMATCH",
    "LC_MOVIMIENTO_DOBLE_VINCULO",
    "LC_MOVIMIENTO_PAGO_INEXISTENTE",
  ] as const) {
    if (msg.includes(code)) {
      const detalle = msg.split(":").slice(1).join(":").trim() || msg;
      throw new MovimientoVinculoError(code, detalle);
    }
  }
  throw err as Error;
}

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
    .eq("id", movId);
  if (error) {
    reportCaughtError(error, {
      feature: "tesoreria",
      op: "conciliacion.failed",
      tipo,
    }, { pgCode: error.code ?? "unknown", movId, pagoId });
    mapConciliacionError(error);
  }
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
      .eq("id", movId),
  );
}

export async function ignorarMovimiento(movId: string, motivo: string) {
  await run(
    supabase
      .from("bbva_movimientos")
      .update({ estado_conciliacion: "Ignorado", motivo_ignorar: motivo })
      .eq("id", movId),
  );
}
