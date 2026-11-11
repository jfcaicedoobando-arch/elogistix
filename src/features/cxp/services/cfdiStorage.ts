import { supabase } from "@/integrations/supabase/client";
import { extractFacturaPath } from "@/services/storage/facturas";
import { resolverOrganizationId } from "@/features/cxp/services/cfdiOrg";
import {
  contentTypeFor,
  pathCfdi,
  validarContenidoCfdi,
  type TipoAdjuntoCfdi,
} from "@/features/cxp/services/cfdiValidation";

export type { TipoAdjuntoCfdi } from "@/features/cxp/services/cfdiValidation";

const columnasPorTipo = { XML: "archivo_xml_url", PDF: "archivo_pdf_url" } as const;
type ColumnaAdjunto = (typeof columnasPorTipo)[TipoAdjuntoCfdi];
type Adjuntos = Record<ColumnaAdjunto, string | null>;

interface DocumentoCfdi {
  tabla: "proveedor_facturas" | "proveedor_notas_credito";
  id: string;
  organizationId: string;
}

interface ArchivosCfdi {
  organizationId: string | null | undefined;
  xmlFile: File | null;
  pdfFile: File | null;
}

function rutaDocumento(documento: DocumentoCfdi) {
  const carpeta = documento.tabla === "proveedor_facturas" ? "cfdi" : "nc";
  return `${documento.organizationId}/${carpeta}/${documento.id}`;
}

function errorDocumentoAusente(documento: DocumentoCfdi) {
  const nombre = documento.tabla === "proveedor_facturas" ? "factura de proveedor" : "nota de crédito";
  return new Error(`La ${nombre} no existe o fue eliminada.`);
}

