/**
 * Parser compartido por `emitirFacturapi` y `emitirRep`.
 *
 * Evalúa el cuerpo 2xx en orden seguro (error → pendiente → éxito) y, si no
 * encaja en ninguna variante, lanza `TimbradoContratoError`. Así la UI nunca
 * recibe un objeto incompleto por un cast.
 */
import { respuestaPendiente, type TimbradoPendiente } from "./timbradoPendiente";
import {
  esErrorWire,
  esExitoWire,
  esPendienteWire,
  exitoWire,
  TimbradoContratoError,
  type TimbradoErrorWire,
  type TimbradoExitoWire,
} from "./timbradoWire";

export type TimbradoParseado = TimbradoExitoWire | TimbradoPendiente;

/**
 * @param data     cuerpo devuelto por `supabase.functions.invoke`
 * @param contexto texto humano para el error de contrato ("El timbrado de la factura")
 * @param lanzarError cómo convertir el error estructurado en excepción
 */
export function interpretarTimbrado(
  data: unknown,
  contexto: string,
  lanzarError: (body: TimbradoErrorWire) => never,
): TimbradoParseado {
  if (esErrorWire(data)) lanzarError(data);
  if (esPendienteWire(data)) return respuestaPendiente(data);
  if (esExitoWire(data)) return exitoWire(data);
  throw new TimbradoContratoError(data, contexto);
}
