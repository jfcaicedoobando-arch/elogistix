/**
 * v13.361.2 — Subida de archivos del buzón de facturas de proveedor
 * (PDF + XML del mismo CFDI). Extraído de `facturasEntrantes.ts`.
 */
import { registrarActividad } from "@/services/bitacora/registrar";
import { validarParejaEntrante } from "@/lib/domain/facturasEntrantes";
import type { CfdiXmlMeta } from "@/lib/domain/cfdiXmlMeta";
import type { SubirFacturaEntranteInput } from "@/features/cxp/services/facturasEntrantes.types";
import { validarNoDuplicadoEnBuzon } from "@/features/cxp/services/facturasEntrantesDedupe";
import { verificarYAdjuntarXmlEntrante } from "@/features/cxp/services/adjuntarXmlEntranteEdge";
import { guardarConceptosSugeridos } from "@/features/cxp/services/facturasEntrantesConceptos";
import {
  calcularHash,
  subirArchivoEntrante as subirArchivo,
} from "@/features/cxp/services/facturasEntrantesUploadHelpers";
import {
  errorGuardadoEntrante,
  insertarFilaEntrante,
  subirArchivosDelBuzon,
  verificarMetadatosDelAlta,
} from "@/features/cxp/services/facturasEntrantesUploadAlta";

export async function subirFacturaEntrante(input: SubirFacturaEntranteInput): Promise<string> {
  const invalido = validarParejaEntrante({ pdf: input.pdf, xml: input.xml });
  if (invalido) throw new Error(invalido);

  const { archivoPrincipal, principal, xmlSubido } = await subirArchivosDelBuzon(input);
  const documentoId = await insertarFilaEntrante({ input, principal, xmlSubido });

  const sugerenciasOk = await guardarConceptosSugeridos(documentoId, input);
  if (!sugerenciasOk) {
    // RNF-09: rastro auditable del fallo; el usuario ya recibió el aviso y el
    // documento queda subido de todos modos.
    await registrarActividad({
      modulo: "cxp",
      accion: "conceptos_sugeridos_no_guardados",
      entidadId: documentoId,
      entidadNombre: archivoPrincipal.name,
    });
  }

  await verificarMetadatosDelAlta({
    documentoId,
    xml: xmlSubido ?? (input.xml && !input.pdf ? principal : null),
    meta: input.meta ?? null,
    nombreArchivo: archivoPrincipal.name,
  });
  await registrarActividad({
    modulo: "cxp",
    accion: "subir_factura_entrante",
    entidadId: documentoId,
    entidadNombre: archivoPrincipal.name,
  });
  return documentoId;

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
  await validarNoDuplicadoEnBuzon(hashXml, params.organizationId, "xml_hash", {
    uuidFiscal: params.meta?.uuid ?? null,
    embarqueId: params.embarqueId,
  });

  const subido = await subirArchivo(params.xml, {
    embarqueId: params.embarqueId,
    organizationId: params.organizationId,
  }, hashXml);
  // Ola 5 · O5.8 (BUG-18): los metadatos fiscales YA NO se escriben desde el
  // navegador. La edge function descarga el XML de Storage, verifica su hash,
  // lo re-parsea y compara contra lo declarado; si algo no cuadra rechaza con
  // LC_XML_METADATA_MISMATCH. La RPC de escritura sólo acepta service_role.
  const error = await verificarYAdjuntarXmlEntrante({
    documentoId: params.id,
    xmlPath: subido.path,
    xmlNombre: subido.nombre,
    xmlHash: subido.hash,
    meta: params.meta,
  });
  if (error) {
    // Ola 5 · RG4-7: mismo criterio que subirFacturaEntrante.
    throw await errorGuardadoEntrante(error, [subido.path], params.organizationId);
  }

  await registrarActividad({
    modulo: "cxp",
    accion: "adjuntar_xml_factura_entrante",
    entidadId: params.id,
    entidadNombre: subido.nombre,
  });
}
