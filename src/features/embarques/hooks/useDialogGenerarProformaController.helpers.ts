/**
 * Helpers puros de `useDialogGenerarProformaController`.
 * Sin React. Aíslan cálculo de totales y estado inicial al abrir el diálogo.
 */
import { calcularIVA, resolverTasaConcepto, sumarSubtotales, sumarMontos, subtotalLinea } from "@/lib/financial/financialUtils";
import {
  filtrarPorContenedor,
  type FiltroContenedor,
} from "@/features/embarques/domain/conceptosPorContenedor";
import type { Tables } from "@/integrations/supabase/types";

type ConceptoVenta = Tables<"conceptos_venta">;

export interface TotalesProforma {
  subtotal_usd: number;
  iva_usd: number;
  total_usd: number;
  subtotal_mxn: number;
  iva_mxn: number;
  total_mxn: number;
}

const getter = (c: ConceptoVenta) => ({
  cantidad: Number(c.cantidad),
  precioUnitario: Number(c.precio_unitario),
});

/**
 * Calcula subtotales/IVA/totales por moneda para una proforma.
 * USD: IVA solo si el toggle por concepto está activo. MXN: IVA siempre (regla fiscal).
 */
export function calcularTotalesProforma(
  conceptosSeleccionados: ConceptoVenta[],
  ivaPorConcepto: Record<string, boolean>,
  tasaIva: number,
): TotalesProforma {
  const usd = conceptosSeleccionados.filter((c) => c.moneda === "USD");
  const mxn = conceptosSeleccionados.filter((c) => c.moneda === "MXN");

  const subtotal_usd = sumarSubtotales(usd, getter);
  const iva_usd = sumarMontos(
    usd.map((c) => (ivaPorConcepto[c.id]
      ? calcularIVA(subtotalLinea(Number(c.cantidad), Number(c.precio_unitario)), resolverTasaConcepto(c, tasaIva))
      : 0)),
  );

  const subtotal_mxn = sumarSubtotales(mxn, getter);
  const iva_mxn = sumarMontos(
    mxn.map((c) => calcularIVA(subtotalLinea(Number(c.cantidad), Number(c.precio_unitario)), resolverTasaConcepto(c, tasaIva))),
  );

  return {
    subtotal_usd,
    iva_usd,
    total_usd: subtotal_usd + iva_usd,
    subtotal_mxn,
    iva_mxn,
    total_mxn: subtotal_mxn + iva_mxn,
  };
}

/**
 * Estado inicial al pasar de cerrado→abierto: selección + IVA defaults.
 * MXN siempre IVA on; USD respeta `aplica_iva` de la fila.
 */
export function buildInitialProformaState(
  conceptosPendientes: ConceptoVenta[],
  initialFiltroContenedor: FiltroContenedor,
): { seleccionados: Set<string>; ivaPorConcepto: Record<string, boolean> } {
  const inicial = initialFiltroContenedor === "todos"
    ? conceptosPendientes
    : filtrarPorContenedor(conceptosPendientes, initialFiltroContenedor);
  const ivaInit: Record<string, boolean> = {};
  conceptosPendientes.forEach((c) => {
    ivaInit[c.id] = c.moneda === "MXN" ? true : !!c.aplica_iva;
  });
  return {
    seleccionados: new Set(inicial.map((c) => c.id)),
    ivaPorConcepto: ivaInit,
  };
}
