import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByNumber } from "@/components/shared/dataTable/sortingFns";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { formatNumber } from "@/lib/formatters";
import type { ProformaConFactura } from "@/features/embarques/hooks";
import { totalesListadoProforma } from "@/features/proformas/domain/proformaListado";
import { Hint } from "@/components/shared/Hint";

/** Cada moneda se ordena en su propia columna, sin sumar nominales. */
export function buildProformaImportesColumns(): ColumnDef<ProformaConFactura, unknown>[] {
  return defineColumns<ProformaConFactura>((["MXN", "USD"] as const).map((moneda) => {
    const campo = moneda === "MXN" ? "total_mxn" : "total_usd";
    const importe = (p: ProformaConFactura) => totalesListadoProforma(p)[campo];
    return {
      id: campo,
      header: `Total ${moneda}`,
      accessorFn: importe,
      enableSorting: true,
      sortingFn: sortByNumber<ProformaConFactura>(importe),
      meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap" },
      cell: ({ row }) => row.original.totales_origen === "encabezado_sin_detalle"
        ? <Hint label="Importe guardado. El detalle de conceptos no está disponible."><span>{formatNumber(importe(row.original), { decimals: 2 })}</span></Hint>
        : formatNumber(importe(row.original), { decimals: 2 }),
    };
  }));
}
