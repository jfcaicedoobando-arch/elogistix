/**
 * Captura de factura de proveedor a partir de un documento del buzón CxP.
 *
 * v13.366.0 — Antes de abrir el formulario se consulta la puerta de validación
 * `validar_captura_entrante` (rol, organización, estado y CFDI duplicado), y el
 * archivo del buzón se descarga como `File` para reutilizar los parsers
 * existentes (`parse-cfdi-xml` / `parse-invoice-pdf`).
 */
import { supabase } from "@/integrations/supabase/client";
import { BUCKET_CXP_INBOX } from "@/features/cxp/services/facturasEntrantes.types";

export interface DocumentoValidado {
  id: string;
  embarque_id: string;
  estado: string;
  uuid_fiscal: string | null;
  rfc_emisor: string | null;
  folio_detectado: string | null;
  fecha_emision: string | null;
  total_detectado: number | null;
  moneda_detectada: string | null;
  archivo_path: string;
  xml_path: string | null;
  nombre_archivo: string;
}

export interface FacturaDuplicadaEntrante {
  id: string;
  folio_interno: string | null;
  folio_proveedor: string | null;
  proveedor_nombre: string | null;
  estado: string | null;
}

export interface ValidacionCapturaEntrante {
  ok: boolean;
  codigo: string;
  motivos: string[];
  documento: DocumentoValidado | null;
  proveedor: { id: string; nombre: string | null; rfc: string | null } | null;
  facturaDuplicada: FacturaDuplicadaEntrante | null;
}

interface RespuestaRpc {
  ok?: boolean;
  codigo?: string;
  motivos?: string[];
  documento?: DocumentoValidado | null;
  proveedor?: { id: string; nombre: string | null; rfc: string | null } | null;
  factura_duplicada?: FacturaDuplicadaEntrante | null;
}

/** Puerta de validación previa a la captura. Nunca lanza por reglas de negocio. */
export async function validarCapturaEntrante(
  documentoId: string,
): Promise<ValidacionCapturaEntrante> {
  const { data, error } = await supabase
    // SAFE-CAST: los tipos generados se regeneran tras la migración; el RPC ya existe.
    .rpc("validar_captura_entrante" as never, { p_documento_id: documentoId } as never);
  if (error) throw error;
  const res = (data ?? {}) as RespuestaRpc;
  return {
    ok: res.ok === true,
    codigo: res.codigo ?? "LC_VALIDACION",
    motivos: Array.isArray(res.motivos) ? res.motivos : [],
    documento: res.documento ?? null,
    proveedor: res.proveedor ?? null,
    facturaDuplicada: res.factura_duplicada ?? null,
  };
}

/** Descarga un archivo del buzón como `File` para pasarlo a los parsers. */
export async function descargarArchivoEntranteComoFile(
  path: string,
  nombre: string,
): Promise<File> {
  const { data, error } = await supabase.storage.from(BUCKET_CXP_INBOX).download(path);
  if (error) throw error;
  const tipo = path.toLowerCase().endsWith(".xml") ? "text/xml" : "application/pdf";
  return new File([data], nombre, { type: tipo });
}
