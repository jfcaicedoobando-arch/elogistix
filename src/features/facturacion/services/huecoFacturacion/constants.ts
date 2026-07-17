/**
 * Constantes del "Hueco de Facturación" — v13.301.43 (Fase D).
 *
 * Centraliza los valores mágicos que antes vivían inline en `index.ts` y
 * `fetchSources.ts`, para que un solo lugar dictamine la ventana temporal
 * y el prefijo de query cache.
 */

/**
 * Fecha de corte del modelo de facturación nuevo. Embarques con `eta`
 * anterior a este día están fuera del alcance del hueco (histórico).
 */
export const HUECO_ETA_CORTE_ISO = "2026-04-01" as const;

/**
 * Días naturales de buffer que se suman a `hoy` para dar margen al
 * agente aduanal antes del arribo real del contenedor.
 */
export const HUECO_ETA_BUFFER_DIAS = 3 as const;

/**
 * Estados que representan una factura viva para el hueco. Una factura pagada,
 * vencida o parcialmente pagada ya cubre al embarque igual que una emitida.
 */
export const FACTURA_ESTADOS_VIVOS_HUECO = [
  "Emitida",
  "Pagada",
  "Vencida",
  "Parcialmente pagada",
] as const;

/** Milisegundos en un día natural. */
export const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * Prefijo de query key del hueco. Cualquier `queryKey` que empiece con
 * este arreglo será invalidada al usar `invalidateHuecoFacturacion`.
 */
export const HUECO_QUERY_KEY_PREFIX = ["facturacion", "hueco"] as const;
