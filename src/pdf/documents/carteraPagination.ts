import type { BloqueCarteraPdf, FilaFacturaPdf } from "./ReporteCarteraDocument";
import { textRowBudget } from "../text/rowLayoutBudget";

// Bound the number of rows re-laid out by the legacy pagination engine.
// This is not a physical page size: variable-height rows still paginate naturally.
export const CARTERA_PDF_BATCH_ROWS = 100;
interface PageBlock { bloque: BloqueCarteraPdf; continuation: boolean }
export function carteraPdfPages(blocks: BloqueCarteraPdf[]): PageBlock[][] {
  if (blocks.reduce((sum, block) => sum + block.facturas.length, 0) <= CARTERA_PDF_BATCH_ROWS) {
    return [blocks.map((bloque) => ({ bloque, continuation: false }))];
  }
  return blocks.flatMap((block) => {
    const pages: PageBlock[][] = [];
    if (block.facturas.length === 0) return [[{ bloque: block, continuation: false }]];
    for (let start = 0; start < block.facturas.length; start += CARTERA_PDF_BATCH_ROWS) {
      pages.push([{ bloque: { ...block, facturas: block.facturas.slice(start, start + CARTERA_PDF_BATCH_ROWS) }, continuation: start > 0 }]);
    }
    return pages;
  });
}

// Ordinary rows remain indivisible. A conservative bound opts exceptionally
// tall text into the renderer's natural splitting; it never fixes row height.
export function carteraRowCanFlow(row: FilaFacturaPdf): boolean {
  return Math.max(
    textRowBudget(row.contraparte, 10), textRowBudget(row.folio, 4),
    textRowBudget(row.expediente, 4), textRowBudget(row.vencimiento, 4),
    textRowBudget(row.dias, 1), textRowBudget(row.bucket, 3),
  ) > 400;
}
