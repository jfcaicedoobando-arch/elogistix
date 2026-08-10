/**
 * v13.361.2 — Subida de archivos del buzón de facturas de proveedor
 * (PDF + XML del mismo CFDI). Extraído de `facturasEntrantes.ts`.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";
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
import {
  validarNoDuplicadoEnBuzon,
  limpiarArchivosHuerfanos,
} from "@/features/cxp/services/facturasEntrantesDedupe";

async function calcularHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * v13.419.0 — Traduce fallos de almacenamiento (RLS/permisos) a lenguaje claro.
 */
function mensajeErrorStorage(error: { message?: string } | null): string | null {
  const msg = (error?.message ?? "").toLowerCase();
  if (!msg) return null;
  if (msg.includes("row-level security") || msg.includes("unauthorized") || msg.includes("permission")) {
    return "No tienes permiso para guardar archivos en el buzón de este embarque. Verifica que el embarque pertenezca a tu organización y que tu rol permita subir facturas.";
  }
  return null;
}

async function subirArchivo(
  file: File,
  input: Pick<SubirFacturaEntranteInput, "organizationId" | "embarqueId">,
  hashPrevio?: string,
): Promise<ArchivoSubido> {
  const hash = hashPrevio ?? (await calcularHash(file));
  const path = rutaArchivoEntrante({
    organizationId: input.organizationId,
    embarqueId: input.embarqueId,
    hash,
    nombreArchivo: file.name,
  });
  const { error } = await supabase.storage
    .from(BUCKET_CXP_INBOX)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) {
    const amable = mensajeErrorStorage(error);
    throw amable ? new Error(amable) : error;
  }
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
  // v13.419.0 — Se valida el duplicado ANTES de subir: así el usuario ve el
  // mensaje claro del buzón en vez de un error técnico del almacenamiento.
  const archivoPrincipal = (input.pdf ?? input.xml) as File;
  const hashPrincipal = await calcularHash(archivoPrincipal);
  await validarNoDuplicadoEnBuzon(hashPrincipal, input.organizationId);

  // N36 (Ola 4): el XML acompañante también se deduplica (antes nunca se
  // validaba su hash y podía acompañar varios documentos).
  const hashXmlAcompanante = input.pdf && input.xml ? await calcularHash(input.xml) : null;
  if (hashXmlAcompanante) {
    await validarNoDuplicadoEnBuzon(hashXmlAcompanante, input.organizationId, "xml_hash");
  }

  const principal = await subirArchivo(archivoPrincipal, input, hashPrincipal);
  const xmlSubido = input.pdf && input.xml
    ? await subirArchivo(input.xml, input, hashXmlAcompanante ?? undefined)
    : null;

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
    // N36 (Ola 4): cleanup — evita huérfanos en cxp-inbox si el insert falla.
    await limpiarArchivosHuerfanos([principal.path, ...(xmlSubido ? [xmlSubido.path] : [])]);
    const duplicado = mensajeDuplicadoEntrante(`${error.message} ${error.details ?? ""}`);
    if (duplicado) throw new Error(duplicado);
    throw error;
  }
  await registrarActividad({
    modulo: "cxp",
    accion: "subir_factura_entrante",
    entidadId: data.id,
    entidadNombre: archivoPrincipal.name,
  });
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
  // N36 (Ola 4): deduplicar el XML ANTES de subirlo (mismo hash vivo en otro
  // documento del buzón → rechazar con mensaje claro).
  const hashXml = await calcularHash(params.xml);
  await validarNoDuplicadoEnBuzon(hashXml, params.organizationId, "xml_hash");
  const subido = await subirArchivo(params.xml, {
    embarqueId: params.embarqueId,
    organizationId: params.organizationId,
  }, hashXml);
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
    // N36 (Ola 4): cleanup del objeto subido si el update falla.
    await limpiarArchivosHuerfanos([subido.path]);
    const duplicado = mensajeDuplicadoEntrante(`${error.message} ${error.details ?? ""}`);
    throw duplicado ? new Error(duplicado) : error;
  }
  await registrarActividad({
    modulo: "cxp",
    accion: "adjuntar_xml_factura_entrante",
    entidadId: params.id,
    entidadNombre: subido.nombre,
  });
}
