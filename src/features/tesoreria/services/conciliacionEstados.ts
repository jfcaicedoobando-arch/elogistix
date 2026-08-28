/**
 * Transiciones de estado de un movimiento bancario (desconciliar / ignorar).
 * Extraído de `conciliacion.ts` para respetar el límite de 200 líneas.
 */
import { supabase } from "@/integrations/supabase/client";
import { run } from "@/lib/supabase/response";
import { mapConciliacionError, MovimientoVinculoError } from "./conciliacionErrors";
import {
  bitacoraDesconciliarMovimiento,
  bitacoraIgnorarMovimiento,
} from "./conciliacionBitacora";

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
  // N4: la BD sólo permite Pendiente → Ignorado. Si el movimiento ya está
  // conciliado hay que desconciliarlo primero; el error se traduce a dominio.
  const { error } = await supabase
    .from("bbva_movimientos")
    .update({ estado_conciliacion: "Ignorado", motivo_ignorar: motivo })
    .eq("id", movId)
    .is("deleted_at", null);
  if (error) {
    if (error.message?.includes("LC_MOVIMIENTO_TRANSICION_INVALIDA")) {
      throw new MovimientoVinculoError(
        "LC_MOVIMIENTO_TRANSICION_INVALIDA",
        "Este movimiento ya está conciliado. Desconcílialo antes de marcarlo como ignorado.",
      );
    }
    mapConciliacionError(error);
  }
  await bitacoraIgnorarMovimiento(movId, motivo);
}
