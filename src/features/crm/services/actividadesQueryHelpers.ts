/**
 * Helpers de filtrado para las consultas de `crm_actividades`.
 * Extraído de `actividades.ts` (Power of 10 — límite de líneas por archivo).
 */
import { quoteOrValue } from "@/lib/search/ilike";
import type { CrmActividadRow } from "./actividades";

/**
 * B-055: hay actividades legadas con sólo `responsable_email` (sin id).
 * v13.823.51 — el ID es autoritativo: el correo sólo desempata cuando
 * `responsable_id IS NULL`. Antes `responsable_email.eq.X` bastaba, así que el
 * correo se volvía identidad permanente y podía atribuir actividades ya
 * reasignadas a otro usuario.
 *
 * B-24: `quoteOrValue` protege el `.or()` de PostgREST — un valor con `,`, `(`,
 * `)` o `"` rompería el parser.
 */
export const filtroResponsable = (userId: string, email?: string | null) =>
  email
    ? `responsable_id.eq.${userId},and(responsable_id.is.null,responsable_email.eq.${quoteOrValue(email)})`
    : `responsable_id.eq.${userId}`;

/** Resultado vacío: filtro personal sin sesión resuelta (falla cerrado). */
export const SIN_RESULTADOS = { data: [] as CrmActividadRow[], count: 0 };

export interface FiltrableQuery<T> {
  or: (expr: string) => T;
  is: (col: string, val: null) => T;
  lt: (col: string, val: string) => T;
}

export interface ResponsableYVencidasParams {
  responsable: "mias" | "todos";
  vencidas?: boolean;
  userId?: string;
  userEmail?: string | null;
}

/**
 * Filtro personal ("Mías") y atajo de vencidas. Extraído en v13.823.51 para
 * mantener `listActividades` dentro del límite de complejidad.
 */
export function aplicarResponsableYVencidas<T extends FiltrableQuery<T>>(
  q: T,
  p: ResponsableYVencidasParams,
): T {
  let out = q;
  if (p.responsable === "mias" && p.userId) out = out.or(filtroResponsable(p.userId, p.userEmail));
  if (p.vencidas) {
    out = out.is("fecha_completada", null).lt("fecha_programada", new Date().toISOString());
    if (p.responsable !== "mias" && p.userId) out = out.or(filtroResponsable(p.userId, p.userEmail));
  }
  return out;
}
