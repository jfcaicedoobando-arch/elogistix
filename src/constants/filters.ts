/**
 * Valor sentinel para filtros "Todos" en Selects/URLs.
 *
 * Radix `Select.Item` no acepta `""` como value; usamos `'todos'` como
 * literal estándar en toda la app. Mantener este valor exacto: las URLs
 * serializadas (`?cliente=todos`) dependen de él.
 */
export const FILTER_ALL = "todos" as const;
export type FilterAll = typeof FILTER_ALL;
