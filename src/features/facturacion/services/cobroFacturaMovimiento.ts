/**
 * Movimiento bancario derivado de un cobro de factura de venta.
 *
 * Ola v17 — PUNTO ÚNICO DE ESCRITURA: el abono lo crea la RPC
 * `asegurar_movimiento_cobro_factura`, idempotente (`ON CONFLICT`) y
 * fail-closed en moneda (sin tipo de cambio no abona). Antes se insertaba
 * directo desde el navegador con un "consulta y luego inserta" no atómico, y
 * cualquier fallo se descartaba en silencio: el cobro quedaba guardado y el
 * saldo del banco nunca subía.
 *
 * Ya NO se traga el error: el llamador recibe el motivo para avisar al usuario.
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/observability/logger";

export interface ResultadoMovimientoCobro {
  /** `true` si el abono quedó registrado en el banco. */
  ok: boolean;
  /** Motivo cuando no se creó (`ya_existe`, `sin_cuenta_bancaria`, error de BD…). */
  motivo?: string;
  movimientoId?: string;
}

interface RespuestaRpc {
  creado?: boolean;
  motivo?: string;
  movimiento_id?: string;
}

/**
 * Registra el abono bancario del cobro. Idempotente: si ya existe devuelve
 * `ok: false` con motivo `ya_existe` (no duplica dinero en el banco).
 */
export async function crearMovimientoBancarioCobro(
  pagoId: string,
): Promise<ResultadoMovimientoCobro> {
  const { data, error } = await supabase.rpc("asegurar_movimiento_cobro_factura", {
    p_pago_id: pagoId,
  });
  if (error) {
    logger.warn("Cobro no abonado al banco", { pagoId, error: error.message });
    return { ok: false, motivo: error.message };
  }
  // SAFE-CAST: contrato jsonb de la RPC (creado / motivo / movimiento_id).
  const res = (data ?? {}) as RespuestaRpc;
  return {
    ok: res.creado === true,
    motivo: res.motivo,
    movimientoId: res.movimiento_id,
  };
}
