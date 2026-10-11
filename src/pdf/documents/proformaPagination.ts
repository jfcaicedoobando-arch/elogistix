import { textRowBudget } from "../text/rowLayoutBudget";
import { formatearDescripcionConcepto } from "./proformaShared";
import type { ConceptoVenta } from "./proformaConceptosColumns";

// The narrowest proforma description has over 100pt of inner width. Eight
// characters per line is conservative for the bundled 9pt Inter face. A 280pt
// group budget leaves room for headings, table header, notices and two totals
// blocks inside the 696pt portrait content area.
const GROUP_BUDGET = 280;
export function proformaRowBudget(row: ConceptoVenta): number {
  return textRowBudget(formatearDescripcionConcepto(row.descripcion), 8);
}
export function proformaRowCanFlow(row: ConceptoVenta): boolean {
  return proformaRowBudget(row) > GROUP_BUDGET;
}
export function keepProformaGroupTogether(rows: ConceptoVenta[]): boolean {
  return rows.reduce((height, row) => height + proformaRowBudget(row), 0) <= GROUP_BUDGET;
}
