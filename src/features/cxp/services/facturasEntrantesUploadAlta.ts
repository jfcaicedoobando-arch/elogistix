/**
 * Helpers del alta en el buzón de facturas entrantes (CxP).
 *
 * Extraído de `facturasEntrantesUpload.ts` para respetar el límite de 200
 * líneas por archivo (Power-of-10 #4).
 */
import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";
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
import {
  calcularHash,
  subirArchivoEntrante as subirArchivo,
} from "@/features/cxp/services/facturasEntrantesUploadHelpers";

/** Arma el renglón a insertar; aísla el mapeo para mantener baja la complejidad. */
export function filaEntranteAInsertar(params: {
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
export async function errorGuardadoEntrante(
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

/**
 * FIX3 · M-6 (BUG-18) extendido al ALTA INICIAL: los metadatos fiscales del
 * INSERT quedan sellados server-side como NO verificados. Aquí replicamos el
 * flujo de "adjuntar XML posterior": la edge descarga el XML, verifica su hash,
 * lo re-parsea y REEMPLAZA los metadatos con los del servidor (marcándolos como
 * verificados). Si algo no cuadra, se avisa al usuario y queda rastro.
 */
export async function verificarMetadatosDelAlta(params: {
  documentoId: string;
  organizationId: string;
  xml: ArchivoSubido | null;
  meta: CfdiXmlMeta | null;
  nombreArchivo: string;
}): Promise<void> {
  if (!params.xml) return;
  const error = await verificarYAdjuntarXmlEntrante({
    documentoId: params.documentoId,
    xmlPath: params.xml.path,
    xmlNombre: params.xml.nombre,
    xmlHash: params.xml.hash,
    meta: params.meta,
  });
  if (!error) return;
  await registrarActividad({
    modulo: "cxp",
    accion: "verificacion_xml_entrante_fallida",
    entidadId: params.documentoId,
    entidadNombre: params.nombreArchivo,
  });
  throw new Error(
    mensajeErrorAdjuntarXml(`${error.message} ${error.details ?? ""}`),
  );
}

/**
 * Deduplica y sube los archivos del buzón (PDF y/o XML) antes de tocar la BD.
 * Extraído de `subirFacturaEntrante` para respetar el límite de complejidad.
 */
export async function subirArchivosDelBuzon(input: SubirFacturaEntranteInput): Promise<{
  archivoPrincipal: File;
  principal: ArchivoSubido;
  xmlSubido: ArchivoSubido | null;
}> {
  // El registro principal apunta al PDF cuando existe; si sólo hay XML, a él.
  // v13.419.0 — Se valida el duplicado ANTES de subir: así el usuario ve el
  // mensaje claro del buzón en vez de un error técnico del almacenamiento.
  const archivoPrincipal = (input.pdf ?? input.xml) as File;
  const hashPrincipal = await calcularHash(archivoPrincipal);
  // v13.819.2 — se pasa el UUID fiscal y el embarque en curso para que la RPC
  // pueda decir DÓNDE quedó el duplicado (este embarque, otro, o Compras).
  const ctxDuplicado = {
    uuidFiscal: input.meta?.uuid ?? null,
    embarqueId: input.embarqueId,
  };
  await validarNoDuplicadoEnBuzon(
    hashPrincipal,
    input.organizationId,
    "archivo_hash",
    ctxDuplicado,
  );

  // N36 (Ola 4): el XML acompañante también se deduplica (antes nunca se
  // validaba su hash y podía acompañar varios documentos).
  const hashXmlAcompanante = input.pdf && input.xml ? await calcularHash(input.xml) : null;
  if (hashXmlAcompanante) {
    await validarNoDuplicadoEnBuzon(
      hashXmlAcompanante,
      input.organizationId,
      "xml_hash",
      ctxDuplicado,
    );
  }


  const principal = await subirArchivo(archivoPrincipal, input, hashPrincipal);
  const xmlSubido = input.pdf && input.xml
    ? await subirArchivo(input.xml, input, hashXmlAcompanante ?? undefined)
    : null;
  return { archivoPrincipal, principal, xmlSubido };
}

/** Inserta el renglón del buzón y traduce los errores de guardado. */
export async function insertarFilaEntrante(params: {
  input: SubirFacturaEntranteInput;
  principal: ArchivoSubido;
  xmlSubido: ArchivoSubido | null;
}): Promise<string> {
  const { input, principal, xmlSubido } = params;
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
  return data.id;
}

