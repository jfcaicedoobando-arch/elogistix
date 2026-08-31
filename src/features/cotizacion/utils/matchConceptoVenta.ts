/**
 * Match costos internos ↔ conceptos de venta de una cotización.
 * Extraído de `SeccionCostosInternosPLDetalle.tsx` (auditoría 2026-07-29,
 * O3 / S1-08) para tener UNA sola normalización y un solo lugar donde
 * leer el riesgo.
 *
 * A-5 (v13.815.0): se eliminó el fallback POSICIONAL. `cotizacion_costos` no
 * guarda referencia al concepto de venta, así que el match es por DESCRIPCIÓN
 * normalizada (trim + lowercase). Cuando el usuario renombra o reordena
 * conceptos, antes se emparejaba por índice y la venta podía quedar asignada
 * al costo equivocado en silencio (P&L y profit distorsionados). Hoy, si no
 * hay coincidencia de nombre, el costo se queda SIN venta emparejada y la UI
 * muestra el aviso de sincronización existente.
 */

/** Normalización canónica para comparar nombres de concepto. */
export function normalizeConceptoNombre(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/**
 * Busca el concepto de venta que corresponde a un costo por descripción
 * normalizada. Devuelve `undefined` cuando no hay match (sin adivinar).
 */
export function matchConceptoVenta<T extends { descripcion: string }>(
  conceptos: T[],
  concepto: string,
): T | undefined {
  const objetivo = normalizeConceptoNombre(concepto);
  if (!objetivo) return undefined;
  return conceptos.find((v) => normalizeConceptoNombre(v.descripcion) === objetivo);
}
