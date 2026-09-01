/**
 * P1-3b: presupuesto de WALL-TIME para la corrida del cron.
 *
 * El tope de 180 documentos por corrida (`PRESUPUESTO_GLOBAL`) acota el número
 * de documentos, NO el tiempo: `reconciliarPorOrg` procesa secuencialmente y un
 * `invoices.retrieve` lento consumía hasta 15 s, así que el peor caso superaba
 * los 45 minutos. La Edge Function moría mucho antes, el mutex de cron quedaba
 * ocupado hasta su TTL y la cola no drenaba.
 *
 * Presupuesto elegido (ver comentarios en constantes): se dejan de INICIAR
 * documentos nuevos a los 95 s; el documento ya iniciado está acotado por los
 * timeouts de red, y queda margen suficiente para responder y soltar el lock.
 *
 * El reloj es inyectable para poder probar el corte de forma determinista.
 */

/** Reloj monotónico en milisegundos (no salta con ajustes de hora del sistema). */
export type Reloj = () => number;

export const relojMonotonico: Reloj = () => performance.now();

/**
 * Límite de wall-time asumido para la invocación: 150 s.
 * Supabase Edge Functions cortan la invocación por wall-clock; 150 s es el
 * límite conservador que asumimos para un cron disparado por pg_net.
 */
export const LIMITE_RUNTIME_MS = 150_000;

/**
 * Corte para INICIAR documentos nuevos: 95 s.
 * Peor caso de un documento ya iniciado ≈ 12 s (retrieve) + 12 s (acuse) +
 * escrituras de BD/bitácora/cursor (~5 s) ≈ 29 s → 95 + 29 = 124 s, con ~26 s
 * de margen para serializar la respuesta y soltar el lock antes de 150 s.
 */
export const PRESUPUESTO_WALL_MS = 95_000;

/**
 * Timeout por `invoices.retrieve` en el cron: 12 s (antes 15 s).
 * Se reduce para que una llamada iniciada justo en el límite del presupuesto
 * no rebase el margen calculado arriba. Un retrieve colgado deja la fila en
 * pending/verifying → la vuelve a tomar la corrida siguiente.
 */
export const CRON_RETRIEVE_TIMEOUT_MS = 12_000;

export interface Presupuesto {
  /** true cuando ya no se deben INICIAR documentos nuevos. */
  agotado: () => boolean;
  /** ms restantes antes del corte (0 si ya se agotó). */
  restanteMs: () => number;
}

export function crearPresupuesto(
  limiteMs: number = PRESUPUESTO_WALL_MS,
  reloj: Reloj = relojMonotonico,
): Presupuesto {
  const inicio = reloj();
  const transcurrido = () => reloj() - inicio;
  return {
    agotado: () => transcurrido() >= limiteMs,
    restanteMs: () => Math.max(0, limiteMs - transcurrido()),
  };
}
