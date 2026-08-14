/**
 * Cálculo puro del resumen de totales tipo "invoice" para las tablas de
 * conceptos de factura de proveedor.
 *
 * El subtotal/IVA/IEPS salen de la suma de las líneas del CFDI; las
 * retenciones y el total del documento vienen de la factura (cuando existen).
 * Si el total del documento no coincide con lo que suman las líneas se reporta
 * la diferencia en lugar de fingir que cuadra.
 */
import currency from "currency.js";
import { totalLinea, sumarConceptos, type ConceptoParaCuadre } from "./cuadreConceptos";

export interface LineaConceptoResumen extends ConceptoParaCuadre {
  iva?: number | null;
  ieps?: number | null;
}

export interface ResumenConceptos {
  subtotal: number;
  iva: number;
  ieps: number;
  retenciones: number;
  /** Total calculado a partir de las líneas (subtotal + IVA + IEPS − retenciones). */
  totalCalculado: number;
  /** Total del documento cuando se conoce; si no, el calculado. */
  total: number;
  /** total del documento − totalCalculado (0 si cuadra o no hay referencia). */
  diferencia: number;
  cuadra: boolean;
}

const TOLERANCIA = 0.01;

function n(v: number | null | undefined): number {
  return Number(v) || 0;
}

/** Total con impuestos de una sola línea: (unitario × cantidad) + IVA + IEPS. */
export function totalLineaConImpuestos(linea: LineaConceptoResumen): number {
  return currency(totalLinea(linea), { precision: 4 })
    .add(n(linea.iva))
    .add(n(linea.ieps))
    .value;
}

export function calcularResumenConceptos(
  lineas: ReadonlyArray<LineaConceptoResumen>,
  documento?: { retenciones?: number | null; total?: number | null },
): ResumenConceptos {
  const subtotal = sumarConceptos(lineas);
  const iva = lineas.reduce((acc, l) => currency(acc, { precision: 4 }).add(n(l.iva)).value, 0);
  const ieps = lineas.reduce((acc, l) => currency(acc, { precision: 4 }).add(n(l.ieps)).value, 0);
  const retenciones = n(documento?.retenciones);

  const totalCalculado = currency(subtotal, { precision: 4 })
    .add(iva)
    .add(ieps)
    .subtract(retenciones)
    .value;

  const totalDoc = documento?.total != null ? Number(documento.total) : null;
  const diferencia =
    totalDoc == null
      ? 0
      : currency(totalDoc, { precision: 4 }).subtract(totalCalculado).value;

  return {
    subtotal,
    iva,
    ieps,
    retenciones,
    totalCalculado,
    total: totalDoc ?? totalCalculado,
    diferencia: Math.abs(diferencia) <= TOLERANCIA ? 0 : diferencia,
    cuadra: Math.abs(diferencia) <= TOLERANCIA,
  };
}
