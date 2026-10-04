/**
 * Definición de columnas para la bandeja CxP — Por capturar.
 * v13.200.0: sin `<Link>` inline. Row-click navega al embarque desde el consumer.
 */
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CxpPorCapturarRow as RowData } from "@/features/bandejas/services/bandejas";
import { estatusDeFila } from "@/features/bandejas/hooks/useCxpPorCapturarFilters";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { Hint } from "@/components/shared/Hint";
import { CxpAvanceCaptura } from "./CxpAvanceCaptura";
import { referenciaCxpEmbarque } from "../domain/cxpReferenciaEmbarque";

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
      accessorFn: referenciaCxpEmbarque,
      enableSorting: true,
      meta: { width: COL_W.ruta, className: "text-sm" },
      cell: ({ row }) => <div className="space-y-0.5">
        <span className="font-mono whitespace-nowrap">{referenciaCxpEmbarque(row.original)}</span>
        {row.original.estado_embarque === "Borrador" &&
          <p className="text-label text-muted-foreground">Operación no confirmada</p>}
        {row.original.cotizacion_folio &&
          <p className="text-label text-muted-foreground">Cotización {row.original.cotizacion_folio}</p>}
      </div>,
    },
    {
      id: "cliente",
      header: "Cliente",
      accessorFn: (r) => r.cliente_nombre ?? "",
      meta: { width: COL_W.ruta, className: "max-w-[240px] truncate" },
      cell: ({ row }) => (
        <Hint label={row.original.cliente_nombre ?? ""}>
          <span>{row.original.cliente_nombre ?? "—"}</span>
        </Hint>
      ),
    },
    {
      id: "avance",
      header: "Avance",
      meta: { width: COL_W.texto },
      cell: ({ row }) => <CxpAvanceCaptura row={row.original} />,
    },
    hideEstatus ? null : {
      id: "estatus",
      header: "Estatus",
      meta: { width: COL_W.fecha, align: "center" },
      cell: ({ row }) => <AvanceBadge row={row.original} />,
    },
    {
      id: "facturas",
      header: "Facturas",
      accessorFn: (r) => r.facturas_capturadas,
      enableSorting: true,
      meta: { width: COL_W.short, align: "center", className: "tabular-nums" },
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
      meta: { width: COL_W.monto, className: "text-sm" },
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
      meta: { width: COL_W.acciones, align: "center" },
      cell: ({ row }) => (
        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="min-h-11 min-w-11 md:h-8 md:w-8 md:min-h-0 md:min-w-0"
                onClick={() => onCapturar(row.original)}
                aria-label={`Capturar factura del embarque ${referenciaCxpEmbarque(row.original)}`}
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
