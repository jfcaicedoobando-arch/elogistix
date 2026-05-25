/**
 * Lógica pura para la proyección de facturación mensual basada en ETA de embarques.
 * Dividida en módulos para mantener archivos ≤200 LOC (Power of 10).
 *
 * v8.117.4: además de MXN se mantiene la suma equivalente en USD usando
 * convertirAUSD con el TC del propio embarque (tarjetas "Cierre mensual").
 */
export * from "./proyeccionFacturacion/types";
export * from "./proyeccionFacturacion/conversion";
export * from "./proyeccionFacturacion/agrupar";
export * from "./proyeccionFacturacion/kpis";
export * from "./proyeccionFacturacion/meses";
