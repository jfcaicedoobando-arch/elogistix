/**
 * Contrato "wire" de las respuestas 2xx de timbrado (`facturapi-emitir` y
 * `facturapi-emitir-rep`).
 *
 * Antes se invocaban con `TimbradoResult & EdgeErrorBody`: una intersección
 * que dice "esta respuesta es éxito Y error a la vez", lo cual es imposible y
 * escondía cuerpos 2xx malformados detrás de un `as`. Aquí el contrato se
 * modela como UNIÓN DISCRIMINABLE y se valida en runtime antes de entregar
 * datos a la UI.
 *
 * Orden de evaluación obligatorio: error → pendiente → éxito.
 * Cualquier otra cosa lanza `TimbradoContratoError` (nunca un cast).
 */
import type { EdgeErrorBody } from "./facturapiError";

/** Timbre listo: el SAT ya devolvió UUID y folio. */
export interface TimbradoExitoWire {
  uuid: string;
  folio: number;
  serie: string;
  facturapi_id: string;
  pdf_url: string;
  xml_url: string;
}

/** 202: el proveedor recibió el documento pero el SAT no ha sellado. */
export interface TimbradoPendienteWire {
  pendiente?: true;
  outcome?: "timbrado_pendiente";
  message?: string;
}

/** Cuerpo de error estructurado emitido por la edge function. */
export type TimbradoErrorWire = EdgeErrorBody & { error: string };

export type TimbradoWire = TimbradoExitoWire | TimbradoPendienteWire | TimbradoErrorWire;

/** Respuesta 2xx que no corresponde a ninguna variante del contrato. */
export class TimbradoContratoError extends Error {
  readonly code = "LC_TIMBRADO_CONTRATO" as const;
  /** Cuerpo recibido, para diagnóstico en soporte. */
  readonly cuerpo: unknown;
  constructor(cuerpo: unknown, contexto: string) {
    super(
      `${contexto} respondió correctamente pero con un cuerpo que no se reconoce ` +
      `(ni timbre, ni pendiente, ni error). No se registró nada: vuelve a intentar ` +
      `y, si persiste, reporta este caso a soporte.`,
    );
    this.name = "TimbradoContratoError";
    this.cuerpo = cuerpo;
  }
}

function esObjeto(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}

function textoNoVacio(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** `true` si el cuerpo es el error estructurado de la edge function. */
export function esErrorWire(data: unknown): data is TimbradoErrorWire {
  return esObjeto(data) && textoNoVacio(data.error);
}

/** `true` si el cuerpo es el 202 pendiente (por bandera o por `outcome`). */
export function esPendienteWire(data: unknown): data is TimbradoPendienteWire {
  if (!esObjeto(data)) return false;
  return data.pendiente === true || data.outcome === "timbrado_pendiente";
}

/** `true` si el cuerpo trae los seis campos del timbre con el tipo correcto. */
export function esExitoWire(data: unknown): data is TimbradoExitoWire {
  if (!esObjeto(data)) return false;
  return (
    textoNoVacio(data.uuid) &&
    typeof data.folio === "number" &&
    Number.isFinite(data.folio) &&
    textoNoVacio(data.serie) &&
    textoNoVacio(data.facturapi_id) &&
    textoNoVacio(data.pdf_url) &&
    textoNoVacio(data.xml_url)
  );
}

/** Copia sólo los seis campos del contrato (no propaga extras del proveedor). */
export function exitoWire(data: TimbradoExitoWire): TimbradoExitoWire {
  return {
    uuid: data.uuid,
    folio: data.folio,
    serie: data.serie,
    facturapi_id: data.facturapi_id,
    pdf_url: data.pdf_url,
    xml_url: data.xml_url,
  };
}