async function leerAdjuntos({ tabla, id, organizationId }: DocumentoCfdi) {
  const { data, error } = await supabase.from(tabla)
    .select("archivo_xml_url, archivo_pdf_url")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function borrarObjetos(paths: string[]) {
  if (paths.length > 0) {
    await supabase.storage.from("facturas").remove(paths).catch(() => undefined);
  }
}

async function limpiarAdjuntosSustituidos(
  documento: DocumentoCfdi, anteriores: Adjuntos, cambio: Partial<Adjuntos>,
) {
  const vigentes = Object.values({ ...anteriores, ...cambio })
    .flatMap((path) => path ? [extractFacturaPath(path)] : []);
  // Los datos históricos pueden referenciar el mismo objeto desde ambos campos.
  const reemplazados = Object.values(anteriores).flatMap((valor) => {
    if (!valor) return [];
    const path = extractFacturaPath(valor);
    return path.startsWith(`${rutaDocumento(documento)}/`) && !vigentes.includes(path) ? [path] : [];
  });
  await borrarObjetos([...new Set(reemplazados)]);
}

async function guardarVinculos(
  { tabla, id, organizationId }: DocumentoCfdi,
  anteriores: Adjuntos,
  cambio: Partial<Adjuntos>,
) {
  const consulta = supabase.from(tabla).update(cambio)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .is("deleted_at", null);
  for (const columna of Object.values(columnasPorTipo)) {
    if (!(columna in cambio)) continue;
    const anterior = anteriores[columna];
    if (anterior === null) consulta.is(columna, null);
    else consulta.eq(columna, anterior);
  }
  return consulta.select("id").maybeSingle();
}

async function confirmarVinculos(
  documento: DocumentoCfdi, anteriores: Adjuntos, nuevos: Partial<Adjuntos>, paths: string[],
) {
  const respuesta = await guardarVinculos(documento, anteriores, nuevos)
    .catch((error: unknown) => ({
      data: null,
      error: error ?? new Error("No se pudo confirmar el cambio de adjuntos."),
      status: 0,
    }));
  if (respuesta.data) return;

  const { error, status } = respuesta;
  if (error === null) {
    await borrarObjetos(paths);
    throw new Error("El documento o sus adjuntos cambiaron. Actualiza la vista e inténtalo de nuevo.");
  }

  // Un SQLSTATE de rechazo confirma que la escritura no se aplicó.
  if (status >= 400 && status < 500 && typeof error === "object" && "code" in error
    && typeof error.code === "string" && /^[0-9A-Z]{5}$/.test(error.code)) {
    await borrarObjetos(paths);
    throw error;
  }

  // La escritura aún puede estar en curso. Conserva las subidas si el vínculo sigue incierto.
  const actuales = await leerAdjuntos(documento).catch(() => null);
  if (actuales && Object.values(columnasPorTipo).every(
    (columna) => !(columna in nuevos) || nuevos[columna] === actuales[columna],
  )) return;
  throw error;
}

async function subirAdjuntos(
  documento: DocumentoCfdi,
  archivos: { tipo: TipoAdjuntoCfdi; file: File }[],
): Promise<string[]> {
  for (const { tipo, file } of archivos) await validarContenidoCfdi(tipo, file);
  const anteriores = await leerAdjuntos(documento);
  if (!anteriores) throw errorDocumentoAusente(documento);

  const nuevos: Partial<Record<ColumnaAdjunto, string>> = {};
  try {
    for (const { tipo, file } of archivos) {
      const path = pathCfdi(rutaDocumento(documento), tipo, file.name);
      const { error } = await supabase.storage.from("facturas").upload(path, file, {
        contentType: contentTypeFor(tipo),
        upsert: false,
      });
      if (error) throw error;
      nuevos[columnasPorTipo[tipo]] = path;
    }
  } catch (error) {
    await borrarObjetos(Object.values(nuevos));
    throw error;
  }

  const paths = Object.values(nuevos);
  await confirmarVinculos(documento, anteriores, nuevos, paths);
  await limpiarAdjuntosSustituidos(documento, anteriores, nuevos);
  return paths;
}

async function subirArchivos(tabla: DocumentoCfdi["tabla"], id: string, params: ArchivosCfdi) {
  const archivos: { tipo: TipoAdjuntoCfdi; file: File }[] = [];
  if (params.xmlFile) archivos.push({ tipo: "XML", file: params.xmlFile });
  if (params.pdfFile) archivos.push({ tipo: "PDF", file: params.pdfFile });
  if (!archivos.length) return;
  const organizationId = await resolverOrganizationId(params.organizationId);
  await subirAdjuntos({ tabla, id, organizationId }, archivos);
}

export async function subirArchivosCfdiFactura(params: ArchivosCfdi & { facturaId: string }): Promise<void> {
  await subirArchivos("proveedor_facturas", params.facturaId, params);
}

export async function subirArchivosNcProveedor(params: ArchivosCfdi & { ncId: string }): Promise<void> {
  await subirArchivos("proveedor_notas_credito", params.ncId, params);
}

export async function adjuntarArchivoCfdiFactura(params: {
  facturaId: string;
  organizationId: string | null | undefined;
  tipo: TipoAdjuntoCfdi;
  file: File;
}): Promise<string> {
  const organizationId = await resolverOrganizationId(params.organizationId);
  const [path] = await subirAdjuntos(
    { tabla: "proveedor_facturas", id: params.facturaId, organizationId },
    [{ tipo: params.tipo, file: params.file }],
  );
  return path;
}

export async function quitarArchivoCfdiFactura(params: {
  facturaId: string;
  organizationId?: string | null;
  path: string;
  tipo: TipoAdjuntoCfdi;
}): Promise<void> {
  const organizationId = await resolverOrganizationId(params.organizationId);
  const documento: DocumentoCfdi = { tabla: "proveedor_facturas", id: params.facturaId, organizationId };
  const anteriores = await leerAdjuntos(documento);
  if (!anteriores) throw errorDocumentoAusente(documento);
  const columna = columnasPorTipo[params.tipo];
  const vigente = anteriores[columna];
  if (!vigente || extractFacturaPath(vigente) !== extractFacturaPath(params.path)) {
    throw new Error("El adjunto cambió. Actualiza la vista e inténtalo de nuevo.");
  }
  const cambio = { [columna]: null };
  await confirmarVinculos(documento, anteriores, cambio, []);
  await limpiarAdjuntosSustituidos(documento, anteriores, cambio);
}
