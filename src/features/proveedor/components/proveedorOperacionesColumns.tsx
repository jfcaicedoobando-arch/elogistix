/**
 * Columnas del historial de operaciones del proveedor, ya conciliado contra
 * sus facturas (Ola 1). Vive aparte de la tabla para respetar el límite de
 * 200 líneas por componente.
 */
import { Link } from "react-router-dom";
import type { ColumnDef } from "@/components/shared/DataTable";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { moneyColumn, dateColumn } from "@/components/shared/dataTable/columnBuilders";
import { Badge } from "@/components/ui/badge";
import { toTitleCase } from "@/lib/formatters";
import type { PartidaEstadoCuenta } from "@/features/proveedor/domain/estadoCuentaProveedor";
import { toneEstadoConciliacion } from "@/features/proveedor/domain/estadoCuentaProveedor";

function FacturasCell({ partida }: { partida: PartidaEstadoCuenta }) {
  if (partida.facturas.length === 0) {
    return <span className="text-xs text-muted-foreground">Sin factura</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {partida.facturas.map((f) => (
        <Link
          key={f.factura_id}
          to={`/compras/facturas/${f.factura_id}`}
          className="text-xs text-accent underline-offset-2 hover:underline"
          title={f.folio_proveedor ? `Folio proveedor: ${f.folio_proveedor}` : undefined}
        >
          {f.folio_interno ?? f.folio_proveedor ?? "Ver factura"}
        </Link>
      ))}
    </div>
  );
}

export function partidasOperacionesColumns<T extends PartidaEstadoCuenta>(): ColumnDef<T, unknown>[] {
  return [
    {
      id: "expediente",
      header: "Expediente",
      accessorFn: (o) => o.expediente,
      enableSorting: true,
      meta: { width: COL_W.short, className: "font-medium" },
      cell: ({ row }) =>
        row.original.embarque_id ? (
          <Link
            to={`/embarques/${row.original.embarque_id}`}
            className="text-accent underline-offset-2 hover:underline"
          >
            {row.original.expediente || "—"}
          </Link>
        ) : (
          <span>{row.original.expediente || "—"}</span>
        ),
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
      headerTooltip: "Monto ya respaldado con factura del proveedor",
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
      cell: ({ row }) => <FacturasCell partida={row.original} />,
    },
    {
      id: "conciliacion",
      header: "Estado",
      accessorFn: (o) => o.estado_conciliacion,
      enableSorting: true,
      meta: { width: COL_W.estado },
      cell: ({ row }) => (
        <Badge variant="outline" className={toneEstadoConciliacion(row.original.estado_conciliacion)}>
          {row.original.estado_conciliacion}
        </Badge>
      ),
    },
    dateColumn<T>({
      id: "vencimiento",
      header: "Vence",
      accessor: (o) => o.fecha_vencimiento,
    }),
  ];
}
