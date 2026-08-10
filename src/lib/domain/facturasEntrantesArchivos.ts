/**
 * Buzón de facturas de proveedor: validación y emparejado de archivos.
 *
 * Lógica pura extraída de `facturasEntrantes.ts` (Power of 10: ≤ 200 líneas).
 * Un documento del buzón = PDF + XML del mismo CFDI.
 */

/** Extensiones aceptadas en el buzón (PDF y, opcionalmente, el XML del CFDI). */
export const EXTENSIONES_ENTRANTES = [".pdf", ".xml"] as const;
export const TAMANO_MAX_ENTRANTE_MB = 15;

export function validarArchivoEntrante(file: { name: string; size: number }): string | null {
  const nombre = file.name.toLowerCase();
  const extensionOk = EXTENSIONES_ENTRANTES.some((ext) => nombre.endsWith(ext));
  if (!extensionOk) return "Sólo se aceptan archivos PDF o XML.";
  if (file.size > TAMANO_MAX_ENTRANTE_MB * 1024 * 1024) {
    return `El archivo supera el límite de ${TAMANO_MAX_ENTRANTE_MB} MB.`;
  }
  return null;
}

/** Ruta canónica en el bucket privado: {org}/{embarque}/{hash}-{archivo}. */
export function rutaArchivoEntrante(params: {
  organizationId: string;
  embarqueId: string;
  hash: string;
  nombreArchivo: string;
}): string {
  const limpio = params.nombreArchivo.replace(/[^\w.-]+/g, "_").slice(-80);
  return `${params.organizationId}/${params.embarqueId}/${params.hash.slice(0, 16)}-${limpio}`;
}

export type TipoArchivoEntrante = "pdf" | "xml";

/** Clasifica un archivo por extensión/MIME; `null` si no es PDF ni XML. */
export function tipoArchivoEntrante(file: { name: string; type?: string }): TipoArchivoEntrante | null {
  const nombre = file.name.toLowerCase();
  if (nombre.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (nombre.endsWith(".xml") || file.type === "text/xml" || file.type === "application/xml") return "xml";
  return null;
}

export interface ParejaArchivosEntrantes<T extends { name: string; type?: string }> {
  pdf: T | null;
  xml: T | null;
  ignorados: T[];
}

/**
 * Acomoda una selección múltiple (arrastrar y soltar) en las dos ranuras del
 * documento. Si llegan varios del mismo tipo, se conserva el primero.
 */
export function emparejarArchivosEntrantes<T extends { name: string; type?: string }>(
  archivos: readonly T[],
  previo: { pdf: T | null; xml: T | null } = { pdf: null, xml: null },
): ParejaArchivosEntrantes<T> {
  const resultado: ParejaArchivosEntrantes<T> = { pdf: previo.pdf, xml: previo.xml, ignorados: [] };
  for (const archivo of archivos) {
    const tipo = tipoArchivoEntrante(archivo);
    if (tipo === "pdf" && !resultado.pdf) resultado.pdf = archivo;
    else if (tipo === "xml" && !resultado.xml) resultado.xml = archivo;
    else resultado.ignorados.push(archivo);
  }
  return resultado;
}

/** Un documento del buzón siempre debe traer al menos un archivo. */
export function validarParejaEntrante(pareja: {
  pdf: { name: string; size: number } | null;
  xml: { name: string; size: number } | null;
}): string | null {
  if (!pareja.pdf && !pareja.xml) return "Adjunta el PDF de la factura (y el XML si el proveedor es mexicano).";
  for (const archivo of [pareja.pdf, pareja.xml]) {
    if (!archivo) continue;
    const invalido = validarArchivoEntrante(archivo);
    if (invalido) return invalido;
  }
  return null;
}
