/**
 * Reglas de dominio puras para Cotizaciones.
 * Sin dependencias de Supabase, React Query ni UI.
 */
import { CONCEPTOS_CON_IVA_USD } from "@/constants/cotizacionConstants";
import { calcularTotalConIVA } from "@/lib/financial/financialUtils";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

export interface ConceptoVentaPrellenado {
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio_unitario: number;
  moneda: "USD" | "MXN";
  aplica_iva: boolean;
  total: number;
  /** Clave SAT heredada del catálogo maestro cuando el paso 2 usó el combobox. */
  clave_sat?: string;
  /** Tasa IVA específica del producto (0.16, 0, exento). Prevalece sobre `tasaIva`. */
  tasa_iva_aplicada?: number;
}

/**
 * A partir de las filas de costos internos del wizard, construye los conceptos de venta
 * pre-llenados, separados por moneda.
 *
 * Reglas de IVA (13.291 → 13.292):
 *   - Si la fila trae `tasa_iva_aplicada` (viene del catálogo maestro `catalogo_claves_sat`),
 *     esa tasa manda: `aplica_iva = tasa > 0`, total con IVA usando la tasa del producto.
 *   - Si NO trae metadata del catálogo (fila legacy), se cae al comportamiento previo:
 *     lista blanca `CONCEPTOS_CON_IVA_USD` para USD, IVA general para MXN.
 */
export function buildConceptosFromCostos(
  costosInternos: FilaCostoLocal[],
  tasaIva: number,
): { usd: ConceptoVentaPrellenado[]; mxn: ConceptoVentaPrellenado[] } {
  const usd = costosInternos
    .filter(c => c.moneda === "USD" && c.concepto.trim())
    .map(c => {
      const tasaProducto = c.tasa_iva_aplicada;
      const desdeCatalogo = tasaProducto !== undefined;
      const tieneIva = desdeCatalogo
        ? tasaProducto! > 0
        : (CONCEPTOS_CON_IVA_USD as readonly string[]).includes(c.concepto);
      const tasaAplicar = desdeCatalogo ? (tasaProducto as number) : tasaIva;
      const subtotal = c.cantidad * c.precio_venta;
      return {
        descripcion: c.concepto,
        unidad_medida: c.unidad_medida,
        cantidad: c.cantidad,
        precio_unitario: c.precio_venta,
        moneda: "USD" as const,
        aplica_iva: tieneIva,
        total: tieneIva ? calcularTotalConIVA(subtotal, tasaAplicar) : subtotal,
        clave_sat: c.clave_sat,
        tasa_iva_aplicada: c.tasa_iva_aplicada,
      };
    });

  const mxn = costosInternos
    .filter(c => c.moneda === "MXN" && c.concepto.trim())
    .map(c => {
      const tasaProducto = c.tasa_iva_aplicada;
      const desdeCatalogo = tasaProducto !== undefined;
      // En MXN el default histórico es IVA general; sólo se apaga si el catálogo lo marca exento/tasa 0.
      const tieneIva = desdeCatalogo ? tasaProducto! > 0 : true;
      const tasaAplicar = desdeCatalogo ? (tasaProducto as number) : tasaIva;
      const subtotal = c.cantidad * c.precio_venta;
      return {
        descripcion: c.concepto,
        unidad_medida: c.unidad_medida,
        cantidad: c.cantidad,
        precio_unitario: c.precio_venta,
        moneda: "MXN" as const,
        aplica_iva: tieneIva,
        total: tieneIva ? calcularTotalConIVA(subtotal, tasaAplicar) : subtotal,
        clave_sat: c.clave_sat,
        tasa_iva_aplicada: c.tasa_iva_aplicada,
      };
    });

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

// ============================================================
// Q-04 (cont.) — Acciones permitidas en el detalle de cotización
// ============================================================
import type { AppRole } from "@/types/appRole";
import { FINANCE, OPERATIONS, SALES, hasRole } from "@/hooks/shared/permissionMatrix";

/** Estados de cotización relevantes para las acciones del detalle. */
export type EstadoCotizacionAccion = "Borrador" | "Solicitada" | "Enviada" | "Aceptada" | "Rechazada" | string;

export interface AccionesCotizacionPermitidas {
  exportarPdf: boolean;
  enviar: boolean;
  aceptar: boolean;
  rechazar: boolean;
}

/** ¿El rol puede editar/gestionar cotizaciones (capturar, enviar, aceptar, rechazar)? */
function puedeGestionarCotizacion(rol: AppRole | null | undefined): boolean {
  return hasRole(OPERATIONS, rol) || hasRole(FINANCE, rol) || hasRole(SALES, rol);
}

/**
 * Determina qué acciones del detalle de cotización deben mostrarse.
 * Pura y testeable: sin dependencias de React ni de Supabase.
 *
 * Reglas de negocio:
 *  - "Exportar PDF": siempre visible (no depende de estado, total ni rol).
 *  - "Enviar" / "Marcar enviada": sólo si el rol puede gestionar la cotización,
 *    el estado es "Borrador" o "Solicitada" y el total es mayor a cero
 *    (evita enviar/aceptar cotizaciones vacías, p.ej. un borrador en $0.00).
 *  - "Aceptar" / "Rechazar": sólo si el rol puede gestionar la cotización,
 *    el estado es "Enviada" y el total es mayor a cero.
 */
export function accionesCotizacionPermitidas(
  estado: EstadoCotizacionAccion,
  total: number,
  rol: AppRole | null | undefined,
): AccionesCotizacionPermitidas {
  const puedeGestionar = puedeGestionarCotizacion(rol);
  const tieneTotal = Number(total) > 0;

  const enviar = puedeGestionar && tieneTotal && (estado === "Borrador" || estado === "Solicitada");
  const aceptarRechazar = puedeGestionar && tieneTotal && estado === "Enviada";

  return {
    exportarPdf: true,
    enviar,
    aceptar: aceptarRechazar,
    rechazar: aceptarRechazar,
  };
}
