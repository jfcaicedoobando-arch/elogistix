import { format } from "date-fns";
/**
 * Reglas para conversión cotización → embarques, y vigencia.
 * Extraído de `cotizacion.ts` (Power-of-10).
 */

/** Costo de cotización tal como vive en BD (subset relevante a la regla). */
export interface CotizacionCostoLike {
  concepto: string;
  unidad_medida?: string | null;
  costo_unitario: number;
  /** v13.823.357: cantidad del renglón (default 1 cuando no viene). */
  cantidad?: number | null;
  /** v13.823.357: total ya calculado en BD; manda sobre cantidad × unitario. */
  costo_total?: number | null;
  moneda: string;
  proveedor?: string | null;
}

/**
 * Filtra los costos que aplican al contenedor `index` (0-based) cuando una cotización
 * se convierte en N embarques. Regla:
 *  - Costos con unidad de medida "BL" se replican SOLO en el primer embarque (index === 0).
 *  - El resto (Contenedor, Bulto, etc.) se replica en todos.
 */
export function filtrarCostosParaContenedor<T extends { unidad_medida?: string | null }>(
  costos: T[],
  index: number,
): T[] {
  return costos.filter((c) => {
    const um = c.unidad_medida ?? "Contenedor";
    if (um === "BL") return index === 0;
    return true;
  });
}

/** Forma serializable de un concepto de costo a insertar en `conceptos_costo`. */
export interface ConceptoCostoFromCotizacion {
  embarque_id: string;
  concepto: string;
  monto: number;
  moneda: string;
  proveedor_nombre: string | null;
}

/**
 * Mapea filas de `cotizacion_costos` a inserts de `conceptos_costo` para un embarque dado.
 * Pura: no toca BD ni depende de tipos de Supabase en runtime.
 *
 * v13.823.357 (Auditoría YAGNI P2 #8): el monto es el TOTAL del renglón, igual
 * que en la RPC `_crear_embarque_replicar_conceptos`: `costo_total` cuando
 * existe y, si no, `cantidad × costo_unitario` (cantidad ausente = 1). Antes se
 * copiaba sólo el costo unitario, así que un renglón de 3 × 100 llegaba al
 * embarque como 100.
 */
export function montoCostoRenglon(c: CotizacionCostoLike): number {
  const total = Number(c.costo_total);
  if (Number.isFinite(total) && total !== 0) return total;
  const cantidad = Number(c.cantidad ?? 1);
  const unitario = Number(c.costo_unitario) || 0;
  return (Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1) * unitario;
}

export function mapCostosACostosEmbarque(
  costos: CotizacionCostoLike[],
  embarqueId: string,
): ConceptoCostoFromCotizacion[] {
  return costos.map((c) => ({
    embarque_id: embarqueId,
    concepto: c.concepto,
    monto: montoCostoRenglon(c),
    moneda: c.moneda,
    proveedor_nombre: c.proveedor ?? null,
  }));
}

/**
 * Calcula la fecha de vigencia (`fecha_vigencia`) sumando `vigenciaDias` a la fecha base.
 * Devuelve string ISO `YYYY-MM-DD` (formato esperado por la columna `date` de Postgres).
 * Si `vigenciaDias` es null/undefined se usa el default de 15 días.
 */
export function calcularFechaVigencia(
  desde: Date = new Date(),
  vigenciaDias: number | null | undefined = 15,
): string {
  const dias = vigenciaDias ?? 15;
  const fecha = new Date(desde);
  fecha.setDate(fecha.getDate() + dias);
  // FE-04: día en hora LOCAL (canon `todayLocalISO`); `toISOString()` devuelve
  // el día UTC y entre 18:00-23:59 (UTC−6) adelantaba la vigencia un día.
  return format(fecha, "yyyy-MM-dd");
}
