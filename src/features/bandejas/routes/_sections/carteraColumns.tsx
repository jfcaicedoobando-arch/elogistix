/**
 * Columnas de la tabla Cartera (`/facturacion/cartera`).
 * v13.200.0: sin `<Link>` inline. La navegación al detalle de factura
 * se hace por row-click accesible desde `Cartera.tsx` (getRowHref).
 * v13.313.1: agregada columna de acción "Recordatorio".
 */
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail } from "lucide-react";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { dateColumn, moneyColumn } from "@/components/shared/dataTable/columnBuilders";
import { formatDate } from "@/lib/formatters";
import type { useCarteraPendiente } from "@/features/bandejas/hooks/useBandejas";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

export type CarteraRow = NonNullable<ReturnType<typeof useCarteraPendiente>["data"]>[number];

/** Evita el doble toggle cuando el clic ya cayó sobre el propio checkbox. */
function esClickEnCheckbox(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[role="checkbox"]');
}



export function buildCarteraColumns(onRecordatorio?: (row: CarteraRow) => void): ColumnDef<CarteraRow, unknown>[] {
  return defineColumns<CarteraRow>([
    {
      id: "selection",
      header: ({ table }) => (
        <div
          className="flex h-9 w-full cursor-pointer items-center justify-center"
          data-no-row-nav
          onClick={(e) => {
            e.stopPropagation();
            if (esClickEnCheckbox(e.target)) return;
            table.toggleAllPageRowsSelected(!table.getIsAllPageRowsSelected());
          }}
          role="presentation"
        >
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Seleccionar todas"
          />
        </div>
      ),
      cell: ({ row }) => (
        // v13.490.0 — El área completa de la celda selecciona: un clic apenas
        // fuera del checkbox ya no navega al detalle ni pierde la selección.
        <div
          className="flex h-9 w-full cursor-pointer items-center justify-center"
          data-no-row-nav
          onClick={(e) => {
            e.stopPropagation();
            if (esClickEnCheckbox(e.target)) return;
            row.toggleSelected(!row.getIsSelected());
          }}
          role="presentation"
        >
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Seleccionar factura ${row.original.numero ?? ""}`}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { width: COL_W.micro, className: "p-0" },
    },
    {
      id: "numero",
      header: "Folio",
      accessorFn: (r) => r.numero ?? "",
      enableSorting: true,
      meta: { width: COL_W.monto, className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row, table }) => {
        // Con selección activa el folio abre en pestaña nueva: así el usuario
        // puede revisar una factura sin perder lo que ya marcó.
        const haySeleccion = table.getSelectedRowModel().rows.length > 0;
        return (
          <Link
            to={`/facturacion/${row.original.factura_id}`}
            data-no-row-nav
            target={haySeleccion ? "_blank" : undefined}
            rel={haySeleccion ? "noopener noreferrer" : undefined}
            title={haySeleccion ? "Se abre en pestaña nueva para no perder tu selección" : undefined}
            className="underline-offset-2 hover:underline focus-visible:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.numero ?? "—"}
          </Link>
        );
      },
    },



    {
      id: "cliente",
      header: "Cliente",
      accessorFn: (r) => r.cliente_nombre ?? "",
      enableSorting: true,
      meta: { width: COL_W.ruta, className: "max-w-[240px] truncate" },
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
      meta: { width: COL_W.monto, className: "font-mono text-xs hidden md:table-cell", headerClassName: "hidden md:table-cell" },
      cell: ({ row }) => row.original.expediente ?? "—",
    },
    {
      ...dateColumn<CarteraRow>({
        id: "vencimiento",
        header: "Vencimiento",
        accessor: (r) => r.fecha_vencimiento,
      }),
      meta: { width: COL_W.fecha, className: "text-xs whitespace-nowrap" },
    },
    {
      id: "dias",
      header: "Días vencido",
      accessorFn: (r) => r.dias_vencido,
      enableSorting: true,
      meta: { width: COL_W.monto, align: "center", className: "whitespace-nowrap" },
      cell: ({ row }) => {
        const d = row.original.dias_vencido;
        if (d > 0) return <Badge variant="destructive">Vencida {d}d</Badge>;
        // B-019 (v13.320.42): antes decíamos "Por vencer 0d" cuando vence hoy —
        // era ambiguo (¿ya venció? ¿faltan 0 días?). Ahora "Vence hoy" es literal.
        if (d === 0) return <Badge variant="secondary">Vence hoy</Badge>;
        if (d >= -7) return <Badge variant="secondary">Vence en {Math.abs(d)}d</Badge>;
        return <Badge variant="outline">Vence en {Math.abs(d)}d</Badge>;
      },

    },
    {
      ...moneyColumn<CarteraRow>({
        id: "total",
        header: "Total",
        accessor: (r) => Number(r.total),
        currencyAccessor: (r) => r.moneda,
      }),
      meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    },
    {
      ...moneyColumn<CarteraRow>({
        id: "saldo",
        header: "Saldo",
        accessor: (r) => Number(r.saldo),
        currencyAccessor: (r) => r.moneda,
      }),
      meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap font-semibold" },
    },
    {
      id: "ultimo",
      header: "Último contacto",
      enableSorting: false,
      meta: { width: COL_W.monto, className: "text-xs hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) =>
        row.original.ultimo_contacto ? (
          formatDate(row.original.ultimo_contacto)
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "acciones",
      header: "",
      enableSorting: false,
      meta: { width: COL_W.tiny, align: "right" },
      cell: ({ row }) =>
        onRecordatorio ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Enviar recordatorio de pago para ${row.original.numero ?? ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onRecordatorio(row.original);
            }}
          >
            <Mail className="h-4 w-4" />
          </Button>
        ) : null,
    },
  ]);
}
