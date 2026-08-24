/**
 * v13.361.2 — Subida de archivos del buzón de facturas de proveedor
 * (PDF + XML del mismo CFDI). Extraído de `facturasEntrantes.ts`.
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";
import { validarParejaEntrante } from "@/lib/domain/facturasEntrantes";
import type { CfdiXmlMeta } from "@/lib/domain/cfdiXmlMeta";
import {
  columnasMetaEntrante,
  columnasXmlEntrante,
  type ArchivoSubido,
} from "@/features/cxp/services/facturasEntrantesFila";
import {
  mensajeDuplicadoEntrante,
  type SubirFacturaEntranteInput,
} from "@/features/cxp/services/facturasEntrantes.types";
import {
  validarNoDuplicadoEnBuzon,
  esErrorUnicidad,
  limpiarArchivosHuerfanosSeguro,
} from "@/features/cxp/services/facturasEntrantesDedupe";
import {
  verificarYAdjuntarXmlEntrante,
  mensajeErrorAdjuntarXml,
} from "@/features/cxp/services/adjuntarXmlEntranteEdge";
import { guardarConceptosSugeridos } from "@/features/cxp/services/facturasEntrantesConceptos";
import {
  calcularHash,
  subirArchivoEntrante as subirArchivo,
} from "@/features/cxp/services/facturasEntrantesUploadHelpers";

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
    monto_declarado: input.montoDeclarado ?? null,
    sin_costo_capturado: Boolean(input.sinCostoCapturado),
    moneda_declarada: input.montoDeclarado != null ? (input.monedaDeclarada ?? "MXN") : null,
    proveedor_id: input.proveedorId ?? null,
    subido_por: userId,
  };
}

/**
 * Limpieza + traducción común de errores al guardar el renglón del buzón:
 * con 23505 (unicidad) NO se borra el objeto — el path es content-addressed y
 * lo referencia la fila ganadora de la carrera. Para otros errores se limpian
 * sólo los paths sin fila viva. Devuelve el error listo para lanzar.
 */
async function errorGuardadoEntrante(
  error: { message: string; details?: string | null },
  paths: string[],
  organizationId: string,
): Promise<Error | typeof error> {
  if (!esErrorUnicidad(error)) {
    await limpiarArchivosHuerfanosSeguro(paths, organizationId);
  }
  const duplicado = mensajeDuplicadoEntrante(`${error.message} ${error.details ?? ""}`);
  return duplicado ? new Error(duplicado) : error;
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
    throw await errorGuardadoEntrante(
      error,
      [principal.path, ...(xmlSubido ? [xmlSubido.path] : [])],
      input.organizationId,
    );
  }
  const sugerenciasOk = await guardarConceptosSugeridos(data.id, input);
  if (!sugerenciasOk) {
    // RNF-09: rastro auditable del fallo; el usuario ya recibió el aviso y el
    // documento queda subido de todos modos.
    await registrarActividad({
      modulo: "cxp",
      accion: "conceptos_sugeridos_no_guardados",
      entidadId: data.id,
      entidadNombre: archivoPrincipal.name,
    });
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
