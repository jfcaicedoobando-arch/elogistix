/**
 * Exportación CSV de la antigüedad de saldos de CxC (por cliente).
 */
import { downloadCsvWithFeedback } from "@/lib/ui/notifyCsvExport";
import type { CxcAgingRow } from "@/features/cxc/services/cxcAging";

export function exportarCxcAgingCsv(
  rows: readonly CxcAgingRow[],
  moneda: string,
  fecha: string,
) {
  const headers = ["Cliente", "Moneda", "Facturas", "Vigente", "1-30", "31-60", "61-90", "+90", "Total"];
  const lines = (rows ?? []).map((r) =>
    [
      `"${r.cliente_nombre.replace(/"/g, '""')}"`,
      r.moneda,
      r.num_facturas, r.vigente, r.d_1_30, r.d_31_60, r.d_61_90, r.mas_90, r.saldo_total,
    ].join(","),
  );
  downloadCsvWithFeedback({
    filename: `aging-cxc-${moneda}-${fecha}.csv`,
    csv: [headers.join(","), ...lines].join("\n"),
    rowCount: rows?.length ?? 0,
    emptyWarning: { description: "No hay saldos de clientes para exportar con los filtros actuales." },
  });
}
