/**
 * Cancela una factura de proveedor vía RPC `cancelar_factura_proveedor`.
 *
 * Reglas (aplicadas en la BD):
 *  - Motivo obligatorio.
 *  - Bloquea si tiene pagos activos (deben anularse primero).
 *  - Cancela automáticamente las NCs activas asociadas (revierte NC).
 *  - Marca la factura como `Cancelada` y guarda fecha/usuario/motivo.
 *  - Los triggers existentes recalcan `conceptos_costo.estado_liquidacion`.
 *
 * v13.189.0 · Ola 2 · Item 4
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

export async function cancelarFacturaProveedor(
  facturaId: string,
  motivo: string,
): Promise<void> {
  const trimmed = motivo.trim();
  if (!trimmed) throw new Error("Debes indicar un motivo de cancelación.");

  const { error } = await supabase.rpc("cancelar_factura_proveedor", {
    p_factura_id: facturaId,
    p_motivo: trimmed,
  });
  if (error) throw error;
  await registrarActividad({
    modulo: "cxp",
    accion: "cancelar",
    entidadId: facturaId,
    detalles: { motivo: trimmed },
  });
}
