/**
 * Columnas de la tabla /compras/por-pagar.
 * v13.200.0: sin `<Link>` inline. Navegación por row-click desde el consumer.
 */
import { Badge } from "@/components/ui/badge";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { moneyColumn } from "@/components/shared/dataTable/columnBuilders";
import { formatDate } from "@/lib/formatters";
import { variantDiasParaVencer } from "@/features/bandejas/domain/aggregates";
import type { useCxpPorPagar } from "@/features/bandejas/hooks/useBandejas";

export type CxpRow = NonNullable<ReturnType<typeof useCxpPorPagar>["data"]>[number];

export function buildCxpPorPagarColumns(): ColumnDef<CxpRow, unknown>[] {
  return defineColumns<CxpRow>([
    {
      id: "proveedor",
      header: "Proveedor",
      accessorFn: (r) => r.proveedor_nombre ?? "",
      enableSorting: true,
      meta: { width: "min-w-[180px]", className: "font-medium max-w-[240px] truncate", sticky: true },
      cell: ({ row }) => row.original.proveedor_nombre ?? "—",
    },
    {
      id: "folio",
      header: "Folio",
      accessorFn: (r) => r.folio_proveedor ?? "",
      enableSorting: true,
      meta: { width: "w-[130px]", className: "font-mono text-xs whitespace-nowrap" },
      cell: ({ row }) => row.original.folio_proveedor ?? "—",
    },
    {
      id: "embarque",
      header: "Embarque",
      enableSorting: false,
      meta: { width: "w-[130px]", className: "font-mono text-xs hidden md:table-cell", headerClassName: "hidden md:table-cell" },
      cell: ({ row }) => row.original.expediente ?? "—",
    },
    {
      id: "vencimiento",
      header: "Vencimiento",
      accessorFn: (r) => r.fecha_vencimiento ?? "",
      enableSorting: true,
      meta: { width: "w-[110px]", className: "text-xs whitespace-nowrap" },
      cell: ({ row }) =>
        row.original.fecha_vencimiento ? formatDate(row.original.fecha_vencimiento) : "—",
    },
    {
      id: "dias",
      header: "Días",
      accessorFn: (r) => r.dias_para_vencer ?? 0,
      enableSorting: true,
      meta: { width: "w-[100px]", align: "center" },
      cell: ({ row }) => {
        const dias = row.original.dias_para_vencer ?? 0;
        const variant = variantDiasParaVencer(dias);
        return (
          <Badge variant={variant} className="whitespace-nowrap">
            {dias < 0 ? `${Math.abs(dias)} venc.` : `${dias}d`}
          </Badge>
        );
      },
    },
    {
      ...moneyColumn<CxpRow>({
        id: "total",
        header: "Total",
        accessor: (r) => Number(r.total),
        currencyAccessor: (r) => r.moneda,
      }),
      meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    },
    {
      ...moneyColumn<CxpRow>({
        id: "pagado",
        header: "Pagado",
        accessor: (r) => Number(r.pagado),
        currencyAccessor: (r) => r.moneda,
      }),
      meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap text-success hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    },
    {
      ...moneyColumn<CxpRow>({
        id: "saldo",
        header: "Saldo",
        accessor: (r) => Number(r.saldo),
        currencyAccessor: (r) => r.moneda,
      }),
      meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap font-semibold" },
    },
  ]);
}
