/**
 * P2-IVA — Etiqueta del tratamiento fiscal de una fila de conceptos (proformas,
 * cotizaciones y listados de sólo lectura).
 *
 * La columna decía únicamente "Sí/No", que no distingue 16%, 8%, tasa 0%,
 * exento ni no objeto. Aquí se muestra el tratamiento cuando está registrado y
 * "Por confirmar" cuando los datos heredados no alcanzan: NUNCA se deduce
 * exento/tasa 0/no objeto de tener el IVA apagado.
 */
import { esTipoIvaSat, TIPO_IVA_LABEL_CORTO } from "@/lib/financial/tipoIvaSat";
import { TASA_IVA } from "@/lib/financial/financialUtils";

export const ETIQUETA_TRATAMIENTO_POR_CONFIRMAR = "Por confirmar";

export interface FilaTratamiento {
  tipo_iva?: string | null;
  tasa_iva_aplicada?: number | null;
  aplica_iva?: boolean | null;
}

const EPS = 1e-6;

/**
 * Etiqueta corta del tratamiento fiscal de la fila.
 * Una fila heredada sin `tipo_iva` sólo se puede leer cuando trae una tasa
 * gravada explícita (> 0); en cualquier otro caso queda "Por confirmar".
 */
export function etiquetaTratamientoFila(fila: FilaTratamiento): string {
  if (esTipoIvaSat(fila.tipo_iva)) return TIPO_IVA_LABEL_CORTO[fila.tipo_iva];
  if (fila.aplica_iva === false) return ETIQUETA_TRATAMIENTO_POR_CONFIRMAR;
  const tasa = Number(fila.tasa_iva_aplicada ?? Number.NaN);
  if (!Number.isFinite(tasa) || Math.abs(tasa) < EPS) {
    return ETIQUETA_TRATAMIENTO_POR_CONFIRMAR;
  }
  if (Math.abs(tasa - 0.08) < EPS) return TIPO_IVA_LABEL_CORTO.gravado_8;
  if (Math.abs(tasa - TASA_IVA) < EPS) return TIPO_IVA_LABEL_CORTO.gravado_16;
  return `${(tasa * 100).toFixed(2)}%`;
}

/**
 * Tratamiento fiscal DESCONOCIDO: sin `tipo_iva` SAT y sin tasa gravada
 * explícita. Es distinto de "no gravado": nadie ha decidido todavía.
 */
export function tratamientoIvaPendiente(fila: FilaTratamiento): boolean {
  return etiquetaTratamientoFila(fila) === ETIQUETA_TRATAMIENTO_POR_CONFIRMAR;
}

export const MSG_PROFORMA_IVA_PENDIENTE =
  "Hay conceptos con tratamiento de IVA \"Por definir\". Clasifícalos (16%, 8%, tasa 0%, exento o no objeto) " +
  "en Editar embarque → Conceptos de venta (selector \"IVA\" de cada línea) antes de generar la proforma.";
