/**
 * P1-5 — Opción sintética para selects de catálogo.
 *
 * Al editar un embarque, el `reset` del formulario corre en cuanto el embarque
 * resuelve, pero los catálogos (navieras, agentes) llegan después. Radix Select
 * no tiene `SelectItem` para el id guardado todavía, así que pintaba el campo
 * VACÍO y al guardar se perdía el dato. Lo mismo pasa con catálogos filtrados
 * (agentes inactivos) o registros archivados.
 *
 * `necesitaOpcionSintetica` indica si hay que inyectar una opción con el id
 * guardado para que el valor siga visible.
 */

export interface OpcionCatalogo {
  id: string;
  label: string;
}

/** ¿El id guardado falta en las opciones cargadas? */
export function necesitaOpcionSintetica(
  currentId: string | null | undefined,
  opciones: ReadonlyArray<{ id: string }>,
): boolean {
  if (!currentId) return false;
  return !opciones.some((o) => o.id === currentId);
}

/**
 * Etiqueta para la opción sintética: se prefiere el nombre que ya venía en el
 * embarque; si no hay, un texto neutro que deja claro que el valor existe.
 */
export function labelOpcionSintetica(nombreGuardado: string | null | undefined): string {
  const nombre = nombreGuardado?.trim();
  return nombre ? nombre : "Valor guardado (cargando catálogo…)";
}

/**
 * Devuelve las opciones a renderizar, inyectando la del valor guardado cuando
 * el catálogo aún no la contiene.
 */
export function opcionesConValorGuardado(
  opciones: ReadonlyArray<OpcionCatalogo>,
  currentId: string | null | undefined,
  nombreGuardado: string | null | undefined,
): OpcionCatalogo[] {
  if (!necesitaOpcionSintetica(currentId, opciones)) return [...opciones];
  return [{ id: currentId as string, label: labelOpcionSintetica(nombreGuardado) }, ...opciones];
}
