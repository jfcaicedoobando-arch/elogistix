/**
 * A1/A7 (v13.823.153) — Distingue un borrador REALMENTE vacío de una cotización
 * con contenido económico.
 *
 * Causa del bug: `useConceptosVentaCotizacion` siembra siempre una fila vacía USD
 * y una MXN cuando no hay conceptos. El wizard calculaba `sinImportes` sólo con
 * `length === 0`, así que un borrador vacío se consideraba "con importes", el
 * mapper del paso 1 omitía `moneda` y el vínculo con una oportunidad en MXN
 * seguía fallando por "monedas distintas".
 *
 * Regla: una fila cuenta como contenido real si tiene descripción o algún
 * importe distinto de cero (cantidad × precio, o total). Así no basta con que el
 * total sume cero: conceptos reales compensados siguen protegiendo la moneda.
 * Los costos internos con precio de venta capturado también cuentan.
 */

export interface ConceptoImporteLike {
  descripcion?: string | null;
  cantidad?: number | null;
  precio_unitario?: number | null;
  total?: number | null;
}

export interface CostoImporteLike {
  precio_venta?: number | null;
  /** Filas reales del wizard (`FilaCostoLocal`): costo capturado sin venta aún. */
  cantidad?: number | null;
  costo_unitario?: number | null;
  costo_total?: number | null;
  /** Variante persistida/legacy que sí trae un monto plano. */
  monto?: number | null;
}

const num = (v: number | null | undefined): number => Number(v) || 0;

/** true cuando la fila tiene descripción o algún importe capturado. */
export function conceptoTieneContenido(c: ConceptoImporteLike): boolean {
  if ((c.descripcion ?? "").trim().length > 0) return true;
  return num(c.cantidad) * num(c.precio_unitario) !== 0 || num(c.total) !== 0;
}

export function costoTieneContenido(c: CostoImporteLike): boolean {
  return num(c.precio_venta) !== 0 || num(c.monto) !== 0;
}

/**
 * true sólo si NINGÚN concepto de venta (USD/MXN) ni costo interno tiene
 * contenido económico: es un borrador que puede adoptar la moneda del CRM.
 */
export function esBorradorSinImportes(
  conceptosUSD: ConceptoImporteLike[],
  conceptosMXN: ConceptoImporteLike[],
  costosInternos: CostoImporteLike[] = [],
): boolean {
  const hayConceptos = [...conceptosUSD, ...conceptosMXN].some(conceptoTieneContenido);
  if (hayConceptos) return false;
  return !costosInternos.some(costoTieneContenido);
}
