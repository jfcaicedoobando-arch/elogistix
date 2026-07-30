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
  const limpio = params.nombreArchivo.replace(/[^\w.\-]+/g, "_").slice(-80);
  return `${params.organizationId}/${params.embarqueId}/${params.hash.slice(0, 16)}-${limpio}`;
}
