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
 * v13.494.0 — El operador puede retirar su archivo mientras nadie lo haya
 * capturado, y cualquiera con permiso puede retirar los documentos rechazados
 * (ya no sirven y sólo estorban en el buzón). Los administradores pueden
 * retirar cualquiera que no esté capturado.
 */
export function puedeEliminarEntrante(params: {
  estado: string | null | undefined;
  subidoPor: string | null | undefined;
  userId: string | null | undefined;
  isAdmin: boolean;
}): boolean {
  const estado = normalizarEstadoEntrante(params.estado);
  if (estado === "capturada") return false;
  if (params.isAdmin) return true;
  if (estado === "rechazada") return true;
  return Boolean(params.userId) && params.subidoPor === params.userId;
}

/**
 * v13.494.0 — Un documento rechazado por error de captura (proveedor
 * equivocado, por ejemplo) puede devolverse a "Por capturar" sin volver a
 * subir el archivo. Nunca si ya tiene factura de proveedor vinculada.
 */
export function puedeReactivarEntrante(params: {
  estado: string | null | undefined;
  proveedorFacturaId: string | null | undefined;
}): boolean {
  return normalizarEstadoEntrante(params.estado) === "rechazada"
    && !params.proveedorFacturaId;
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

import type { TipoArchivoEntrante } from "@/lib/domain/facturasEntrantesArchivos";

// v13.494.0 — Validación y emparejado de archivos vive en
// `facturasEntrantesArchivos.ts`; se re-exporta para no romper importadores.

export {
  EXTENSIONES_ENTRANTES,
  TAMANO_MAX_ENTRANTE_MB,
  emparejarArchivosEntrantes,
  rutaArchivoEntrante,
  tipoArchivoEntrante,
  validarArchivoEntrante,
  validarParejaEntrante,
} from "@/lib/domain/facturasEntrantesArchivos";
export type {
  ParejaArchivosEntrantes,
  TipoArchivoEntrante,
} from "@/lib/domain/facturasEntrantesArchivos";


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

