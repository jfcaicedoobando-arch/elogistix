/**
 * Vinculación de un movimiento bancario con un pago (conciliación).
 *
 * Extraído de `conciliacion.ts` para respetar el límite de 200 líneas
 * (Power of 10).
 */
import { supabase } from "@/integrations/supabase/client";
import { reportCaughtError } from "@/services/observability/reportError";
import { bitacoraConciliarMovimiento } from "./conciliacionBitacora";
import { mapConciliacionError, MovimientoVinculoError } from "./conciliacionErrors";
import { conflictoConcurrenciaError } from "@/lib/errors/concurrencia";

export async function conciliarConPago(
  movId: string,
  tipo: "cxc" | "cxp",
  pagoId: string,
  userId: string | null,
) {
  // N15 (Ola 4): guard 409 previo — un pago sólo puede conciliarse con UN
  // movimiento vivo. El índice único parcial uq_bbva_movimientos_pago_* sigue
  // siendo la última línea de defensa ante una carrera de dos usuarios (su
  // 23505 ya se traduce en mapConciliacionError).
  const columnaPago = tipo === "cxc" ? "pago_factura_id" : "pago_proveedor_id";
  const { data: enUso } = await supabase
    .from("bbva_movimientos")
    .select("id")
    .eq(columnaPago, pagoId)
    .neq("id", movId)
    .is("deleted_at", null)
    .limit(1);
  if (enUso && enUso.length > 0) {
    throw new MovimientoVinculoError(
      "LC_MOVIMIENTO_YA_VINCULADO",
      "Este pago ya fue conciliado con otro movimiento bancario. Desconcilia ese movimiento antes de reasignar el pago.",
    );
  }
  const patch = tipo === "cxc"
    ? { pago_factura_id: pagoId, pago_proveedor_id: null }
    : { pago_proveedor_id: pagoId, pago_factura_id: null };
  // H5 (Ola 4): bloqueo optimista — sólo se concilia un movimiento que siga
  // pendiente. Si otro usuario lo concilió o lo ignoró mientras el modal estaba
  // abierto, no se pisa su decisión: se avisa y se pide recargar.
  const { count, error } = await supabase
    .from("bbva_movimientos")
    .update({
      ...patch,
      estado_conciliacion: "Conciliado",
      conciliado_por: userId,
      conciliado_at: new Date().toISOString(),
    })
    .eq("id", movId)
    .eq("estado_conciliacion", "Pendiente")
    .is("deleted_at", null)
    .select("id", { count: "exact" });
  if (!error && count === 0) {
    throw conflictoConcurrenciaError();
  }
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


