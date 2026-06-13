/**
 * Constantes centralizadas para configuración de cache y red.
 * Reemplaza valores mágicos dispersos (staleTime, gcTime, límites de paginación,
 * códigos HTTP) por nombres con intención. Power of 10 — magic values prohibidos.
 *
 * Uso:
 *   import { CACHE_TIMES, QUERY_LIMITS, HTTP_STATUS } from "@/constants/cache";
 *   useQuery({ ..., staleTime: CACHE_TIMES.medium });
 */

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

/** Tiempos de cache estándar para React Query. */
export const CACHE_TIMES = {
  /** 30s — datos volátiles (movimientos, búsquedas). */
  short: 30 * SECOND,
  /** 1m — datos estables a corto plazo (listados con filtros). */
  default: MINUTE,
  /** 5m — catálogos y configuración global. */
  medium: 5 * MINUTE,
  /** 30m — datos prácticamente inmutables (puertos, tipos de cambio históricos). */
  long: 30 * MINUTE,
} as const;

/** Límites de paginación / consultas por defecto. */
export const QUERY_LIMITS = {
  /** Tamaño de página estándar en listados paginados. */
  pageSize: 50,
  /** Tope superior para listados sin paginación visible (export, autocompletes). */
  bulk: 200,
  /** Resultados máximos para autocompletes y búsquedas globales. */
  search: 25,
} as const;

/** Códigos HTTP usados en branching de errores. */
export const HTTP_STATUS = {
  ok: 200,
  badRequest: 400,
  unauthorized: 401,
  forbidden: 403,
  notFound: 404,
  conflict: 409,
  serverError: 500,
} as const;
