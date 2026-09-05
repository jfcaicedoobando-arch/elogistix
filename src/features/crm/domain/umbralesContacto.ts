/**
 * Umbrales canónicos del concepto "lead sin contactar" en el CRM.
 *
 * Hay DOS contextos deliberados (no es una contradicción):
 * - NBA ("Mi día", qué hacer ahora): alerta temprana a las >24 horas.
 * - Tarjeta semanal ("Esta semana"): seguimiento de leads llevan >7 días.
 *
 * Centralizados aquí para que textos, FAQ y filtros no vuelvan a divergir.
 * Cambiar cualquiera requiere una decisión de negocio.
 */

/** NBA: un lead nuevo sin actividad se sugiere contactar después de 24 h. */
export const NBA_LEAD_SIN_CONTACTAR_HORAS = 24;

/** Tarjeta "Leads sin contactar" del resumen semanal: más de 7 días. */
export const SEMANA_LEAD_SIN_CONTACTAR_DIAS = 7;
