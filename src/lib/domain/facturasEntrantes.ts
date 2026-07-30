/**
 * Buzón de facturas de proveedor por embarque (CxP Inbox).
 *
 * Lógica pura y testeable: el operador sólo entrega el archivo (modo archivo),
 * y contabilidad lo captura como factura de proveedor más tarde.
 */

export type EstadoFacturaEntrante = "por_capturar" | "capturada" | "rechazada";

export const ESTADOS_FACTURA_ENTRANTE: readonly EstadoFacturaEntrante[] = [
  "por_capturar",
  "capturada",
  "rechazada",
];

export const ESTADO_ENTRANTE_LABEL: Record<EstadoFacturaEntrante, string> = {
  por_capturar: "Por capturar",
  capturada: "Capturada",
  rechazada: "Rechazada",
};

export type BadgeVariante = "warning" | "success" | "destructive" | "neutral";

export const ESTADO_ENTRANTE_VARIANTE: Record<EstadoFacturaEntrante, BadgeVariante> = {
  por_capturar: "warning",
  capturada: "success",
  rechazada: "destructive",
};

export function normalizarEstadoEntrante(estado: string | null | undefined): EstadoFacturaEntrante {
  return (ESTADOS_FACTURA_ENTRANTE as readonly string[]).includes(estado ?? "")
    ? (estado as EstadoFacturaEntrante)
    : "por_capturar";
}

export function etiquetaEstadoEntrante(estado: string | null | undefined): string {
  return ESTADO_ENTRANTE_LABEL[normalizarEstadoEntrante(estado)];
}

export function varianteEstadoEntrante(estado: string | null | undefined): BadgeVariante {
  return ESTADO_ENTRANTE_VARIANTE[normalizarEstadoEntrante(estado)];
}

/** Sólo un documento pendiente puede capturarse o rechazarse. */
export function puedeProcesarEntrante(estado: string | null | undefined): boolean {
  return normalizarEstadoEntrante(estado) === "por_capturar";
}

/**
 * El operador puede retirar su archivo mientras nadie lo haya capturado.
 * Los administradores pueden retirar cualquiera que siga pendiente.
 */
export function puedeEliminarEntrante(params: {
  estado: string | null | undefined;
  subidoPor: string | null | undefined;
  userId: string | null | undefined;
  isAdmin: boolean;
}): boolean {
  if (!puedeProcesarEntrante(params.estado)) return false;
  if (params.isAdmin) return true;
  return Boolean(params.userId) && params.subidoPor === params.userId;
}

/** Días naturales que lleva esperando captura (0 si se subió hoy). */
export function diasEnEspera(createdAt: string, ahora: Date = new Date()): number {
  const inicio = new Date(createdAt).getTime();
  if (Number.isNaN(inicio)) return 0;
  const dif = ahora.getTime() - inicio;
  return dif <= 0 ? 0 : Math.floor(dif / 86_400_000);
}

export interface ResumenEntrantes {
  total: number;
  porCapturar: number;
  capturadas: number;
  rechazadas: number;
}

export function resumirEntrantes(
  filas: readonly { estado: string | null }[],
): ResumenEntrantes {
  const resumen: ResumenEntrantes = { total: filas.length, porCapturar: 0, capturadas: 0, rechazadas: 0 };
  for (const fila of filas) {
    const estado = normalizarEstadoEntrante(fila.estado);
    if (estado === "por_capturar") resumen.porCapturar += 1;
    else if (estado === "capturada") resumen.capturadas += 1;
    else resumen.rechazadas += 1;
  }
  return resumen;
}

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

// ─── v13.360.0 — Documento = PDF + XML del mismo CFDI ───────────────────────

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

/**
 * Proveedor nacional sin XML = expediente fiscal incompleto (no es deducible).
 * Para proveedores extranjeros el PDF es suficiente.
 */
export function faltaXmlFiscal(params: {
  esNacional: boolean;
  tieneXml: boolean;
}): boolean {
  return params.esNacional && !params.tieneXml;
}

/** Etiquetas de archivos adjuntos para mostrar en la lista del buzón. */
export function chipsArchivosEntrante(row: {
  archivo_path?: string | null;
  xml_path?: string | null;
}): TipoArchivoEntrante[] {
  const chips: TipoArchivoEntrante[] = [];
  if (row.archivo_path && !row.archivo_path.toLowerCase().endsWith(".xml")) chips.push("pdf");
  if (row.xml_path) chips.push("xml");
  else if (row.archivo_path?.toLowerCase().endsWith(".xml")) chips.push("xml");
  return chips;
}

