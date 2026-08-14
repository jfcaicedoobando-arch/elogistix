/**
 * Baja atómica de un pago a proveedor (Ola 15).
 * Extraído de `pagosProveedor.ts` para respetar el límite de 200 líneas.
 */
import { supabase } from "@/integrations/supabase/client";

/** Resultado de la baja atómica de un pago a proveedor. */
export interface EliminarPagoProveedorResult {
  movimientosBaja: number;
  movimientosDesvinculados: number;
  costosRecalculados: number;
  yaEliminado: boolean;
}

/**
 * Ola 15: baja del pago + movimiento bancario + recálculo de costos + bitácora
 * en una sola transacción (`eliminar_pago_proveedor`). Los movimientos que
 * vinieron del estado de cuenta importado no se borran: se desvinculan y
 * regresan a "Pendiente" de conciliación.
 */
export async function eliminarPagoProveedor(
  id: string,
  _facturaId: string,
  _userId: string | null,
): Promise<EliminarPagoProveedorResult> {
  const { data, error } = await supabase.rpc("eliminar_pago_proveedor", { _pago_id: id });
  if (error) throw error;
  const res = (data ?? {}) as {
    movimientos_baja?: number;
    movimientos_desvinculados?: number;
    costos_recalculados?: number;
    ya_eliminado?: boolean;
  };
  return {
    movimientosBaja: res.movimientos_baja ?? 0,
    movimientosDesvinculados: res.movimientos_desvinculados ?? 0,
    costosRecalculados: res.costos_recalculados ?? 0,
    yaEliminado: res.ya_eliminado === true,
  };
}
