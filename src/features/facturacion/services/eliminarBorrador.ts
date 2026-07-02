/**
 * eliminarFacturaBorrador — llama al RPC `eliminar_factura_borrador` que
 * borra un borrador (estado = 'Borrador', sin `facturapi_id`) y revierte
 * las proformas asociadas a estado `pendiente` sin `factura_id`. La RPC
 * valida permisos (admin_org / contador / super_admin), tenancy y bitácora.
 */
import { supabase } from "@/integrations/supabase/client";

export async function eliminarFacturaBorrador(facturaId: string): Promise<void> {
  // SAFE-CAST: el RPC es nuevo (v13.146.0); los tipos generados aún no lo listan.
  const { error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>)(
    "eliminar_factura_borrador",
    { p_factura_id: facturaId },
  );
  if (error) throw error;
}
