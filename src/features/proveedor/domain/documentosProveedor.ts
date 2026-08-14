/**
 * Ola 3 / Ola 4 — Expediente documental del proveedor (lógica pura).
 *
 * Analogía: es la "carpeta física" del proveedor. Las reglas de vigencia y
 * completitud viven en `@/features/expediente/domain/expediente` (compartidas
 * con el cliente); aquí sólo definimos el catálogo propio del proveedor.
 */
import { hoyMx } from "@/lib/date/mx";
import {
  calcularExpedienteDesde,
  validarVigencia,
  type DocumentoExpediente,
} from "@/features/expediente/domain/expediente";

export {
  diasParaVencer,
  estadoVigencia,
  formatTamano,
  ultimoPorTipo,
} from "@/features/expediente/domain/expediente";
export type {
  ResumenExpediente,
} from "@/features/expediente/domain/expediente";

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

export interface DocumentoProveedor extends DocumentoExpediente {
  proveedor_id: string;
  tipo: TipoDocumentoProveedor;
}

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

/**
 * Ola 12 · R3P-14 — fuente única de verdad del origen del proveedor:
 * `origen_proveedor` NULL se trata como NACIONAL hasta que se capture lo
 * contrario. Espejo del `COALESCE(origen,'Nacional')` de la RPC
 * `proveedor_inteligencia`. Antes la UI lo trataba como extranjero y la RPC
 * como nacional (expediente "completo" con sólo el comprobante bancario vs.
 * CLABE exigida en Salud).
 */
export function esNacionalOrigen(origen: string | null | undefined): boolean {
  return origen !== "Extranjero";
}

/**
 * R3FE-07: tipos cuya vigencia caduca — la fecha de vencimiento es obligatoria
 * (la opinión de cumplimiento y las cartas bancarias caducan).
 */
export const TIPOS_CON_VENCIMIENTO: readonly TipoDocumentoProveedor[] = [
  "Opinión de cumplimiento",
  "Comprobante de datos bancarios",
];

export function calcularExpediente(
  documentos: DocumentoProveedor[],
  esNacional: boolean,
  hoy: string = hoyMx(),
) {
  return calcularExpedienteDesde(
    documentos,
    esNacional ? DOCUMENTOS_OBLIGATORIOS_NACIONAL : DOCUMENTOS_OBLIGATORIOS_EXTRANJERO,
    hoy,
  );
}

/**
 * R3FE-07: validaciones mínimas de vigencia al capturar un documento.
 * Devuelve el mensaje de error (bloqueante) o `null` si es válido.
 */
export function validarVigenciaDocumento(
  tipo: TipoDocumentoProveedor,
  fechaDocumento: string | null | undefined,
  fechaVencimiento: string | null | undefined,
  hoy: string = hoyMx(),
): string | null {
  return validarVigencia(tipo, fechaDocumento, fechaVencimiento, TIPOS_CON_VENCIMIENTO, hoy);
}
