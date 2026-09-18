/**
 * P2-IVA — Etiqueta del tratamiento fiscal de una fila de conceptos (proformas,
 * cotizaciones y listados de sólo lectura).
 *
 * La columna decía únicamente "Sí/No", que no distingue 16%, 8%, tasa 0%,
 * exento ni no objeto. Aquí se muestra el tratamiento cuando está registrado y
 * "Por confirmar" cuando los datos heredados no alcanzan: NUNCA se deduce
 * exento/tasa 0/no objeto de tener el IVA apagado.
 */
import { TIPOS_IVA_SAT, TIPO_IVA_LABEL_CORTO, type TipoIvaSat } from "@/lib/financial/tipoIvaSat";

export const ETIQUETA_TRATAMIENTO_POR_CONFIRMAR = "Por confirmar";

export interface FilaTratamiento {
  tipo_iva?: string | null;
  tasa_iva_aplicada?: number | null;
  aplica_iva?: boolean | null;
}

const EPS = 1e-6;

function esTipoIvaSat(v: unknown): v is TipoIvaSat {
  return typeof v === "string" && (TIPOS_IVA_SAT as readonly string[]).includes(v);
}

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
  if (Math.abs(tasa - 0.16) < EPS) return TIPO_IVA_LABEL_CORTO.gravado_16;
  return `${(tasa * 100).toFixed(2)}%`;
}
