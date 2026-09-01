/**
 * Ola P2 seguridad — Autorización y validación de ruta ANTES de tocar Storage
 * con `service_role` en `adjuntar-xml-entrante`.
 *
 * Antes la función sólo validaba el JWT y que el `xml_path` no tuviera "..":
 * cualquier sesión autenticada podía forzar la descarga (con llave de servicio)
 * de cualquier objeto del bucket `cxp-inbox`, incluidos los de otra
 * organización, y usar el mensaje de error como oráculo de existencia.
 *
 * Reglas: el documento debe existir, pertenecer a la organización efectiva del
 * actor, estar `por_capturar` y el `xml_path` debe caer exactamente en el
 * prefijo canónico del buzón para ese documento:
 * `{organization_id}/{embarque_id}/…` (ver `rutaArchivoEntrante` en el cliente).
 */

/** Prefijo canónico del buzón CxP para un documento. */
export function prefijoCanonico(organizationId: string, embarqueId: string): string {
  return `${organizationId}/${embarqueId}/`;
}

/**
 * ¿El path pertenece al documento indicado? Exige prefijo canónico exacto,
 * un solo nivel de archivo y prohíbe traversal o rutas absolutas.
 */
export function pathPerteneceAlDocumento(
  xmlPath: string,
  organizationId: string,
  embarqueId: string,
): boolean {
  if (!xmlPath || xmlPath.includes("..") || xmlPath.startsWith("/") || xmlPath.includes("\\")) {
    return false;
  }
  const prefijo = prefijoCanonico(organizationId, embarqueId);
  if (!xmlPath.startsWith(prefijo)) return false;
  const resto = xmlPath.slice(prefijo.length);
  return resto.length > 0 && !resto.includes("/");
}

export interface DocumentoBuzon {
  id: string;
  organization_id: string;
  embarque_id: string;
  estado: string;
}

/** Motivos de rechazo; ninguno revela existencia ni rutas de otra organización. */
export type MotivoRechazo = "no_encontrado" | "estado_invalido" | "path_invalido";

/**
 * Valida el documento ya leído de BD contra la organización del actor y el
 * path solicitado. Puro y testeable (sin I/O).
 */
export function validarDocumento(params: {
  documento: DocumentoBuzon | null;
  orgActor: string;
  xmlPath: string;
}): { ok: true } | { ok: false; motivo: MotivoRechazo } {
  const doc = params.documento;
  // Mismo motivo para "no existe" y "es de otra organización": sin oráculo.
  if (!doc || doc.organization_id !== params.orgActor) return { ok: false, motivo: "no_encontrado" };
  if (doc.estado !== "por_capturar") return { ok: false, motivo: "estado_invalido" };
  if (!pathPerteneceAlDocumento(params.xmlPath, doc.organization_id, doc.embarque_id)) {
    return { ok: false, motivo: "path_invalido" };
  }
  return { ok: true };
}

/** Mensaje y status (en español, sin detalles internos) por motivo. */
export function respuestaRechazo(motivo: MotivoRechazo): { status: number; mensaje: string } {
  if (motivo === "estado_invalido") {
    return { status: 409, mensaje: "LC_ESTADO_INVALIDO: el documento ya fue capturado o rechazado" };
  }
  if (motivo === "path_invalido") {
    return { status: 400, mensaje: "LC_XML_PATH_INVALIDO: el archivo no corresponde a este documento" };
  }
  return { status: 404, mensaje: "LC_NO_ENCONTRADO: el documento del buzón no existe" };
}
