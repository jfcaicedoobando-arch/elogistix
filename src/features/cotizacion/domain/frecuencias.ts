/**
 * Catálogo de frecuencias del cotizador (una sola fuente).
 *
 * CRM-P2.6: el ICP del lead usa su propio catálogo (más amplio: Bimestral,
 * Trimestral, Esporádica). La precarga desde una oportunidad sólo copia el
 * valor cuando existe aquí: nunca traduce ni inventa una frecuencia.
 */
export const FRECUENCIAS_COTIZACION = [
  "Diaria",
  "Semanal",
  "Quincenal",
  "Mensual",
  "Bajo demanda",
] as const;

export type FrecuenciaCotizacion = (typeof FRECUENCIAS_COTIZACION)[number];
