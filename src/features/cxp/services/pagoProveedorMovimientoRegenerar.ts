/**
 * Regeneración del movimiento bancario faltante de un pago a proveedor
 * (v13.495.0).
 *
 * Contexto: si el INSERT en `bbva_movimientos` fallaba al registrar el pago
 * (p. ej. porque el rol aún no tenía permiso de escritura en tesorería), el
 * pago quedaba guardado pero sin su movimiento espejo y la conciliación lo
 * reportaba como "Sin movimiento en banco". Esta RPC vuelve a crearlo sin
 * tener que borrar y recapturar el pago.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

/** Devuelve el id del movimiento bancario creado. Lanza si la RPC rechaza. */
export async function regenerarMovimientoPagoProveedor(pagoId: string): Promise<string> {
  const { data, error } = await supabase.rpc("regenerar_movimiento_pago_proveedor", {
    p_pago_id: pagoId,
  });
  if (error) throw error;

  const movimientoId = typeof data === "string" ? data : "";
  await registrarActividad({
    modulo: "tesoreria",
    accion: "regenerar_movimiento_bancario_pago",
    entidadId: pagoId,
    detalles: { movimientoId },
  });
  return movimientoId;
}
