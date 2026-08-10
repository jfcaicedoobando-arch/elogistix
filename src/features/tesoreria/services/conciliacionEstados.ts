/**
 * Transiciones de estado de un movimiento bancario (desconciliar / ignorar).
 * Extraído de `conciliacion.ts` para respetar el límite de 200 líneas.
 */
import { supabase } from "@/integrations/supabase/client";
import { run } from "@/lib/supabase/response";
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
  await run(
    supabase
      .from("bbva_movimientos")
      .update({ estado_conciliacion: "Ignorado", motivo_ignorar: motivo })
      .eq("id", movId)
      .is("deleted_at", null),
  );
  await bitacoraIgnorarMovimiento(movId, motivo);
}
