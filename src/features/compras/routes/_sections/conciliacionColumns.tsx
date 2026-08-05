/**
 * Columnas + labels de estado para `ComprasConciliacion` — extraídos en
 * v13.182.0 (Wave 2 splits).
 */
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { defineColumns } from "@/components/shared/DataTable";
import { formatCurrency } from "@/lib/formatters";
import type {
import { COL_W } from "@/components/shared/dataTable/columnWidths";
  EmbarqueConciliacion,
  EstadoConciliacion,
} from "@/features/compras/services/conciliacionEmbarques";

export const CONCILIACION_ESTADO_LABELS: Record<EstadoConciliacion, {
  label: string;
  variant: "outline" | "default" | "secondary" | "destructive";
  icon: typeof Clock;
}> = {
  sin_facturar: { label: "Sin facturar", variant: "destructive", icon: AlertTriangle },
  parcial: { label: "Parcial", variant: "secondary", icon: Clock },
  completa: { label: "Conciliada", variant: "default", icon: CheckCircle2 },
};

export function buildConciliacionColumns() {
  return defineColumns<EmbarqueConciliacion>([
    {
      id: "expediente",
      header: "Expediente",
      accessorFn: (r) => r.expediente,
      cell: ({ row }) => (
        <span className="font-mono text-xs font-medium">{row.original.expediente}</span>
      ),
    },
    { id: "cliente", header: "Cliente", accessorFn: (r) => r.cliente_nombre ?? "—" },
    {
      id: "estado_embarque",
      header: "Estado",
      accessorFn: (r) => r.estado ?? "—",
      cell: ({ row }) =>
        row.original.estado ? (
          <Badge variant="outline" className="text-xs">{row.original.estado}</Badge>
        ) : "—",
    },
    {
      id: "presupuestado",
      header: "Presupuestado",
      accessorFn: (r) => r.presupuestado,
      cell: ({ row }) => formatCurrency(row.original.presupuestado, row.original.moneda),
    },
    {
      id: "pagado",
      header: "Facturado",
      accessorFn: (r) => r.pagado,
      cell: ({ row }) => formatCurrency(row.original.pagado, row.original.moneda),
    },
    {
      id: "pendiente",
      header: "Pendiente",
      accessorFn: (r) => r.pendiente,
      cell: ({ row }) => (
        <span className={row.original.pendiente > 0 ? "font-medium text-destructive" : ""}>
          {formatCurrency(row.original.pendiente, row.original.moneda)}
        </span>
      ),
    },
    {
      id: "cobertura",
      header: "Cobertura",
      accessorFn: (r) => r.cobertura,
      cell: ({ row }) => (
        <div className="flex items-center gap-2 min-w-[120px]">
          <Progress value={Math.round(row.original.cobertura * 100)} className="h-1.5" />
          <span className="text-xs tabular-nums w-8 text-right">
            {Math.round(row.original.cobertura * 100)}%
          </span>
        </div>
      ),
    },
    {
      id: "conceptos_pendientes",
      header: "Pend.",
      accessorFn: (r) => r.conceptos_pendientes,
      cell: ({ row }) =>
        row.original.conceptos_pendientes > 0 ? (
          <Badge variant="outline" className="text-xs">
            {row.original.conceptos_pendientes}/{row.original.conceptos_total}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">0</span>
        ),
    },
    {
      id: "estado_conciliacion",
      header: "Conciliación",
      accessorFn: (r) => r.estado_conciliacion,
      meta: { width: COL_W.monto },
      cell: ({ row }) => {
        const meta = CONCILIACION_ESTADO_LABELS[row.original.estado_conciliacion];
        const Icon = meta.icon;
        return (
          <Badge variant={meta.variant} className="gap-1 text-xs whitespace-nowrap" title={meta.label}>
            <Icon className="h-3 w-3 shrink-0" /> {meta.label}
          </Badge>
        );
      },
    },
  ]);
}
