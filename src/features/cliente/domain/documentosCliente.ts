/**
 * Ola 4 — Expediente documental del cliente (lógica pura, sin red ni UI).
 * Espejo del expediente de proveedor: mismas reglas de vigencia, distinto
 * catálogo de documentos (aquí manda el alta comercial y de crédito).
 */
import { hoyMx } from "@/lib/date/mx";
import {
  calcularExpedienteDesde,
  type DocumentoExpediente,
  type ResumenExpediente,
} from "@/features/expediente/domain/expediente";

export const TIPOS_DOCUMENTO_CLIENTE = [
  "Constancia de situación fiscal",
  "Comprobante de domicilio",
  "Acta constitutiva",
  "Poder notarial",
  "Identificación oficial",
  "Contrato de servicios",
  "Solicitud de crédito",
  "Referencias comerciales",
  "Opinión de cumplimiento",
  "Otro",
] as const;

export type TipoDocumentoCliente = (typeof TIPOS_DOCUMENTO_CLIENTE)[number];

export interface DocumentoCliente extends DocumentoExpediente {
  cliente_id: string;
  tipo: TipoDocumentoCliente;
}

/** Documentos mínimos para dar de alta a un cliente sin crédito. */
export const DOCUMENTOS_OBLIGATORIOS_CLIENTE: readonly TipoDocumentoCliente[] = [
  "Constancia de situación fiscal",
  "Comprobante de domicilio",
  "Contrato de servicios",
];

/** Si el cliente opera con crédito, además exigimos el soporte crediticio. */
export const DOCUMENTOS_OBLIGATORIOS_CLIENTE_CREDITO: readonly TipoDocumentoCliente[] = [
  ...DOCUMENTOS_OBLIGATORIOS_CLIENTE,
  "Solicitud de crédito",
];

/** Tipos cuya fecha de vencimiento es obligatoria (caducan por naturaleza). */
export const TIPOS_CON_VENCIMIENTO_CLIENTE: readonly TipoDocumentoCliente[] = [
  "Opinión de cumplimiento",
];

export function calcularExpedienteCliente(
  documentos: DocumentoCliente[],
  conCredito: boolean,
  hoy: string = hoyMx(),
): ResumenExpediente<DocumentoCliente> {
  return calcularExpedienteDesde(
    documentos,
    conCredito
      ? DOCUMENTOS_OBLIGATORIOS_CLIENTE_CREDITO
      : DOCUMENTOS_OBLIGATORIOS_CLIENTE,
    hoy,
  );
}
