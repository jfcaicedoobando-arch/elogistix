/**
 * Definición de columnas para la bandeja CxP — Por capturar.
 * v13.200.0: sin `<Link>` inline. Row-click navega al embarque desde el consumer.
 */
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CxpPorCapturarRow as RowData } from "@/features/bandejas/services/bandejas";
import { estatusDeFila } from "@/features/bandejas/hooks/useCxpPorCapturarFilters";

const CAPTURA_STATUS: Record<"sin" | "parcial" | "completo", string> = {
  sin: "Sin captura",
  parcial: "Parcial",
  completo: "Completo",
};

function AvanceBadge({ row }: { row: RowData }) {
  const estatus = estatusDeFila(row) as "sin" | "parcial" | "completo";
  return <StatusBadge domain="captura_cxp" status={CAPTURA_STATUS[estatus]} />;
}

interface BuildOpts {
  /** Si es `undefined`, el usuario no tiene permiso de captura: se oculta la columna/botón. */
  onCapturar?: (row: RowData) => void;
  hideEstatus?: boolean;
}

export function buildCxpPorCapturarColumns(opts: BuildOpts): ColumnDef<RowData, unknown>[] {
  const { onCapturar, hideEstatus = false } = opts;
  const all: (ColumnDef<RowData, unknown> | null)[] = [
    {
      id: "expediente",
      header: "Expediente",
      accessorFn: (r) => r.expediente ?? "",
      enableSorting: true,
      meta: { width: "w-[130px]", className: "font-mono text-sm whitespace-nowrap" },
      cell: ({ row }) => row.original.expediente ?? "—",
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
      meta: { width: "w-[220px]" },
      cell: ({ row }) => {
        const presupMxn = Number(row.original.presupuestado_mxn) || 0;
        const presupUsd = Number(row.original.presupuestado_usd) || 0;
        const factMxn = Number(row.original.facturado_mxn) || 0;
        const factUsd = Number(row.original.facturado_usd) || 0;
        // Barra: porcentaje de la moneda con mayor presupuesto (no se pueden mezclar).
        const dominante = presupUsd > presupMxn
          ? { presup: presupUsd, fact: factUsd }
          : { presup: presupMxn, fact: factMxn };
        const pct = dominante.presup > 0
          ? Math.min(100, Math.round((dominante.fact / dominante.presup) * 100))
          : 0;
        return (
          <div>
            <div className="flex items-center gap-2">
              <Progress value={pct} className="h-2 flex-1" />
              <span className="text-xs tabular-nums text-muted-foreground w-9 text-right">{pct}%</span>
            </div>
            <div className="text-label text-muted-foreground tabular-nums mt-0.5 space-y-0.5">
              {presupMxn > 0 && (
                <div>{formatCurrency(factMxn, "MXN")} / {formatCurrency(presupMxn, "MXN")}</div>
              )}
              {presupUsd > 0 && (
                <div>{formatCurrency(factUsd, "USD")} / {formatCurrency(presupUsd, "USD")}</div>
              )}
              {presupMxn <= 0 && presupUsd <= 0 && <div>—</div>}
            </div>
          </div>
        );
      },
    },
    hideEstatus ? null : {
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
        return <span className="tabular-nums">{n}</span>;
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
    onCapturar ? {
      id: "acciones",
      header: "",
      meta: { width: "w-[56px]", align: "center" },
      cell: ({ row }) => (
        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => onCapturar(row.original)}
                aria-label={`Capturar factura del embarque ${row.original.expediente ?? row.original.embarque_id}`}
              >
                <FilePlus2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Capturar factura</TooltipContent>
          </Tooltip>
        </div>
      ),
    } : null,
  ];
  return defineColumns<RowData>(all.filter((c): c is ColumnDef<RowData, unknown> => c !== null));
}
