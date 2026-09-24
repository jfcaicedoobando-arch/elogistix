/**
 * Tabla de reconciliación a 3 columnas: cotizado / refrescado / real (Fase 2).
 * v13.172.18: migrado a `DataTable` (Fase 5 homologación); preserva Switch de "sólo varianza".
 */
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { useReconciliacion3Columnas } from "@/features/embarques/hooks/useReconciliacion3Columnas";
import { useUmbralesReconciliacion } from "@/features/embarques/hooks/useUmbralesReconciliacion";
import type { FilaReconciliacion3C } from "@/lib/domain/versionadoCotizacion";
import { fmt, pctOPendiente, colorPorClasificacion, etiquetaClasificacion } from "./reconciliacionFormat";
import { ResumenReconciliacion } from "./ResumenReconciliacion";
import { downloadCsvWithFeedback } from "@/lib/ui/notifyCsvExport";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { generarCsvReconciliacion3C } from "@/features/embarques/services/reconciliacion3Columnas.helpers";

interface Props {
  embarqueId: string;
}

export function ReconciliacionTresColumnas({ embarqueId }: Props) {
  const [soloVarianza, setSoloVarianza] = useState(false);
  const umbrales = useUmbralesReconciliacion();
  const { data, isLoading, error } = useReconciliacion3Columnas(embarqueId, umbrales);

  const filas = useMemo<FilaReconciliacion3C[]>(() => {
    if (!data) return [];
    return soloVarianza
      ? data.filas.filter((f) => f.clasificacion !== "dentro_rango")
      : data.filas;
  }, [data, soloVarianza]);

  const columns = useMemo<ColumnDef<FilaReconciliacion3C, unknown>[]>(
    () => defineColumns<FilaReconciliacion3C>([
      {
        id: "concepto",
        header: "Concepto",
        accessorFn: (f) => f.concepto,
        meta: { sticky: true },
        cell: ({ row }) => row.original.concepto,
      },
      {
        id: "cotizado",
        header: "Cotizado",
        accessorFn: (f) => f.cotizado,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => fmt(row.original.cotizado, row.original.moneda),
      },
      {
        id: "refrescado",
        header: "Refrescado",
        accessorFn: (f) => f.refrescado,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => fmt(row.original.refrescado, row.original.moneda),
      },
      {
        id: "real",
        header: "Real",
        accessorFn: (f) => f.real,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => fmt(row.original.real, row.original.moneda),
      },
      {
        id: "delta_cot",
        header: "Δ vs Cot.",
        accessorFn: (f) => f.delta_cot_vs_real.pct,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => pctOPendiente(row.original.delta_cot_vs_real.pct, row.original.sin_factura || row.original.pendiente_tc === true),
      },
      {
        id: "delta_refr",
        header: "Δ vs Refr.",
        accessorFn: (f) => f.delta_refr_vs_real.pct,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => pctOPendiente(row.original.delta_refr_vs_real.pct, row.original.sin_factura || row.original.pendiente_tc === true),
      },
      {
        id: "estado",
        header: "Estado",
        accessorFn: (f) => f.clasificacion,
        cell: ({ row }) => (
          <Badge className={colorPorClasificacion(row.original.clasificacion)}>
            {row.original.pendiente_tc ? "Pendiente de TC" : etiquetaClasificacion(row.original.clasificacion)}
          </Badge>
        ),
      },
    ]),
    [],
  );

  if (isLoading) {
    return <EmptyStateInline loading message="Cargando reconciliación…" />;
  }
  if (error) {
    return (
      <p className="text-body text-destructive">
        Error al cargar reconciliación: {(error as Error).message}
      </p>
    );
  }
  if (!data) return null;

  if (!data.tiene_cotizacion) {
    return (
      <p className="text-body text-muted-foreground">
        Este embarque no proviene de una cotización; no hay base "cotizado" para reconciliar.
      </p>
    );
  }

  const exportCsv = () => {
    downloadCsvWithFeedback({
      filename: `reconciliacion-${embarqueId}.csv`,
      csv: generarCsvReconciliacion3C(data.filas),
      rowCount: data.filas.length,
      emptyWarning: { description: "No hay filas de reconciliación para exportar." },
    });
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="solo-varianza"
              checked={soloVarianza}
              onCheckedChange={setSoloVarianza}
            />
            <Label htmlFor="solo-varianza">Sólo con varianza</Label>
            <Tooltip>
              <TooltipTrigger className="text-body-sm text-muted-foreground ml-2">¿qué significan las columnas?</TooltipTrigger>
              <TooltipContent>
                Cotizado: versión aceptada. Refrescado: al crear el embarque. Real: importes de facturas
                de proveedor vigentes vinculadas.
              </TooltipContent>
            </Tooltip>
          </div>
          <Button variant="link" size="sm" className="h-auto p-0" onClick={exportCsv}>
            Exportar CSV
          </Button>
        </div>

        <DataTable<FilaReconciliacion3C>
          columns={columns}
          data={filas}
          rowKey={(f) => `${f.concepto}-${f.moneda}`}
          emptyMessage="No hay filas con varianza."
        />

        <ResumenReconciliacion resumen={data.resumen} versionAceptada={data.version_aceptada} />
      </div>
    </TooltipProvider>
  );
}
