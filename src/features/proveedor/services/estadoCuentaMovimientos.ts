/**
 * Ola 2 — Lectura del estado de cuenta cronológico del proveedor.
 * Consume la RPC `public.proveedor_estado_cuenta_movimientos`.
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import type { EstadoCuentaMovimientos } from "@/features/proveedor/domain/movimientosProveedor";

const VACIO: EstadoCuentaMovimientos = { movimientos: [], aging: [], saldos: [] };

export async function fetchProveedorMovimientos(
  proveedorId: string,
  desde?: string,
  hasta?: string,
): Promise<EstadoCuentaMovimientos> {
  if (!proveedorId) return VACIO;
  const { data, error } = await supabase.rpc("proveedor_estado_cuenta_movimientos", {
    p_proveedor_id: proveedorId,
    p_desde: desde || null,
    p_hasta: hasta || null,
  });
  if (error) throw error;
  const parsed = fromDb<EstadoCuentaMovimientos | null>(data);
  return {
    movimientos: parsed?.movimientos ?? [],
    aging: parsed?.aging ?? [],
    saldos: parsed?.saldos ?? [],
  };
}
