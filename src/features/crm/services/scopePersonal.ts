/**
 * Alcance personal ("mi seguimiento") para consultas CRM.
 *
 * Segunda tanda YAGNI · hallazgo 1: las tarjetas rotuladas como personales
 * (mis actividades, leads sin contactar, oportunidades/cotizaciones de mi
 * seguimiento) deben filtrar por el vendedor autenticado. Se replica el patrón
 * de `filtroResponsable`: el `id` es autoritativo y el correo sólo desempata
 * cuando `vendedor_id IS NULL` (registros legados asignados sólo por correo).
 *
 * `quoteOrValue` protege el `.or()` de PostgREST cuando el correo trae `,`,
 * `(`, `)` o `"`.
 */
import { quoteOrValue } from "@/lib/search/ilike";

/** Expresión `.or()` para columnas `vendedor_id` / `vendedor_email`. */
export const filtroVendedor = (userId: string, email?: string | null): string =>
  email
    ? `vendedor_id.eq.${userId},and(vendedor_id.is.null,vendedor_email.eq.${quoteOrValue(email)})`
    : `vendedor_id.eq.${userId}`;
