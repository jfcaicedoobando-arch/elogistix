/**
 * Helpers puros de `useDialogGenerarProformaController`.
 * Sin React. Aíslan cálculo de totales y estado inicial al abrir el diálogo.
 *
 * R179-01: el cálculo propio del modal se retiró. Ahora delega en el dominio
 * (`@/features/proformas/domain`), única fuente de verdad fiscal
 * (regla B-09: NO se fuerza IVA por moneda; `aplica_iva=false` manda y las
 * tasas explícitas de la fila se conservan). Antes el modal mostraba IVA 0 y
 * el RPC guardaba 16% porque el cliente enviaba un override `true` para MXN.
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
 * Los overrides del usuario sólo existen para USD (contrato vigente del modal);
 * MXN se resuelve con el flag/tasa de la fila, igual que el RPC y el PDF.
 */
export function calcularTotalesProforma(
  conceptosSeleccionados: ConceptoVenta[],
  ivaPorConcepto: Record<string, boolean>,
  tasaIva: number,
): TotalesProforma {
  const overridesUsd: Record<string, boolean> = {};
  conceptosSeleccionados.forEach((c) => {
    if (c.moneda === "USD" && c.id in ivaPorConcepto) overridesUsd[c.id] = ivaPorConcepto[c.id];
  });
  return calcularTotalesDominio(conceptosSeleccionados, tasaIva, overridesUsd);
}

/**
 * Estado inicial al pasar de cerrado→abierto: selección + IVA defaults.
 * El switch/badge de cada fila arranca del tratamiento fiscal guardado, sin
 * forzar IVA por moneda.
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
    ivaInit[c.id] = ivaDeFila(c);
  });
  return {
    seleccionados: new Set(inicial.map((c) => c.id)),
    ivaPorConcepto: ivaInit,
  };
}
