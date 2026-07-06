/**
 * Columnas para `ComprasPagos` — extraídas en v13.182.0 (Wave 2 splits).
 */
import { defineColumns } from "@/components/shared/DataTable";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { PagoProveedorRow } from "@/features/compras/services/pagosGlobal";

export function buildPagosColumns() {
  return defineColumns<PagoProveedorRow>([
    {
      id: "fecha_pago",
      header: "Fecha",
      accessorFn: (r) => r.fecha_pago,
      cell: ({ row }) => formatDate(row.original.fecha_pago),
    },
    {
      id: "proveedor",
      header: "Proveedor",
      accessorFn: (r) => r.proveedor_nombre ?? "—",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.proveedor_nombre ?? "—"}</span>
      ),
    },
    {
      id: "folio",
      header: "Folio interno",
      accessorFn: (r) => r.factura_folio_interno ?? "—",
    },
    {
      id: "folio_prov",
      header: "Folio proveedor",
      accessorFn: (r) => r.factura_folio_proveedor ?? "—",
    },
    {
      id: "metodo",
      header: "Método",
      accessorFn: (r) => r.metodo_pago,
    },
    {
      id: "referencia",
      header: "Referencia",
      accessorFn: (r) => r.referencia ?? "—",
      cell: ({ row }) =>
        row.original.referencia ? (
          <span className="font-mono text-xs">{row.original.referencia}</span>
        ) : "—",
    },
    {
      id: "monto",
      header: "Monto",
      accessorFn: (r) => r.monto,
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">
          {formatCurrency(row.original.monto, row.original.moneda)}
        </span>
      ),
      meta: { align: "right" },
    },
  ]);
}
