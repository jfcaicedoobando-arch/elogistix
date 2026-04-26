/**
 * Reglas de dominio puras para Cotizaciones.
 * Sin dependencias de Supabase, React Query ni UI.
 */
import { CONCEPTOS_CON_IVA_USD } from "@/constants/cotizacionConstants";
import { calcularTotalConIVA } from "@/lib/financial/financialUtils";
import type { FilaCostoLocal } from "@/types/cotizacionPLTypes";

export interface ConceptoVentaPrellenado {
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio_unitario: number;
  moneda: "USD" | "MXN";
  aplica_iva: boolean;
  total: number;
}

/**
 * A partir de las filas de costos internos del wizard, construye los conceptos de venta
 * pre-llenados, separados por moneda. Aplica IVA a los conceptos USD definidos en
 * `CONCEPTOS_CON_IVA_USD` y a todos los MXN.
 */
export function buildConceptosFromCostos(
  costosInternos: FilaCostoLocal[],
  tasaIva: number,
): { usd: ConceptoVentaPrellenado[]; mxn: ConceptoVentaPrellenado[] } {
  const usd = costosInternos
    .filter(c => c.moneda === "USD" && c.concepto.trim())
    .map(c => {
      const tieneIva = (CONCEPTOS_CON_IVA_USD as readonly string[]).includes(c.concepto);
      return {
        descripcion: c.concepto,
        unidad_medida: c.unidad_medida,
        cantidad: c.cantidad,
        precio_unitario: c.precio_venta,
        moneda: "USD" as const,
        aplica_iva: tieneIva,
        total: tieneIva
          ? calcularTotalConIVA(c.cantidad * c.precio_venta, tasaIva)
          : c.cantidad * c.precio_venta,
      };
    });

  const mxn = costosInternos
    .filter(c => c.moneda === "MXN" && c.concepto.trim())
    .map(c => ({
      descripcion: c.concepto,
      unidad_medida: c.unidad_medida,
      cantidad: c.cantidad,
      precio_unitario: c.precio_venta,
      moneda: "MXN" as const,
      aplica_iva: true,
      total: calcularTotalConIVA(c.cantidad * c.precio_venta, tasaIva),
    }));

  return { usd, mxn };
}

// ============================================================
// Reglas para conversión cotización → embarques
// ============================================================

/** Costo de cotización tal como vive en BD (subset relevante a la regla). */
export interface CotizacionCostoLike {
  concepto: string;
  unidad_medida?: string | null;
  costo_unitario: number;
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
 */
export function mapCostosACostosEmbarque(
  costos: CotizacionCostoLike[],
  embarqueId: string,
): ConceptoCostoFromCotizacion[] {
  return costos.map((c) => ({
    embarque_id: embarqueId,
    concepto: c.concepto,
    monto: c.costo_unitario,
    moneda: c.moneda,
    proveedor_nombre: c.proveedor ?? null,
  }));
}

// ============================================================
// Vigencia de cotizaciones
// ============================================================

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
  return fecha.toISOString().split("T")[0];
}
