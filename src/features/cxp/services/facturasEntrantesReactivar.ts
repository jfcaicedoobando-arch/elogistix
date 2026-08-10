/**
 * Buzón CxP — devolver un documento rechazado a "Por capturar".
 *
 * Vive aparte de `facturasEntrantes.ts` por el límite Power of 10 de 200
 * líneas. La RPC valida rol, organización, estado y que no haya factura
 * de proveedor vinculada.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

export async function reactivarFacturaEntrante(documentoId: string, nombre?: string | null) {
  const { error } = await supabase.rpc("reactivar_factura_entrante", {
    p_documento_id: documentoId,
  });
  if (error) throw error;
  await registrarActividad({
    modulo: "cxp",
    accion: "Devolvió factura entrante a por capturar",
    entidadId: documentoId,
    entidadNombre: nombre ?? null,
  });
}
