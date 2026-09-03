/**
 * v13.823.69 — Sello optimista al restaurar un borrador del wizard.
 *
 * Problema que resuelve: un borrador con `cotizacionId` volvía al wizard sin el
 * `updated_at` esperado. El candado optimista quedaba en `null` y el siguiente
 * UPDATE pasaba en silencio, pisando lo que otra persona hubiera guardado.
 *
 * Reglas (siempre fallando cerrado, nunca abierto):
 *  - Se consulta el sello canónico en servidor antes de permitir escrituras.
 *  - Si el borrador traía sello y el canónico es distinto ⇒ conflicto.
 *  - Borrador legacy sin sello ⇒ se adopta el canónico (no hay nada que comparar).
 *  - Si no se puede leer el canónico (sin permiso, eliminada, red) ⇒ conflicto y
 *    se deja un sello imposible para que ningún UPDATE se aplique a ciegas.
 */

/** Sello que jamás coincidirá con una fila real: bloquea cualquier UPDATE. */
export const SELLO_BLOQUEADO = "1970-01-01T00:00:00.000Z";

export interface SelloBorradorResultado {
  /** Sello a sembrar en el candado optimista del wizard. */
  sello: string;
  /** true ⇒ mostrar conflicto accionable y no guardar encima. */
  conflicto: boolean;
}

export async function resolverSelloBorrador(opts: {
  cotizacionId: string;
  selloDraft: string | null | undefined;
  fetchSello: (id: string) => Promise<string | null>;
}): Promise<SelloBorradorResultado> {
  const { cotizacionId, selloDraft, fetchSello } = opts;
  let canonico: string | null = null;
  try {
    canonico = await fetchSello(cotizacionId);
  } catch {
    canonico = null;
  }

  if (!canonico) {
    return { sello: selloDraft || SELLO_BLOQUEADO, conflicto: true };
  }
  if (selloDraft && selloDraft !== canonico) {
    // Conservamos el sello viejo: cualquier guardado se rechazará en servidor.
    return { sello: selloDraft, conflicto: true };
  }
  return { sello: canonico, conflicto: false };
}
