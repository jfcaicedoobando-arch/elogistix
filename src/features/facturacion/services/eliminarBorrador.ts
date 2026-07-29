/**
 * eliminarFacturaBorrador — llama al RPC `eliminar_factura_borrador` que
 * borra un borrador (estado = 'Borrador', sin `facturapi_id`) y revierte
 * las proformas asociadas a estado `pendiente` sin `factura_id`. La RPC
 * valida permisos (admin_org / contador / super_admin), tenancy y bitácora.
 */
import { supabase } from "@/integrations/supabase/client";

export async function eliminarFacturaBorrador(facturaId: string): Promise<void> {
  const { error } = await supabase.rpc("eliminar_factura_borrador", {
    p_factura_id: facturaId,
  });
  if (error) throw error;
}

