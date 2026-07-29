/**
 * Match costos internos ↔ conceptos de venta de una cotización.
 * Extraído de `SeccionCostosInternosPLDetalle.tsx` (auditoría 2026-07-29,
 * O3 / S1-08) para tener UNA sola normalización y un solo lugar donde
 * leer el riesgo.
 *
 * RIESGO CONOCIDO: el match es por DESCRIPCIÓN normalizada (trim +
 * lowercase) porque `cotizacion_costos` no guarda referencia al concepto
 * de venta (los conceptos viven en el jsonb `cotizaciones.conceptos_venta`).
 * Si el usuario renombra un concepto después de capturar costos, el match
 * por nombre falla y se usa el fallback POSICIONAL: la venta puede
 * asignarse al costo equivocado silenciosamente (P&L y profit
 * distorsionados). El FIX A11 (tabla hija para `conceptos_venta`)
 * habilitará match por id estable; al aplicarlo, sustituir este helper
 * por un join por `concepto_venta_id` y eliminar el fallback posicional.
 */

/** Normalización canónica para comparar nombres de concepto. */
export function normalizeConceptoNombre(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/**
 * Busca el concepto de venta que corresponde a un costo.
 * 1) match por descripción normalizada;
 * 2) fallback POSICIONAL (ver riesgo arriba): toma `conceptos[fallback.idx]`
 *    y avanza el índice SOLO cuando se usa el fallback — no cambiar este
 *    detalle sin migrar los costos ya persistidos.
 */
export function matchConceptoVenta<T extends { descripcion: string }>(
  conceptos: T[],
  concepto: string,
  fallback: { idx: number },
): T | undefined {
  const objetivo = normalizeConceptoNombre(concepto);
  const porNombre = conceptos.find((v) => normalizeConceptoNombre(v.descripcion) === objetivo);
  if (porNombre) return porNombre;
  return conceptos[fallback.idx++];
}
