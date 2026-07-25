/**
 * Columnas de la tabla /compras/por-pagar.
 * v13.200.0: sin <Link> inline. Navegación por row-click desde el consumer.
 */
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { moneyColumn } from "@/components/shared/dataTable/columnBuilders";
import { formatDate } from "@/lib/formatters";
import { ToneBadge } from "@/components/shared/ToneBadge";
import type { ChipTone } from "@/lib/ui/badgeTone";
import type { useCxpPorPagar } from "@/features/bandejas/hooks/useBandejas";
import { Checkbox } from "@/components/ui/checkbox";

export type CxpRow = NonNullable<ReturnType<typeof useCxpPorPagar>["data"]>[number];

function toneDiasParaVencer(dias: number): ChipTone {
  if (dias < 0) return "destructive";
  if (dias <= 7) return "warning";
  return "neutral";
}


export function buildCxpPorPagarColumns(): ColumnDef<CxpRow, unknown>[] {
  return defineColumns<CxpRow>([
    {
      id: "selection",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Seleccionar todos"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Seleccionar fila"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { width: "w-[40px]" },
    },
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
      meta: { width: "w-[150px]", className: "text-xs whitespace-nowrap" },
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-1.5">
          {row.original.fecha_vencimiento ? formatDate(row.original.fecha_vencimiento) : "—"}
          {row.original.fecha_programada_pago && (
            <ToneBadge tone="info" size="sm">Prog.</ToneBadge>
          )}
        </span>
      ),
    },
    {
      id: "dias",
      header: "Días",
      accessorFn: (r) => r.dias_para_vencer ?? 0,
      enableSorting: true,
      meta: { width: "w-[100px]", align: "center" },
      cell: ({ row }) => {
        const dias = row.original.dias_para_vencer ?? 0;
        return (
          <ToneBadge tone={toneDiasParaVencer(dias)} size="md">
            {dias < 0 ? `${Math.abs(dias)} venc.` : `${dias}d`}
          </ToneBadge>
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
