/**
 * Captura y rechazo de documentos del buzón CxP (contabilidad).
 *
 * Se separó de `facturasEntrantes.ts` para respetar el límite de 200 líneas
 * (Power of 10). Ambas acciones pasan por RPCs que validan rol y organización.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";

/**
 * Nombre legible del documento del buzón para la bitácora. Nunca lanza: el
 * registro es accesorio y no debe tumbar la captura/rechazo de la factura.
 */
async function folioDocumentoEntrante(documentoId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("embarque_facturas_entrantes")
      .select("folio_detectado, nombre_archivo")
      .eq("id", documentoId)
      .maybeSingle();
    return data?.folio_detectado ?? data?.nombre_archivo ?? null;
  } catch {
    return null;
  }
}

export async function rechazarFacturaEntrante(documentoId: string, motivo: string) {
  const folio = await folioDocumentoEntrante(documentoId);
  const { error } = await supabase.rpc("rechazar_factura_entrante", {
    p_documento_id: documentoId,
    p_motivo: motivo,
  });
  if (error) throw error;
  await registrarActividad({
    modulo: "cxp",
    accion: "Rechazó factura entrante",
    entidadId: documentoId,
    entidadNombre: folio,
    detalles: { motivo },
  });
}

export async function capturarFacturaEntrante(documentoId: string, facturaId: string) {
  const folio = await folioDocumentoEntrante(documentoId);
  const { error } = await supabase.rpc("capturar_factura_entrante", {
    p_documento_id: documentoId,
    p_factura_id: facturaId,
  });
  if (error) throw error;
  await registrarActividad({
    modulo: "cxp",
    accion: "Capturó factura entrante",
    entidadId: facturaId,
    entidadNombre: folio,
    detalles: { documento_id: documentoId },
  });
}
