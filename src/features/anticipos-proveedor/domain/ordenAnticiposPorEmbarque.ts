/**
 * Orden de anticipos al aplicarlos a una factura: primero los que están
 * ligados al mismo embarque (expediente) que la factura, luego el resto.
 *
 * Función pura para poder probarla sin red ni UI.
 */
export interface AnticipoOrdenable {
  id: string;
  embarque_id?: string | null;
  fecha_anticipo?: string | null;
}

/** ¿El anticipo pertenece al mismo embarque que la factura? */
export function esMismoEmbarque(
  anticipoEmbarqueId?: string | null,
  facturaEmbarqueId?: string | null,
): boolean {
  return Boolean(anticipoEmbarqueId) && anticipoEmbarqueId === facturaEmbarqueId;
}

/**
 * Devuelve una copia ordenada: mismo embarque primero y, dentro de cada grupo,
 * el anticipo más antiguo primero (se consume el dinero más viejo).
 */
export function ordenarAnticiposPorEmbarque<T extends AnticipoOrdenable>(
  anticipos: readonly T[],
  facturaEmbarqueId?: string | null,
): T[] {
  return [...anticipos].sort((a, b) => {
    const pa = esMismoEmbarque(a.embarque_id, facturaEmbarqueId) ? 0 : 1;
    const pb = esMismoEmbarque(b.embarque_id, facturaEmbarqueId) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return (a.fecha_anticipo ?? "").localeCompare(b.fecha_anticipo ?? "");
  });
}
