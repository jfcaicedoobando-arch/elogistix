import { roundMoney } from "@/lib/financial/financialUtils";
import { calcularResumenConceptos, type LineaConceptoResumen } from "./resumenConceptos";

export interface ImpuestosNoDesglosados { iva: number; ieps: number }
export interface ImportesFacturaConceptos {
  subtotal: number;
  iva: number;
  ieps: number;
  retenciones: number;
  total: number;
}

/** Diferencia explícita cabecera/partidas; no inventa una asignación fiscal. */
export function impuestosNoDesglosados(
  lineas: ReadonlyArray<LineaConceptoResumen>,
  cabecera: Pick<ImportesFacturaConceptos, "iva" | "ieps">,
): ImpuestosNoDesglosados {
  const suma = calcularResumenConceptos(lineas);
  return {
    iva: roundMoney(cabecera.iva - suma.iva),
    ieps: roundMoney(cabecera.ieps - suma.ieps),
  };
}

/** Espejo del cálculo de la RPC: partidas + impuestos globales explícitos. */
export function importesConceptosEditados(
  lineas: ReadonlyArray<LineaConceptoResumen>,
  globales: ImpuestosNoDesglosados,
  retenciones: number,
): ImportesFacturaConceptos {
  const suma = calcularResumenConceptos(lineas);
  const subtotal = roundMoney(suma.subtotal);
  const iva = roundMoney(suma.iva + globales.iva);
  const ieps = roundMoney(suma.ieps + globales.ieps);
  return { subtotal, iva, ieps, retenciones, total: roundMoney(subtotal + iva + ieps - retenciones) };
}
