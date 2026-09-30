/**
 * eliminarFacturaBorrador — llama al RPC `eliminar_factura_borrador` que
 * da de baja un borrador sin emisión registrada/pendiente y libera
 * las proformas asociadas sólo si no tienen otra factura activa. La RPC
 * valida permisos (admin_org / contador / super_admin), tenancy y bitácora.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

export async function eliminarFacturaBorrador(facturaId: string): Promise<void> {
  const { error } = await supabase.rpc("eliminar_factura_borrador", {
    p_factura_id: facturaId,
  });
  if (error) throw error;
  await registrarActividad({
    modulo: "facturacion",
    accion: "eliminar_factura_borrador",
    entidadId: facturaId,
  });
}
