/**
 * v13.446.x — Ola 4 · N36: dedupe genérico por hash (archivo o XML) del
 * buzón CxP + cleanup best-effort de storage cuando un insert/update falla.
 * Vive aparte para mantener bajo el tamaño de facturasEntrantesUpload.ts.
 */
import { supabase } from "@/integrations/supabase/client";
import { BUCKET_CXP_INBOX } from "@/features/cxp/services/facturasEntrantes.types";

/**
 * v13.414.0 — Evita gemelos en el buzón: si ya hay un documento vivo con el
 * mismo hash (archivo principal o XML) en la organización, no se crea/adjunta
 * otro renglón.
 */
export async function validarNoDuplicadoEnBuzon(
  hash: string,
  organizationId: string,
  columna: "archivo_hash" | "xml_hash" = "archivo_hash",
): Promise<void> {
  const { data, error } = await supabase
    .from("embarque_facturas_entrantes")
    .select("estado")
    .eq("organization_id", organizationId)
    .eq(columna, hash)
    .is("deleted_at", null)
    .limit(1);
  if (error || !data || data.length === 0) return;
  const esXml = columna === "xml_hash";
  throw new Error(
    data[0].estado === "capturada"
      ? esXml
        ? "Este XML ya fue capturado como factura de proveedor. Búscala en Compras › Facturas."
        : "Este archivo ya fue capturado como factura de proveedor. Búscala en Compras › Facturas."
      : esXml
        ? "Este XML ya está en el buzón esperando captura. Abre el documento existente en vez de subirlo otra vez."
        : "Este archivo ya está en el buzón esperando captura. Abre el documento existente en vez de subirlo otra vez.",
  );
}

/**
 * N36 (Ola 4): sin este cleanup, los archivos ya subidos a cxp-inbox
 * quedaban huérfanos (sin renglón que los referencie) ante cualquier fallo
 * del insert/update posterior (duplicado por carrera, RLS, red).
 */
export async function limpiarArchivosHuerfanos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage.from(BUCKET_CXP_INBOX).remove(paths).catch(() => undefined);
}
