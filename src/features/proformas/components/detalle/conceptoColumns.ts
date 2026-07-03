/**
 * Columnas de la tabla de conceptos de la vista de detalle de proforma.
 * Extraídas del route para mantenerlo ≤ 200 líneas (Power of 10 #4).
 */
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrency } from "@/lib/formatters";
import type { ConceptoVentaRow } from "@/features/proformas/services";

export const conceptoColumns: ColumnDef<ConceptoVentaRow, unknown>[] = defineColumns<ConceptoVentaRow>([
  { id: "descripcion", header: "Descripción", cell: ({ row }) => row.original.descripcion },
  {
    id: "cantidad",
    header: "Cant.",
    meta: { align: "right", className: "w-[80px] tabular-nums" },
    cell: ({ row }) => Number(row.original.cantidad),
  },
  {
    id: "precio",
    header: "Precio unitario",
    meta: { align: "right", className: "w-[140px] tabular-nums" },
    cell: ({ row }) => formatCurrency(Number(row.original.precio_unitario), row.original.moneda),
  },
  {
    id: "importe",
    header: "Importe",
    meta: { align: "right", className: "w-[140px] tabular-nums font-medium" },
    cell: ({ row }) => formatCurrency(
      Number(row.original.cantidad) * Number(row.original.precio_unitario),
      row.original.moneda,
    ),
  },
  {
    id: "iva",
    header: "IVA",
    meta: { align: "center", className: "w-[80px] text-xs" },
    cell: ({ row }) => (row.original.aplica_iva || row.original.moneda === "MXN" ? "Sí" : "No"),
  },
]);
