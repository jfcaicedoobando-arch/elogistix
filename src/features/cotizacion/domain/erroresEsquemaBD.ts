/**
 * Heurística de errores de esquema/contrato de la BD.
 * Extraído de `CrearEmbarqueConRevalidacion.tsx` (Power-of-10: < 200 líneas).
 */

/**
 * Detecta errores de esquema/contrato de la BD (columnas o campos inexistentes,
 * mismatch de tipos de retorno). Estos son bugs de sistema, no de datos —
 * reintentar no ayuda y sólo produce ruido en Sentry.
 */
export function esErrorDeEsquemaBD(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    /column\s+\S+\s+does not exist/.test(m) ||
    /has no field/.test(m) ||
    /structure of query does not match function result type/.test(m) ||
    /return type mismatch/.test(m) ||
    /relation\s+\S+\s+does not exist/.test(m)
  );
}
