/**
 * Exporta el listado de CxP visible a un CSV descargable.
 * Extraído de `Cxp.tsx` (v13.317.9) para respetar el límite Power of 10.
 */
import type { FacturaCxP } from "@/features/cxp/services";
import { todayLocalISO } from "@/lib/date/today";
import { formatCurrency } from "@/lib/formatters";

export function exportarCxpCsv(rows: readonly FacturaCxP[]) {
  if (!rows || rows.length === 0) return;
  const headers = [
    "Folio", "Folio Prov", "Proveedor", "Emisión", "Vencimiento",
    "Moneda", "Total", "Pagado", "Saldo", "Estado",
  ];
  const lines = rows.map((r) =>
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
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cxp-facturas-${todayLocalISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
