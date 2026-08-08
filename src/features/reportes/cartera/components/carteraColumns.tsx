/**
 * Columnas del reporte de Cartera y Antigüedad (CxC / CxP).
 * Muestra saldo en su moneda y la doble valuación en pesos.
 */
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { cn } from "@/lib/utils";
import {
  BUCKET_AGING_LABELS,
  type FilaCartera,
} from "@/features/reportes/cartera/domain/agingCartera";

const CLASE_BUCKET: Record<FilaCartera["bucket"], string> = {
  por_vencer: "bg-muted text-muted-foreground border-border",
  d1_30: "bg-warning/10 text-warning border-warning/20",
  d31_60: "bg-warning/10 text-warning border-warning/20",
  d61_90: "bg-destructive/10 text-destructive border-destructive/20",
  mas_90: "bg-destructive/10 text-destructive border-destructive/20",
};

export function carteraColumns(etiquetaContraparte: string): ColumnDef<FilaCartera, unknown>[] {
  return defineColumns<FilaCartera>([
    {
      id: "contraparte",
      header: etiquetaContraparte,
      accessorFn: (f) => f.contraparte,
      cell: ({ row }) => <span className="text-xs font-medium">{row.original.contraparte}</span>,
    },
    {
      id: "folio",
      header: "Folio",
      accessorFn: (f) => f.folio,
      meta: { width: "w-28" },
      cell: ({ row }) => <span className="text-xs tabular-nums">{row.original.folio}</span>,
    },
    {
      id: "expediente",
      header: "Expediente",
      accessorFn: (f) => f.expediente,
      meta: { width: "w-28" },
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.expediente || "—"}</span>
      ),
    },
    {
      id: "vencimiento",
      header: "Vence",
      accessorFn: (f) => f.fechaVencimiento ?? "",
      meta: { width: "w-24" },
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs">
          {row.original.fechaVencimiento ? formatDate(row.original.fechaVencimiento) : "—"}
        </span>
      ),
    },
    {
      id: "bucket",
      header: "Antigüedad",
      accessorFn: (f) => f.diasVencido,
      meta: { width: "w-32" },
      cell: ({ row }) => (
        <Badge variant="outline" className={CLASE_BUCKET[row.original.bucket]}>
          {BUCKET_AGING_LABELS[row.original.bucket]}
        </Badge>
      ),
    },
    {
      id: "saldo",
      header: "Saldo",
      accessorFn: (f) => f.saldo,
      meta: { width: "w-32", align: "right" },
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">
          {formatCurrency(row.original.saldo, row.original.moneda)}
        </span>
      ),
    },
    {
      id: "mxnHistorico",
      header: "MXN histórico",
      accessorFn: (f) => f.mxnHistorico,
      meta: { width: "w-36", align: "right" },
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">
          {formatCurrency(row.original.mxnHistorico, "MXN")}
        </span>
      ),
    },
    {
      id: "mxnCorte",
      header: "MXN al corte",
      accessorFn: (f) => f.mxnCorte,
      meta: { width: "w-36", align: "right" },
      cell: ({ row }) => (
        <span className="text-xs font-medium tabular-nums">
          {formatCurrency(row.original.mxnCorte, "MXN")}
        </span>
      ),
    },
    {
      id: "diferencia",
      header: "Dif. cambiaria",
      accessorFn: (f) => f.diferencia,
      meta: { width: "w-32", align: "right" },
      cell: ({ row }) => (
        <span
          className={cn(
            "text-xs tabular-nums",
            row.original.diferencia > 0 && "text-success",
            row.original.diferencia < 0 && "text-destructive",
          )}
        >
          {formatCurrency(row.original.diferencia, "MXN")}
        </span>
      ),
    },
  ]);
}
