/**
 * Exportación CSV de la antigüedad de saldos de CxP (por proveedor).
 */
import { downloadCsvWithFeedback } from "@/lib/ui/notifyCsvExport";
import { CXP_AGING_ALCANCE, type CxpAgingRow } from "@/features/cxp/services/cxpAging";
import { CUBETAS_AGING, CUBETA_LABELS } from "@/lib/aging/buckets";
import { AGING_EXPORT_ALCANCE, csvTexto, describirFiltrosAging, type AgingTableFilters } from "@/lib/aging/reportScope";

export function exportarCxpAgingCsv(
  rows: readonly CxpAgingRow[],
  moneda: string,
  fecha: string,
  filtros: AgingTableFilters = {},
) {
  // Encabezados de cubeta derivados del catálogo único (paso 6 de la auditoría).
  const headers = ["Proveedor", "Moneda", "Facturas", ...CUBETAS_AGING.map((c) => CUBETA_LABELS[c]), "Total", "Fecha para antigüedad", "Filtros de tabla", "Alcance de filas", "Alcance de saldos"];
  const lines = (rows ?? []).map((r) =>
    [
      `"${r.proveedor_nombre.replace(/"/g, '""')}"`,
      r.moneda,
      r.num_facturas, r.vigente, r.d_1_30, r.d_31_60, r.d_61_90, r.mas_90, r.saldo_total,
      fecha, csvTexto(describirFiltrosAging(filtros)), csvTexto(AGING_EXPORT_ALCANCE), csvTexto(CXP_AGING_ALCANCE),
    ].join(","),
  );
  downloadCsvWithFeedback({
    filename: `aging-cxp-${moneda}-${fecha}.csv`,
    csv: [headers.join(","), ...lines].join("\n"),
    rowCount: rows?.length ?? 0,
    emptyWarning: { description: "No hay saldos de proveedores para exportar con los filtros actuales." },
  });
}
