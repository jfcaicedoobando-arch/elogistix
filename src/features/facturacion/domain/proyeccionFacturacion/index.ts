/**
 * Lógica pura para la proyección de facturación mensual basada en ETA de embarques.
 * Dividida en módulos para mantener archivos ≤200 LOC (Power of 10).
 *
 * v8.117.4: además de MXN se mantiene la suma equivalente en USD usando
 * convertirAUSD con el TC del propio embarque (tarjetas "Cierre mensual").
 */
export * from "./types";
export * from "./conversion";
export * from "./agrupar";
export * from "./kpis";
export * from "./meses";
