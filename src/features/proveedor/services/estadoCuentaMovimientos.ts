/**
 * Ola 2 — Lectura del estado de cuenta cronológico del proveedor.
 * Consume la RPC `public.proveedor_estado_cuenta_movimientos`.
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import type { EstadoCuentaMovimientos } from "@/features/proveedor/domain/movimientosProveedor";
import { estadoCuentaMovimientosSchema } from "./readSchemas";

const VACIO: EstadoCuentaMovimientos = {
  movimientos: [], aging: [], saldos: [], total_movimientos: 0, hay_mas: false,
};

/** R3FE-04: tope defensivo por consulta (el server capea en 5000). */
export const LIMITE_MOVIMIENTOS_ESTADO_CUENTA = 1000;

export async function fetchProveedorMovimientos(
  proveedorId: string,
  desde?: string,
  hasta?: string,
  limite: number = LIMITE_MOVIMIENTOS_ESTADO_CUENTA,
  offset = 0,
): Promise<EstadoCuentaMovimientos> {
  if (!proveedorId) return VACIO;
  const { data, error } = await supabase.rpc("proveedor_estado_cuenta_movimientos", {
    p_proveedor_id: proveedorId,
    p_desde: desde || undefined,
    p_hasta: hasta || undefined,
    p_limite: limite,
    p_offset: offset,
  });
  if (error) throw error;
  const parsed = fromDb(data ?? null, estadoCuentaMovimientosSchema);
  return {
    movimientos: parsed?.movimientos ?? [],
    aging: parsed?.aging ?? [],
    saldos: parsed?.saldos ?? [],
    total_movimientos: parsed?.total_movimientos ?? parsed?.movimientos?.length ?? 0,
    hay_mas: parsed?.hay_mas ?? false,
  };
}
