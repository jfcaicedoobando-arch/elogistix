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

/** Normaliza la respuesta cruda de la RPC (evita `??` encadenados en el fetch). */
function normalizar(parsed: unknown): EstadoCuentaMovimientos {
  const p = parsed as Partial<EstadoCuentaMovimientos> | null;
  if (!p) return VACIO;
  const movimientos = p.movimientos ?? [];
  return {
    movimientos,
    aging: p.aging ?? [],
    saldos: p.saldos ?? [],
    total_movimientos: p.total_movimientos ?? movimientos.length,
    hay_mas: p.hay_mas ?? false,
  };
}

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
  return normalizar(fromDb(data ?? null, estadoCuentaMovimientosSchema));
}

