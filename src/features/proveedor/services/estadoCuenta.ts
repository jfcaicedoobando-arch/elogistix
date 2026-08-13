/**
 * Lectura del estado de cuenta conciliado de un proveedor (Ola 1).
 * Consume la RPC `public.proveedor_estado_cuenta`, que cruza
 * `conceptos_costo` ↔ `proveedor_facturas_conceptos` ↔ `pagos_proveedor`.
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import type { EstadoCuentaProveedor } from "@/features/proveedor/domain/estadoCuentaProveedor";

const VACIO: EstadoCuentaProveedor = { partidas: [], facturas_huerfanas: [] };

export async function fetchProveedorEstadoCuenta(
  proveedorId: string,
): Promise<EstadoCuentaProveedor> {
  if (!proveedorId) return VACIO;
  const { data, error } = await supabase.rpc("proveedor_estado_cuenta", {
    p_proveedor_id: proveedorId,
  });
  if (error) throw error;
  const parsed = fromDb<EstadoCuentaProveedor | null>(data);
  return {
    partidas: parsed?.partidas ?? [],
    facturas_huerfanas: parsed?.facturas_huerfanas ?? [],
  };
}
