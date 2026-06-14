/**
 * Buckets estandarizados de `staleTime` para React Query. Centraliza los
 * valores que antes vivían como magic numbers en cada hook (Auditoría Paso 9).
 *
 * Criterio de uso:
 *  - `STALE_VOLATILE` (15 s)  → listados que cambian con cada operación CRUD.
 *  - `STALE_SHORT`    (30 s)  → tablas y dashboards refrescados con frecuencia.
 *  - `STALE_MEDIUM`   (60 s)  → catálogos editables, cuentas, configuración.
 *  - `STALE_LONG`     (5 min) → KPIs y agregados costosos.
 *  - `STALE_STATIC`   (30 min) → catálogos casi inmutables (puertos, regímenes).
 */
export const STALE_VOLATILE = 15_000;
export const STALE_SHORT = 30_000;
export const STALE_MEDIUM = 60_000;
export const STALE_LONG = 5 * 60_000;
export const STALE_STATIC = 30 * 60_000;
