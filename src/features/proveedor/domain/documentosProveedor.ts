/**
 * Ola 3 — Expediente documental del proveedor (lógica pura, sin red ni UI).
 *
 * Analogía: es la "carpeta física" del proveedor. Aquí sólo decidimos qué
 * documentos debe traer, si están vigentes y cuánto le falta al expediente.
 */
import { hoyMx, parseLocalMx } from "@/lib/date/mx";

export const TIPOS_DOCUMENTO_PROVEEDOR = [
  "Constancia de situación fiscal",
  "Opinión de cumplimiento",
  "Comprobante de datos bancarios",
  "Contrato",
  "Acta constitutiva",
  "Poder notarial",
  "Identificación oficial",
  "Otro",
] as const;

export type TipoDocumentoProveedor = (typeof TIPOS_DOCUMENTO_PROVEEDOR)[number];

export interface DocumentoProveedor {
  id: string;
  proveedor_id: string;
  tipo: TipoDocumentoProveedor;
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

/** Documentos que un proveedor nacional debe tener en el expediente. */
export const DOCUMENTOS_OBLIGATORIOS_NACIONAL: TipoDocumentoProveedor[] = [
  "Constancia de situación fiscal",
  "Opinión de cumplimiento",
  "Comprobante de datos bancarios",
];

/** Documentos mínimos para un proveedor extranjero (no hay SAT que consultar). */
export const DOCUMENTOS_OBLIGATORIOS_EXTRANJERO: TipoDocumentoProveedor[] = [
  "Comprobante de datos bancarios",
];

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

export interface RenglonExpediente {
  tipo: TipoDocumentoProveedor;
  documento: DocumentoProveedor | null;
  estado: EstadoVigencia | "Faltante";
}

export interface ResumenExpediente {
  renglones: RenglonExpediente[];
  requeridos: number;
  cubiertos: number;
  vencidos: number;
  porVencer: number;
  completitud: number;
}

/** Documento más reciente de cada tipo (por fecha del documento, luego captura). */
export function ultimoPorTipo(
  documentos: DocumentoProveedor[],
  tipo: TipoDocumentoProveedor,
): DocumentoProveedor | null {
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

export function calcularExpediente(
  documentos: DocumentoProveedor[],
  esNacional: boolean,
  hoy: string = hoyMx(),
): ResumenExpediente {
  const requeridosTipos = esNacional
    ? DOCUMENTOS_OBLIGATORIOS_NACIONAL
    : DOCUMENTOS_OBLIGATORIOS_EXTRANJERO;

  const renglones: RenglonExpediente[] = requeridosTipos.map((tipo) => {
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
  const vencidos = renglones.filter((r) => r.estado === "Vencido").length;
  const porVencer = renglones.filter((r) => r.estado === "Por vencer").length;
  const requeridos = renglones.length;

  return {
    renglones,
    requeridos,
    cubiertos,
    vencidos,
    porVencer,
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
