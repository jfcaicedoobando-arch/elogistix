/**
 * Ola 2 — Columnas del estado de cuenta cronológico del proveedor.
 * Vive aparte de la tabla para respetar el límite de 200 líneas.
 */
import type { ColumnDef } from "@/components/shared/DataTable";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type {
  MovimientoConSaldo,
  TipoMovimientoProveedor,
} from "@/features/proveedor/domain/movimientosProveedor";

const TONO_TIPO: Record<TipoMovimientoProveedor, string> = {
  Factura: "bg-accent/15 text-accent border-accent/30",
  "Nota de crédito": "bg-warning/15 text-warning border-warning/30",
  Pago: "bg-success/15 text-success border-success/30",
  "Anticipo aplicado": "bg-success/15 text-success border-success/30",
  Anticipo: "bg-muted text-muted-foreground border-border",
};

export function movimientosProveedorColumns<T extends MovimientoConSaldo>(): ColumnDef<T, unknown>[] {
  return [
    {
      id: "fecha",
      header: "Fecha",
      accessorFn: (m) => m.fecha,
      enableSorting: true,
      meta: { width: COL_W.fecha },
      cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.fecha)}</span>,
    },
    {
      id: "tipo",
      header: "Movimiento",
      accessorFn: (m) => m.tipo,
      enableSorting: true,
      meta: { width: COL_W.short },
      cell: ({ row }) => (
        <Badge variant="outline" className={TONO_TIPO[row.original.tipo]}>
          {row.original.tipo}
        </Badge>
      ),
    },
    {
      id: "folio",
      header: "Folio",
      accessorFn: (m) => m.folio,
      enableSorting: true,
      meta: { width: COL_W.short, className: "font-medium" },
      cell: ({ row }) => <span>{row.original.folio}</span>,
    },
    {
      id: "expediente",
      header: "Expediente",
      accessorFn: (m) => m.expediente,
      enableSorting: true,
      meta: {
        width: COL_W.short,
        className: "hidden md:table-cell",
        headerClassName: "hidden md:table-cell",
      },
      cell: ({ row }) => <span>{row.original.expediente || "—"}</span>,
    },
    {
      id: "referencia",
      header: "Referencia",
      accessorFn: (m) => m.referencia ?? "",
      meta: {
        width: COL_W.texto,
        className: "hidden xl:table-cell text-muted-foreground",
        headerClassName: "hidden xl:table-cell",
      },
      cell: ({ row }) => <span className="text-xs">{row.original.referencia || "—"}</span>,
    },
    {
      id: "cargo",
      header: "Cargo",
      accessorFn: (m) => m.cargo,
      enableSorting: true,
      meta: { width: COL_W.monto, align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.cargo > 0 ? formatCurrency(row.original.cargo, row.original.moneda) : "—"}
        </span>
      ),
    },
    {
      id: "abono",
      header: "Abono",
      accessorFn: (m) => m.abono,
      enableSorting: true,
      meta: { width: COL_W.monto, align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums text-success">
          {row.original.abono > 0 ? formatCurrency(row.original.abono, row.original.moneda) : "—"}
        </span>
      ),
    },
    {
      id: "saldo",
      header: "Saldo",
      accessorFn: (m) => m.saldo,
      meta: { width: COL_W.monto, align: "right", className: "font-medium" },
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatCurrency(row.original.saldo, row.original.moneda)}
        </span>
      ),
    },
  ];
}
