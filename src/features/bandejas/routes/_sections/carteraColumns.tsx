/**
 * Columnas de la tabla Cartera (`/facturacion/cartera`). Extraídas para
 * respetar el límite de líneas de la ruta.
 */
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { dateColumn, moneyColumn } from "@/components/shared/dataTable/columnBuilders";
import { formatDate } from "@/lib/formatters";
import type { useCarteraPendiente } from "@/features/bandejas/hooks/useBandejas";

export type CarteraRow = NonNullable<ReturnType<typeof useCarteraPendiente>["data"]>[number];

export function buildCarteraColumns(): ColumnDef<CarteraRow, unknown>[] {
  return defineColumns<CarteraRow>([
    {
      id: "numero",
      header: "Folio",
      accessorFn: (r) => r.numero ?? "",
      enableSorting: true,
      meta: { width: "w-[130px]", className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row }) => (
        <Link
          to={`/facturacion/${row.original.factura_id}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.numero ?? "—"}
        </Link>
      ),
    },
    {
      id: "cliente",
      header: "Cliente",
      accessorFn: (r) => r.cliente_nombre ?? "",
      enableSorting: true,
      meta: { width: "min-w-[180px]", className: "max-w-[240px] truncate" },
      cell: ({ row }) => (
        <span title={row.original.cliente_nombre ?? undefined}>
          {row.original.cliente_nombre ?? "—"}
        </span>
      ),
    },
    {
      id: "embarque",
      header: "Embarque",
      enableSorting: false,
      meta: { width: "w-[130px]", className: "font-mono text-xs hidden md:table-cell", headerClassName: "hidden md:table-cell" },
      cell: ({ row }) =>
        row.original.embarque_id ? (
          <Link
            to={`/embarques/${row.original.embarque_id}`}
            className="text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.expediente ?? "—"}
          </Link>
        ) : (
          "—"
        ),
    },
    {
      ...dateColumn<CarteraRow>({
        id: "vencimiento",
        header: "Vencimiento",
        accessor: (r) => r.fecha_vencimiento,
      }),
      meta: { width: "w-[110px]", className: "text-xs whitespace-nowrap" },
    },
    {
      id: "dias",
      header: "Días vencido",
      accessorFn: (r) => r.dias_vencido,
      enableSorting: true,
      meta: { width: "w-[110px]", align: "center", className: "whitespace-nowrap" },
      cell: ({ row }) => (
        <Badge variant={row.original.dias_vencido > 0 ? "destructive" : "secondary"}>
          {row.original.dias_vencido}d
        </Badge>
      ),
    },
    {
      ...moneyColumn<CarteraRow>({
        id: "total",
        header: "Total",
        accessor: (r) => Number(r.total),
        currencyAccessor: (r) => r.moneda,
      }),
      meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    },
    {
      ...moneyColumn<CarteraRow>({
        id: "saldo",
        header: "Saldo",
        accessor: (r) => Number(r.saldo),
        currencyAccessor: (r) => r.moneda,
      }),
      meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap font-semibold" },
    },
    {
      id: "ultimo",
      header: "Último contacto",
      enableSorting: false,
      meta: { width: "w-[130px]", className: "text-xs hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) =>
        row.original.ultimo_contacto ? (
          formatDate(row.original.ultimo_contacto)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ]);
}
