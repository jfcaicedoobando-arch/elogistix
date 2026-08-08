/**
 * Columnas del estado de cuenta bancario (v13.450.0).
 * Formato tipo extracto bancario: salida, entrada y saldo corrido.
 */
import { Badge } from "@/components/ui/badge";
import { BotonVerPago } from "@/features/tesoreria/components/BotonVerPago";
import type { RefPago } from "@/features/tesoreria/domain/pagoDetalle";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import type { MovimientoEstadoCuenta } from "@/features/tesoreria/domain/estadoCuenta";

const ESTADO_COLOR: Record<string, string> = {
  Pendiente: "bg-warning/10 text-warning border-warning/20",
  Conciliado: "bg-success/10 text-success border-success/20",
  Ignorado: "bg-muted text-muted-foreground border-border",
};

export function estadoCuentaColumns(
  moneda: string,
  onVerPago: (ref: RefPago) => void,
): ColumnDef<MovimientoEstadoCuenta, unknown>[] {
  return defineColumns<MovimientoEstadoCuenta>([
    {
      id: "fecha",
      header: "Fecha",
      accessorFn: (m) => m.fecha,
      meta: { width: "w-28" },
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs">{formatDate(row.original.fecha)}</span>
      ),
    },
    {
      id: "concepto",
      header: "Concepto / Referencia",
      accessorFn: (m) => m.concepto ?? "",
      cell: ({ row }) => (
        <div className="max-w-[320px]">
          <span className="block truncate" title={row.original.concepto ?? ""}>
            {row.original.concepto ?? "—"}
          </span>
          {row.original.referencia ? (
            <span className="block truncate text-2xs text-muted-foreground">
              Ref. {row.original.referencia}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "salida",
      header: "Salida",
      accessorFn: (m) => m.cargo,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums text-destructive">
          {row.original.cargo > 0 ? formatCurrency(row.original.cargo, moneda) : ""}
        </span>
      ),
    },
    {
      id: "entrada",
      header: "Entrada",
      accessorFn: (m) => m.abono,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums text-success">
          {row.original.abono > 0 ? formatCurrency(row.original.abono, moneda) : ""}
        </span>
      ),
    },
    {
      id: "saldo",
      header: "Saldo",
      accessorFn: (m) => m.saldo_corrido,
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">
          {formatCurrency(row.original.saldo_corrido, moneda)}
        </span>
      ),
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (m) => m.estado_conciliacion,
      meta: { width: "w-24" },
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={`text-2xs ${ESTADO_COLOR[row.original.estado_conciliacion] ?? ""}`}
        >
          {row.original.estado_conciliacion}
        </Badge>
      ),
    },
    {
      id: "acciones",
      header: "Pago",
      enableSorting: false,
      meta: { width: "w-[104px]", align: "right" },
      cell: ({ row }) => <BotonVerPago movimiento={row.original} onVerPago={onVerPago} />,
    },
  ]) as ColumnDef<MovimientoEstadoCuenta, unknown>[];
}
