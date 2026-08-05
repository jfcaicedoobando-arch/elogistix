import { Badge } from "@/components/ui/badge";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import {
  moneyColumn,
  dateColumn,
} from "@/components/shared/dataTable/columnBuilders";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { toTitleCase } from "@/lib/formatters";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import type { FacturaCxP } from "@/features/cxp/services";
import { EstadoFacturaCxPCell } from "./EstadoFacturaCxPCell";

/**
 * Columnas de la tabla `/compras/facturas`.
 *
 * v13.307.16 — Consolidamos "Estatus + Aprobación + Días + Prog. pago" en
 * una sola columna "Estado" mediante `<EstadoFacturaCxPCell />`.  La celda
 * pinta un chip primario (estatus del ciclo de vida) y hasta 5 chips
 * secundarios (Parcial · +N d · NC · SAT ✓ · Prog. DD/MM) con tooltip.
 */
export function buildCxPColumns(): ColumnDef<FacturaCxP, unknown>[] {
  return defineColumns<FacturaCxP>([
    {
      id: "folio_interno", header: "Folio",
      accessorFn: (f) => f.folio_interno, enableSorting: true,
      sortingFn: sortByString<FacturaCxP>((f) => f.folio_interno),
      meta: { width: COL_W.folio, className: "font-mono text-xs font-semibold whitespace-nowrap", sticky: true },
      cell: ({ row }) => row.original.folio_interno,
    },
    {
      id: "folio", header: "Folio prov.",
      accessorFn: (f) => f.folio_proveedor, enableSorting: true,
      sortingFn: sortByString<FacturaCxP>((f) => f.folio_proveedor),
      meta: { width: COL_W.folio, className: "whitespace-nowrap text-xs text-muted-foreground hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => row.original.folio_proveedor,
    },
    {
      id: "proveedor", header: "Proveedor",
      meta: { width: COL_W.texto, className: "max-w-[220px]" },
      cell: ({ row }) => {
        const origen = row.original.proveedor_origen;
        const badgeCls = origen === "Nacional"
          ? "bg-primary/10 text-primary border-primary/20"
          : origen === "Extranjero"
            ? "bg-warning/10 text-warning border-warning/20"
            : "";
        return (
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="truncate" title={toTitleCase(row.original.proveedor_nombre)}>
              {toTitleCase(row.original.proveedor_nombre)}
            </span>
            {origen && (
              <Badge variant="outline" className={`${badgeCls} text-2xs px-1.5 py-0 h-4 w-fit font-normal`}>
                {origen}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      ...dateColumn<FacturaCxP>({
        id: "emision", header: "Emisión",
        accessor: (f) => f.fecha_emision,
      }),
      meta: { width: COL_W.fecha, className: "text-xs whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    },
    {
      ...dateColumn<FacturaCxP>({
        id: "vencimiento", header: "Vencimiento",
        accessor: (f) => f.fecha_vencimiento,
      }),
      meta: { width: COL_W.fecha, className: "text-xs whitespace-nowrap" },
    },
    {
      id: "moneda", header: "Mon.",
      meta: { width: COL_W.tiny, className: "text-xs hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => row.original.moneda,
    },
    {
      ...moneyColumn<FacturaCxP>({
        id: "total", header: "Total",
        accessor: (f) => f.total,
        currencyAccessor: (f) => f.moneda,
      }),
      meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    },
    {
      ...moneyColumn<FacturaCxP>({
        id: "pagado", header: "Pagado",
        accessor: (f) => f.pagado,
        currencyAccessor: (f) => f.moneda,
      }),
      meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap text-success hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    },
    {
      ...moneyColumn<FacturaCxP>({
        id: "saldo", header: "Saldo",
        accessor: (f) => f.saldo,
        currencyAccessor: (f) => f.moneda,
      }),
      meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap font-semibold" },
    },
    {
      id: "estado", header: "Estado",
      accessorFn: (f) => f.estatus, enableSorting: true,
      sortingFn: sortByString<FacturaCxP>((f) => f.estatus),
      meta: { width: COL_W.estado },
      cell: ({ row }) => <EstadoFacturaCxPCell factura={row.original} />,
    },
  ]);
}

