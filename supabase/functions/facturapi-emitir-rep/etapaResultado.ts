/**
 * Tipos compartidos por las etapas del caso de uso "emitir REP".
 *
 * Cada etapa devuelve un resultado DISCRIMINADO: o entrega su valor tipado, o
 * entrega la `Response` HTTP con la que el caso de uso corta. Así el
 * orquestador no necesita casts ni banderas y el contrato HTTP queda intacto.
 */

/** Fábrica de respuestas JSON con el CORS del request (`makeJson`). */
export type JsonFn = (body: unknown, status?: number) => Response;

export type Etapa<T> =
  | { ok: true; valor: T }
  | { ok: false; response: Response };

export function etapaOk<T>(valor: T): Etapa<T> {
  return { ok: true, valor };
}

export function etapaCorte<T>(response: Response): Etapa<T> {
  return { ok: false, response };
}

/** Usuario autenticado que ejecuta la emisión (para autorización y bitácora). */
export interface UsuarioRep {
  id: string;
  email?: string;
}
