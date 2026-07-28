/**
 * Columnas de la tabla de conceptos de la vista de detalle de proforma.
 * Extraídas del route para mantenerlo ≤ 200 líneas (Power of 10 #4).
 * La moneda se muestra en el encabezado (no por celda) cuando todos los
 * conceptos comparten divisa, para reducir ruido visual.
 */
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrency, formatNumber } from "@/lib/formatters";
import type { ConceptoVentaRow } from "@/features/proformas/services";

/** Devuelve la moneda común de los conceptos, o `null` si hay mezcla. */
export function monedaComun(conceptos: ConceptoVentaRow[]): string | null {
  const monedas = new Set(conceptos.map((c) => c.moneda));
  return monedas.size === 1 ? (conceptos[0]?.moneda ?? null) : null;
}

export function buildConceptoColumns(
  moneda: string | null,
): ColumnDef<ConceptoVentaRow, unknown>[] {
  const sufijo = moneda ? ` (${moneda})` : "";
  const importe = (row: ConceptoVentaRow) =>
    Number(row.cantidad) * Number(row.precio_unitario);
  return defineColumns<ConceptoVentaRow>([
    { id: "descripcion", header: "Descripción", cell: ({ row }) => row.original.descripcion },
    {
      id: "cantidad",
      header: "Cant.",
      meta: { align: "right", className: "w-[80px] tabular-nums" },
      cell: ({ row }) => Number(row.original.cantidad),
    },
    {
      id: "precio",
      header: `Precio unitario${sufijo}`,
      meta: { align: "right", className: "w-[160px] tabular-nums" },
      cell: ({ row }) =>
        moneda
          ? formatNumber(Number(row.original.precio_unitario), { decimals: 2 })
          : formatCurrency(Number(row.original.precio_unitario), row.original.moneda),
    },
    {
      id: "importe",
      header: `Importe${sufijo}`,
      meta: { align: "right", className: "w-[160px] tabular-nums font-medium" },
      cell: ({ row }) =>
        moneda
          ? formatNumber(importe(row.original), { decimals: 2 })
          : formatCurrency(importe(row.original), row.original.moneda),
    },
    {
      id: "iva",
      header: "IVA",
      meta: { align: "center", className: "w-[80px] text-xs" },
      cell: ({ row }) => (row.original.aplica_iva || row.original.moneda === "MXN" ? "Sí" : "No"),
    },
  ]);
}
