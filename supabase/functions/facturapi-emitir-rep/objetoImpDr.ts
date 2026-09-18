/**
 * Resolución de `ObjetoImpDR` (Complemento de Pagos 2.0) para el documento
 * relacionado de un REP.
 *
 * Regla fiscal: "01" (No objeto de impuesto) sólo cuando TODOS los renglones de
 * la factura son "no objeto" — entonces se omite el nodo `ImpuestosDR`, porque
 * el SAT no admite declarar un impuesto inexistente. En cualquier otro caso
 * (incluidas las facturas mixtas) es "02", declarando únicamente los impuestos
 * de los renglones que sí causan impuesto. Nunca se reclasifica un tratamiento
 * a Exento ni a tasa 0%.
 */
import {
  esConceptoNoObjeto,
  importeDeConcepto,
  resolverGruposTrasladoDr,
  type ConceptoTraslado,
} from "./trasladoDr.ts";

export interface NoObjetoDr<T extends ConceptoTraslado> {
  objetoImpDr: "01" | "02";
  hayNoObjeto: boolean;
  /** Renglones que SÍ causan impuesto (sin los "no objeto"). */
  gravables: T[];
  /** Importe (sin impuestos) de los renglones "no objeto". */
  importeNoObjeto: number;
  /** Grupos de traslado: vacío cuando el documento entero es "no objeto". */
  grupos: ReturnType<typeof resolverGruposTrasladoDr>;
}

export function resolverObjetoImpDr(
  conceptos: ConceptoTraslado[] | null | undefined,
): "01" | "02" {
  const lista = conceptos ?? [];
  return lista.length > 0 && lista.every(esConceptoNoObjeto) ? "01" : "02";
}

export function resolverNoObjetoDr<T extends ConceptoTraslado>(
  conceptos: T[] | null | undefined,
): NoObjetoDr<T> {
  const lista = conceptos ?? [];
  const objetoImpDr = resolverObjetoImpDr(lista);
  const gravables = lista.filter((c) => !esConceptoNoObjeto(c));
  return {
    objetoImpDr,
    hayNoObjeto: lista.some(esConceptoNoObjeto),
    gravables,
    importeNoObjeto: lista
      .filter(esConceptoNoObjeto)
      .reduce((acc, c) => acc + importeDeConcepto(c), 0),
    grupos: objetoImpDr === "01" ? [] : resolverGruposTrasladoDr(gravables),
  };
}
