/**
 * Columnas del historial de operaciones del proveedor, ya conciliado contra
 * sus facturas (Ola 1). Vive aparte de la tabla para respetar el límite de
 * 200 líneas por componente.
 */
import type { ColumnDef } from "@/components/shared/DataTable";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { moneyColumn, dateColumn, statusColumn } from "@/components/shared/dataTable/columnBuilders";
import { toTitleCase } from "@/lib/formatters";
import type { PartidaEstadoCuenta } from "@/features/proveedor/domain/estadoCuentaProveedor";
import { ProveedorFacturasCell } from "./ProveedorFacturasCell";

export function partidasOperacionesColumns<T extends PartidaEstadoCuenta>(): ColumnDef<T, unknown>[] {
  return [
    {
      id: "expediente",
      header: "Expediente",
      accessorFn: (o) => o.expediente,
      enableSorting: true,
      meta: { width: COL_W.short, className: "font-medium" },
      cell: ({ row }) => <span>{row.original.expediente || "—"}</span>,
    },
    {
      id: "cliente",
      header: "Cliente",
      accessorFn: (o) => o.cliente_nombre,
      enableSorting: true,
      meta: { width: COL_W.texto, className: "hidden lg:table-cell", headerClassName: "hidden lg:table-cell" },
      cell: ({ row }) => (
        <span className="block whitespace-normal break-words leading-snug">
          {toTitleCase(row.original.cliente_nombre ?? "") || "—"}
        </span>
      ),
    },
    {
      id: "concepto",
      header: "Concepto",
      accessorFn: (o) => o.concepto,
      enableSorting: true,
      meta: { width: COL_W.texto },
      cell: ({ row }) => (
        <span className="block whitespace-normal break-words leading-snug">
          {row.original.concepto || "—"}
        </span>
      ),
    },
    moneyColumn<T>({
      id: "comprometido",
      header: "Costeado",
      headerTooltip: "Monto comprometido en el expediente (presupuesto)",
      accessor: (o) => o.comprometido,
      currencyAccessor: (o) => o.moneda,
    }),
    moneyColumn<T>({
      id: "facturado",
      header: "Facturado",
      headerTooltip:
        "Monto ya respaldado con factura del proveedor, en la moneda del costo " +
        "(convertido con el tipo de cambio de la factura o el DOF cuando la " +
        "factura viene en otra divisa)",
      accessor: (o) => o.facturado,
      currencyAccessor: (o) => o.moneda,
    }),
    moneyColumn<T>({
      id: "por_facturar",
      header: "Por facturar",
      headerTooltip: "Diferencia entre lo costeado y lo facturado por el proveedor",
      accessor: (o) => o.por_facturar,
      currencyAccessor: (o) => o.moneda,
    }),
    {
      id: "facturas",
      header: "Factura",
      enableSorting: false,
      meta: { width: COL_W.short },
      cell: ({ row }) => <ProveedorFacturasCell partida={row.original} />,
    },
    {
      ...statusColumn<T>({
        id: "conciliacion",
        header: "Estado",
        domain: "conciliacion_costo",
        accessor: (o) => o.estado_conciliacion,
      }),
      meta: { width: COL_W.estado },
    },
    dateColumn<T>({
      id: "vencimiento",
      header: "Vence",
      accessor: (o) => o.fecha_vencimiento,
    }),
  ];
}
