/**
 * Ola 4 (homologación Cliente ↔ Proveedor) — Lógica pura y compartida del
 * expediente documental de cualquier entidad (cliente o proveedor).
 *
 * Analogía: es la "carpeta física". Aquí sólo decidimos si un documento está
 * vigente, cuál es el más reciente de cada tipo y qué le falta a la carpeta.
 * Sin red y sin UI, para que ambas fichas se comporten idéntico.
 */
import { hoyMx, parseLocalMx } from "@/lib/date/mx";

/** Forma mínima de un documento del expediente (misma en cliente y proveedor). */
export interface DocumentoExpediente {
  id: string;
  tipo: string;
  nombre: string;
  archivo: string;
  mime_type: string | null;
  tamano_bytes: number | null;
  fecha_documento: string | null;
  fecha_vencimiento: string | null;
  notas: string | null;
  created_at: string;
}

export type EstadoVigencia = "Sin vigencia" | "Vigente" | "Por vencer" | "Vencido";

/** Días de anticipación con los que avisamos que un documento va a vencer. */
export const DIAS_AVISO_VENCIMIENTO = 30;

/** Vigencia máxima plausible; más allá es casi seguro un error de captura. */
export const MAX_VIGENCIA_ANIOS = 10;

export function diasParaVencer(
  fechaVencimiento: string | null | undefined,
  hoy: string = hoyMx(),
): number | null {
  if (!fechaVencimiento) return null;
  const venc = parseLocalMx(fechaVencimiento.slice(0, 10)).getTime();
  const base = parseLocalMx(hoy).getTime();
  return Math.round((venc - base) / 86_400_000);
}

export function estadoVigencia(
  fechaVencimiento: string | null | undefined,
  hoy: string = hoyMx(),
): EstadoVigencia {
  const dias = diasParaVencer(fechaVencimiento, hoy);
  if (dias === null) return "Sin vigencia";
  if (dias < 0) return "Vencido";
  if (dias <= DIAS_AVISO_VENCIMIENTO) return "Por vencer";
  return "Vigente";
}

export interface RenglonExpediente<T extends DocumentoExpediente = DocumentoExpediente> {
  tipo: string;
  documento: T | null;
  estado: EstadoVigencia | "Faltante";
}

export interface ResumenExpediente<T extends DocumentoExpediente = DocumentoExpediente> {
  renglones: RenglonExpediente<T>[];
  requeridos: number;
  cubiertos: number;
  vencidos: number;
  porVencer: number;
  completitud: number;
}

/** Documento más reciente de un tipo (por fecha del documento, luego captura). */
export function ultimoPorTipo<T extends DocumentoExpediente>(
  documentos: T[],
  tipo: string,
): T | null {
  const delTipo = documentos
    .filter((d) => d.tipo === tipo)
    .sort((a, b) => {
      const fa = a.fecha_documento ?? a.created_at.slice(0, 10);
      const fb = b.fecha_documento ?? b.created_at.slice(0, 10);
      if (fa === fb) return b.created_at.localeCompare(a.created_at);
      return fb.localeCompare(fa);
    });
  return delTipo[0] ?? null;
}

/** Semáforo del expediente contra la lista de documentos obligatorios. */
export function calcularExpedienteDesde<T extends DocumentoExpediente>(
  documentos: T[],
  tiposRequeridos: readonly string[],
  hoy: string = hoyMx(),
): ResumenExpediente<T> {
  const renglones: RenglonExpediente<T>[] = tiposRequeridos.map((tipo) => {
    const documento = ultimoPorTipo(documentos, tipo);
    return {
      tipo,
      documento,
      estado: documento ? estadoVigencia(documento.fecha_vencimiento, hoy) : "Faltante",
    };
  });

  const cubiertos = renglones.filter(
    (r) => r.documento !== null && r.estado !== "Vencido",
  ).length;
  const requeridos = renglones.length;

  return {
    renglones,
    requeridos,
    cubiertos,
    vencidos: renglones.filter((r) => r.estado === "Vencido").length,
    porVencer: renglones.filter((r) => r.estado === "Por vencer").length,
    completitud: requeridos === 0 ? 100 : Math.round((cubiertos / requeridos) * 100),
  };
}

/** Nombre legible del tamaño del archivo. */
export function formatTamano(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Validaciones mínimas de vigencia al capturar (misma regla en ambas fichas).
 * Devuelve el mensaje de error bloqueante o `null` si es válido.
 */
export function validarVigencia(
  tipo: string,
  fechaDocumento: string | null | undefined,
  fechaVencimiento: string | null | undefined,
  tiposConVencimiento: readonly string[],
  hoy: string = hoyMx(),
): string | null {
  const venc = fechaVencimiento?.slice(0, 10) || null;
  if (!venc) {
    return tiposConVencimiento.includes(tipo)
      ? `La fecha de vencimiento es obligatoria para "${tipo}".`
      : null;
  }
  if (venc < hoy) {
    return "La vigencia ya venció: captura el documento renovado o corrige la fecha.";
  }
  const doc = fechaDocumento?.slice(0, 10) || null;
  if (doc && venc < doc) {
    return "La vigencia no puede ser anterior a la fecha del documento.";
  }
  const limite = parseLocalMx(hoy);
  limite.setUTCFullYear(limite.getUTCFullYear() + MAX_VIGENCIA_ANIOS);
  if (parseLocalMx(venc).getTime() > limite.getTime()) {
    return `La vigencia no puede ser mayor a ${MAX_VIGENCIA_ANIOS} años; revisa la fecha capturada.`;
  }
  return null;
}

/** Limpia el nombre del archivo para que sea seguro como llave de storage. */
export function slugArchivo(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-120);
}
