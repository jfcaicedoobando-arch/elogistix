/**
 * FIX-24 — Helpers para construir filtros `ilike` y `or(...ilike...)` de PostgREST
 * de forma segura frente a caracteres especiales.
 *
 * Problema:
 *  - `%` y `_` son comodines en `ILIKE` de PostgreSQL. Si un usuario los teclea
 *    directamente en el buscador, el resultado es incorrecto (matchean lo que no
 *    deben) y se puede degradar el rendimiento.
 *  - En `.or("col.ilike.%q%")` los caracteres `,`, `)`, `(`, `"` rompen el
 *    parser de PostgREST. Comas o paréntesis reales del usuario tiran la query.
 *
 * Este módulo NO ejecuta queries: sólo produce los strings que se pasan a
 * `.ilike(col, pattern)` o `.or(expression)` del cliente Supabase.
 */

/** Escapa `\`, `%` y `_` para que el string se trate como literal dentro de un patrón ILIKE. */
export function escapeIlike(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Construye el patrón `%term%` con el término escapado y normalizado (trim). */
export function ilikePattern(input: string): string {
  return `%${escapeIlike(input.trim())}%`;
}

/**
 * Construye la expresión para `.or(...)` de PostgREST envolviendo el valor entre
 * comillas dobles cuando contiene caracteres reservados (`,`, `(`, `)`, `"`).
 * Los `"` internos se escapan como `""`.
 */
function quoteOrValue(v: string): string {
  if (/[,()"]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/**
 * Devuelve la expresión que se pasa tal cual a `supabase.from(...).or(expr)` para
 * hacer un OR entre múltiples columnas usando ILIKE contra el mismo término.
 *
 *   orIlike(["numero", "cliente_nombre"], "ACME, S.A.")
 *   // => 'numero.ilike."%ACME, S.A.%",cliente_nombre.ilike."%ACME, S.A.%"'
 */
export function orIlike(cols: readonly string[], term: string): string {
  const pattern = ilikePattern(term);
  const safe = quoteOrValue(pattern);
  return cols.map((c) => `${c}.ilike.${safe}`).join(",");
}
