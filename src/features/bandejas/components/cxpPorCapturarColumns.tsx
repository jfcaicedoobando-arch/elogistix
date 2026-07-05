/**
 * Definición de columnas para la bandeja CxP — Por capturar.
 * Reutiliza el patrón estándar de DataTable (ColumnDef + meta).
 */
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CxpPorCapturarRow as RowData } from "@/features/bandejas/services/bandejas";
import { estatusDeFila } from "@/features/bandejas/hooks/useCxpPorCapturarFilters";

// Mapea el estatus interno ("sin"/"parcial"/"completo") al string canónico
// del dominio `captura_cxp` del statusRegistry.
const CAPTURA_STATUS: Record<"sin" | "parcial" | "completo", string> = {
  sin: "Sin captura",
  parcial: "Parcial",
  completo: "Completo",
};

function AvanceBadge({ row }: { row: RowData }) {
  const estatus = estatusDeFila(row);
  return <StatusBadge domain="captura_cxp" status={CAPTURA_STATUS[estatus]} />;
}

interface BuildOpts {
  onCapturar: (row: RowData) => void;
}

export function buildCxpPorCapturarColumns(opts: BuildOpts): ColumnDef<RowData, unknown>[] {
  const { onCapturar } = opts;
  return defineColumns<RowData>([
    {
      id: "expediente",
      header: "Expediente",
      accessorFn: (r) => r.expediente ?? "",
      enableSorting: true,
      meta: { width: "w-[130px]", className: "font-mono text-sm whitespace-nowrap" },
      cell: ({ row }) => (
        <Link
          to={`/embarques/${row.original.embarque_id}`}
          className="text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {row.original.expediente ?? "—"}
        </Link>
      ),
    },
    {
      id: "cliente",
      header: "Cliente",
      accessorFn: (r) => r.cliente_nombre ?? "",
      meta: { width: "min-w-[180px]", className: "max-w-[240px] truncate" },
      cell: ({ row }) => (
        <span title={row.original.cliente_nombre ?? ""}>{row.original.cliente_nombre ?? "—"}</span>
      ),
    },
    {
      id: "avance",
      header: "Avance",
      meta: { width: "w-[200px]" },
      cell: ({ row }) => {
        const presup = Number(row.original.costos_presupuestados) || 0;
        const fact = Number(row.original.monto_facturado) || 0;
        const pct = presup > 0 ? Math.min(100, Math.round((fact / presup) * 100)) : 0;
        return (
          <div>
            <div className="flex items-center gap-2">
              <Progress value={pct} className="h-2 flex-1" />
              <span className="text-xs tabular-nums text-muted-foreground w-9 text-right">{pct}%</span>
            </div>
            <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
              {formatCurrency(fact, "MXN")} / {formatCurrency(presup, "MXN")}
            </div>
          </div>
        );
      },
    },
    {
      id: "estatus",
      header: "Estatus",
      meta: { width: "w-[110px]", align: "center" },
      cell: ({ row }) => <AvanceBadge row={row.original} />,
    },
    {
      id: "facturas",
      header: "Facturas",
      accessorFn: (r) => r.facturas_capturadas,
      enableSorting: true,
      meta: { width: "w-[90px]", align: "center", className: "tabular-nums" },
      cell: ({ row }) => {
        const n = row.original.facturas_capturadas;
        if (n === 0) return <span className="text-muted-foreground">0</span>;
        return (
          <Link
            to={`/embarques/${row.original.embarque_id}`}
            className="text-primary hover:underline tabular-nums"
            onClick={(e) => e.stopPropagation()}
            title="Ver facturas del embarque"
          >
            {n}
          </Link>
        );
      },
    },
    {
      id: "ultima",
      header: "Última factura",
      accessorFn: (r) => r.ultima_factura_fecha ?? "",
      enableSorting: true,
      meta: { width: "w-[150px]", className: "text-sm" },
      cell: ({ row }) => {
        const r = row.original;
        if (!r.ultima_factura_fecha) return <span className="text-muted-foreground">—</span>;
        const dias = r.dias_desde_ultima_factura ?? 0;
        const chipClass = dias > 30 ? "text-destructive" : dias > 7 ? "text-warning" : "text-muted-foreground";
        return (
          <div className="flex flex-col">
            <span>{formatDate(r.ultima_factura_fecha)}</span>
            <span className={cn("text-xs tabular-nums", chipClass)}>hace {dias} d</span>
          </div>
        );
      },
    },
    {
      id: "acciones",
      header: "Acción",
      meta: { width: "w-[180px]", align: "right" },
      cell: ({ row }) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" onClick={() => onCapturar(row.original)}>
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Capturar factura
          </Button>
        </div>
      ),
    },
  ]);
}
