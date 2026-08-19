/**
 * Exportación CSV de la antigüedad de saldos de CxC (por cliente).
 */
import { downloadCsvWithFeedback } from "@/lib/ui/notifyCsvExport";
import type { CxcAgingRow } from "@/features/cxc/services/cxcAging";
import { CUBETAS_AGING, CUBETA_LABELS } from "@/lib/aging/buckets";

export function exportarCxcAgingCsv(
  rows: readonly CxcAgingRow[],
  moneda: string,
  fecha: string,
) {
  // Encabezados de cubeta derivados del catálogo único (paso 6 de la auditoría).
  const headers = ["Cliente", "Moneda", "Facturas", ...CUBETAS_AGING.map((c) => CUBETA_LABELS[c]), "Total"];
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
