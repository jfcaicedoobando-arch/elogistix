import { describe, expect, it } from "vitest";
import { textRowBudget } from "../rowLayoutBudget";
import { keepProformaGroupTogether, proformaRowCanFlow } from "../../documents/proformaPagination";
import type { ConceptoVenta } from "../../documents/proformaConceptosColumns";
import { Children, isValidElement, type ReactNode } from "react";
import { LibroPagosDocument, type FilaLibroPagosExport } from "../../documents/LibroPagosDocument";
import { DataTable } from "../../components/DataTable";

const row = (descripcion: string) => ({ descripcion }) as ConceptoVenta;
describe("Bounded PDF row grouping", () => {
  it("retains short ordinary rows without changing their text", () => {
    const r = row("Servicio documental sintético");
    const before = JSON.stringify(r);
    expect(proformaRowCanFlow(r)).toBe(false);
    expect(keepProformaGroupTogether([r])).toBe(true);
    expect(JSON.stringify(r)).toBe(before);
  });
  it("lets oversized words, whitespace and explicit newlines flow", () => {
    for (const text of ["segmento ".repeat(80), "W".repeat(900), "dato\n".repeat(80), " ".repeat(900), "dato\t".repeat(80)]) {
      expect(proformaRowCanFlow(row(text))).toBe(true);
      expect(keepProformaGroupTogether([row(text)])).toBe(false);
    }
  });
  it("budgets per-row padding and bounds entire container groups", () => {
    expect(textRowBudget("", 8)).toBe(24);
    expect(keepProformaGroupTogether(Array.from({ length: 30 }, () => row("")))).toBe(false);
    expect(keepProformaGroupTogether(Array.from({ length: 26 }, () => row("Servicio por contenedor")))).toBe(false);
  });
  it.each([[19, 276, false], [20, 290, true]] as const)("proforma: %i explicit lines budget exactly %i points", (lines, points, canFlow) => {
    const r = row(Array.from({ length: lines }, () => "dato").join("\n"));
    expect(textRowBudget(r.descripcion, 8)).toBe(points);
    expect(proformaRowCanFlow(r)).toBe(canFlow);
    expect(keepProformaGroupTogether([r])).toBe(!canFlow);
  });
  it("applies the same bound to the sum of group rows", () => {
    const lines = (count: number) => row(Array.from({ length: count }, () => "dato").join("\n"));
    expect(textRowBudget(lines(9).descripcion, 8) * 2).toBe(272);
    expect(keepProformaGroupTogether([lines(9), lines(9)])).toBe(true);
    expect(textRowBudget(lines(9).descripcion, 8) + textRowBudget(lines(10).descripcion, 8)).toBe(286);
    expect(keepProformaGroupTogether([lines(9), lines(10)])).toBe(false);
  });
  it.each([[12, 178, false], [13, 192, true]] as const)("payment: %i explicit lines budget exactly %i points", (lines, points, canFlow) => {
    const payment: FilaLibroPagosExport = {
      fecha: "01", tipo: "Pago", contraparte: "QA", documento: "FP1", metodo: "03",
      referencia: Array.from({ length: lines }, () => "abc").join("\n"), cuenta: "QA",
      monto: "MXN 1.00", tipoCambio: "1", fuenteTc: "QA", montoMxn: "MXN 1.00", estado: "QA",
    };
    const doc = LibroPagosDocument({ filas: [payment], resumen: { periodo: "QA", cobrado: "0", pagado: "1", neto: "-1", conteo: "1" } });
    type TableProps = { children?: ReactNode; allowRowWrap?: (r: FilaLibroPagosExport) => boolean };
    function findPredicate(node: ReactNode): TableProps["allowRowWrap"] {
      if (!isValidElement<TableProps>(node)) return undefined;
      if (node.type === DataTable) return node.props.allowRowWrap;
      return Children.toArray(node.props.children).map(findPredicate).find(Boolean);
    }
    const predicate = findPredicate(doc);
    expect(predicate).toBeTypeOf("function");
    expect(textRowBudget(payment.referencia, 3)).toBe(points);
    expect(predicate?.(payment)).toBe(canFlow);
  });
});
