/**
 * Helpers puros de `useDialogGenerarProformaController`.
 * Sin React. Aíslan cálculo de totales y estado inicial al abrir el diálogo.
 *
 * R4-10: delega al dominio sin overrides booleanos de IVA en ninguna moneda.
 */
import {
  calcularTotalesProforma as calcularTotalesDominio,
  type TotalesProforma,
} from "@/features/proformas/domain";
import {
  filtrarPorContenedor,
  type FiltroContenedor,
} from "@/features/embarques/domain/conceptosPorContenedor";
import { ivaDeFila } from "@/features/embarques/domain/ivaConceptoVenta";
import type { Tables } from "@/integrations/supabase/types";

type ConceptoVenta = Tables<"conceptos_venta">;

export type { TotalesProforma };

export { ivaDeFila };

/**
 * Calcula subtotales/IVA/totales por moneda para una proforma.
 * Usa el tratamiento fiscal guardado, igual que el RPC y el PDF.
 */
export function calcularTotalesProforma(
  conceptosSeleccionados: ConceptoVenta[],
  tasaIva: number,
): TotalesProforma {
  return calcularTotalesDominio(conceptosSeleccionados, tasaIva);
}

/**
 * Estado inicial al pasar de cerrado→abierto: selección + IVA defaults.
 * El switch/badge de cada fila arranca del tratamiento fiscal guardado, sin
 * forzar IVA por moneda.
 */
export function buildInitialProformaState(
  conceptosPendientes: ConceptoVenta[],
  initialFiltroContenedor: FiltroContenedor,
): { seleccionados: Set<string> } {
  const inicial = initialFiltroContenedor === "todos"
    ? conceptosPendientes
    : filtrarPorContenedor(conceptosPendientes, initialFiltroContenedor);
  return {
    seleccionados: new Set(inicial.map((c) => c.id)),
  };
}
