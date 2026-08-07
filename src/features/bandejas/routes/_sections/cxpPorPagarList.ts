/**
 * Configuración de filtrado/orden de la bandeja "CxP — Por pagar" y derivación
 * del lote de pago (mismo proveedor + misma moneda).
 * Extraído de la ruta para respetar el límite de 200 líneas.
 */
import type { OrigenProveedor } from "@/features/cxp";
import type { CxpRow } from "./cxpPorPagarColumns";

export interface CxpFilters extends Record<string, string> {
  moneda: string;
  vencidas: string;
}

export const CXP_FILTERS_DEFAULTS: CxpFilters = {
  moneda: "todas",
  vencidas: "todas",
};

export function cxpSearchAccessor(r: CxpRow): string {
  return `${r.proveedor_nombre ?? ""} ${r.folio_proveedor ?? ""} ${r.expediente ?? ""}`;
}

export function cxpFilterPredicate(r: CxpRow, ff: CxpFilters): boolean {
  if (ff.moneda !== "todas" && r.moneda !== ff.moneda) return false;
  const dias = r.dias_para_vencer ?? 0;
  if (ff.vencidas === "si" && dias >= 0) return false;
  if (ff.vencidas === "no" && dias < 0) return false;
  return true;
}

const texto = (v: string | null | undefined) => v ?? "";

export const CXP_SORTERS = {
  proveedor: (a: CxpRow, b: CxpRow) =>
    texto(a.proveedor_nombre).localeCompare(texto(b.proveedor_nombre)),
  folio: (a: CxpRow, b: CxpRow) =>
    texto(a.folio_proveedor).localeCompare(texto(b.folio_proveedor)),
  vencimiento: (a: CxpRow, b: CxpRow) =>
    texto(a.fecha_vencimiento).localeCompare(texto(b.fecha_vencimiento)),
  dias: (a: CxpRow, b: CxpRow) => (a.dias_para_vencer ?? 0) - (b.dias_para_vencer ?? 0),
  total: (a: CxpRow, b: CxpRow) => Number(a.total) - Number(b.total),
  pagado: (a: CxpRow, b: CxpRow) => Number(a.pagado) - Number(b.pagado),
  saldo: (a: CxpRow, b: CxpRow) => Number(a.saldo) - Number(b.saldo),
};

export interface LotePagoSeleccion {
  proveedorId: string;
  proveedorNombre: string;
  proveedorOrigen: OrigenProveedor;
  moneda: string;
  facturas: {
    factura_id: string;
    folio_proveedor: string | null;
    fecha_vencimiento: string | null;
    saldo: number;
  }[];
}

/** Devuelve el lote sólo si hay ≥2 facturas del mismo proveedor y moneda. */
export function derivarLote(seleccionadas: CxpRow[]): LotePagoSeleccion | null {
  if (seleccionadas.length < 2) return null;
  const primera = seleccionadas[0];
  const mismoProveedor = seleccionadas.every((r) => r.proveedor_id === primera.proveedor_id);
  const mismaMoneda = seleccionadas.every((r) => r.moneda === primera.moneda);
  if (!mismoProveedor || !mismaMoneda || !primera.proveedor_id) return null;
  return {
    proveedorId: primera.proveedor_id,
    proveedorNombre: primera.proveedor_nombre ?? "",
    proveedorOrigen: (primera.proveedor_origen ?? null) as OrigenProveedor,
    moneda: primera.moneda,
    facturas: seleccionadas.map((r) => ({
      factura_id: r.factura_id,
      folio_proveedor: r.folio_proveedor,
      fecha_vencimiento: r.fecha_vencimiento,
      saldo: Number(r.saldo ?? 0),
    })),
  };
}
