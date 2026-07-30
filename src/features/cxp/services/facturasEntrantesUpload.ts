/**
 * v13.361.2 — Subida de archivos del buzón de facturas de proveedor
 * (PDF + XML del mismo CFDI). Extraído de `facturasEntrantes.ts`.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  rutaArchivoEntrante,
  validarParejaEntrante,
} from "@/lib/domain/facturasEntrantes";
import type { CfdiXmlMeta } from "@/lib/domain/cfdiXmlMeta";
import {
  columnasMetaEntrante,
  columnasXmlEntrante,
  type ArchivoSubido,
} from "@/features/cxp/services/facturasEntrantesFila";
import {
  BUCKET_CXP_INBOX,
  mensajeDuplicadoEntrante,
  type SubirFacturaEntranteInput,
} from "@/features/cxp/services/facturasEntrantes.types";

async function calcularHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function subirArchivo(
  file: File,
  input: Pick<SubirFacturaEntranteInput, "organizationId" | "embarqueId">,
): Promise<ArchivoSubido> {
  const hash = await calcularHash(file);
  const path = rutaArchivoEntrante({
    organizationId: input.organizationId,
    embarqueId: input.embarqueId,
    hash,
    nombreArchivo: file.name,
  });
  const { error } = await supabase.storage
    .from(BUCKET_CXP_INBOX)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw error;
  return { path, hash, nombre: file.name };
}

/** Arma el renglón a insertar; aísla el mapeo para mantener baja la complejidad. */
function filaEntranteAInsertar(params: {
  input: SubirFacturaEntranteInput;
  principal: ArchivoSubido;
  xmlSubido: ArchivoSubido | null;
  userId: string | null;
}) {
  const { input, principal, xmlSubido, userId } = params;
  return {
    embarque_id: input.embarqueId,
    organization_id: input.organizationId,
    archivo_path: principal.path,
    archivo_hash: principal.hash,
    nombre_archivo: principal.nombre,
    ...columnasXmlEntrante({ soloXml: !input.pdf, principal, xmlSubido }),
    ...columnasMetaEntrante(input.meta),
    nota: input.nota?.trim() || null,
    proveedor_id: input.proveedorId ?? null,
    subido_por: userId,
  };
}

export async function subirFacturaEntrante(input: SubirFacturaEntranteInput): Promise<string> {
  const invalido = validarParejaEntrante({ pdf: input.pdf, xml: input.xml });
  if (invalido) throw new Error(invalido);

  // El registro principal apunta al PDF cuando existe; si sólo hay XML, a él.
  const principal = await subirArchivo((input.pdf ?? input.xml) as File, input);
  const xmlSubido = input.pdf && input.xml ? await subirArchivo(input.xml, input) : null;

  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("embarque_facturas_entrantes")
    .insert(filaEntranteAInsertar({
      input,
      principal,
      xmlSubido,
      userId: userData?.user?.id ?? null,
    }))
    .select("id")
    .single();
  if (error) {
    const duplicado = mensajeDuplicadoEntrante(`${error.message} ${error.details ?? ""}`);
    if (duplicado) throw new Error(duplicado);
    throw error;
  }
  return data.id;
}

/** Completa un documento existente adjuntándole el XML que faltaba. */
export async function adjuntarXmlFacturaEntrante(params: {
  id: string;
  xml: File;
  meta: CfdiXmlMeta | null;
  embarqueId: string;
  organizationId: string;
}): Promise<void> {
  const subido = await subirArchivo(params.xml, {
    embarqueId: params.embarqueId,
    organizationId: params.organizationId,
  });
  const { error } = await supabase
    .from("embarque_facturas_entrantes")
    .update({
      xml_path: subido.path,
      xml_nombre: subido.nombre,
      xml_hash: subido.hash,
      uuid_fiscal: params.meta?.uuid ?? null,
      rfc_emisor: params.meta?.rfcEmisor ?? null,
      folio_serie: params.meta?.folioSerie ?? null,
      fecha_emision: params.meta?.fechaEmision ?? null,
      total_detectado: params.meta?.total ?? null,
      moneda_detectada: params.meta?.moneda ?? null,
    })
    .eq("id", params.id);
  if (error) {
    const duplicado = mensajeDuplicadoEntrante(`${error.message} ${error.details ?? ""}`);
    throw duplicado ? new Error(duplicado) : error;
  }
}
