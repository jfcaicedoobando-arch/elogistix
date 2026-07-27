/**
 * Exporta el listado de CxP visible a un CSV descargable.
 * Extraído de `Cxp.tsx` (v13.317.9) para respetar el límite Power of 10.
 *
 * v13.320.25 — Tanda 1 auditoría toasts: usa `downloadCsvWithFeedback` para
 * confirmar éxito o avisar cuando no hay filas para exportar.
 */
import type { FacturaCxP } from "@/features/cxp/services";
import { todayLocalISO } from "@/lib/date/today";
import { formatCurrency } from "@/lib/formatters";
import { downloadCsvWithFeedback } from "@/lib/ui/notifyCsvExport";

export function exportarCxpCsv(rows: readonly FacturaCxP[]) {
  const headers = [
    "Folio", "Folio Prov", "Proveedor", "Emisión", "Vencimiento",
    "Moneda", "Total", "Pagado", "Saldo", "Estado",
  ];
  const lines = (rows ?? []).map((r) =>
    [
      r.folio_interno,
      `"${(r.folio_proveedor || "").replace(/"/g, '""')}"`,
      `"${(r.proveedor_nombre || "").replace(/"/g, '""')}"`,
      r.fecha_emision,
      r.fecha_vencimiento || "",
      r.moneda,
      formatCurrency(r.total, r.moneda),
      formatCurrency(r.pagado, r.moneda),
      formatCurrency(r.saldo, r.moneda),
      r.estatus,
    ].join(","),
  );
  downloadCsvWithFeedback({
    filename: `cxp-facturas-${todayLocalISO()}.csv`,
    csv: [headers.join(","), ...lines].join("\n"),
    rowCount: rows?.length ?? 0,
    emptyWarning: { description: "No hay facturas CxP para exportar con los filtros actuales." },
  });
}
