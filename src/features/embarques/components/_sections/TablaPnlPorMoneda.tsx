/**
 * Sub-componente `TablaPorMoneda` para `TabPnlContenedor` — extraído en
 * v13.182.0 (Wave 2 splits). Sin cambios de comportamiento.
 */
import { useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrency } from "@/lib/formatters";
import type { FilaPnlContenedor } from "@/features/embarques/services/pnlPorContenedor";
import { KpiCard } from "@/components/shared/KpiCard";
import { PNL_UMBRAL_MARGEN_MIN_PCT } from "@/features/embarques/domain/pnlAlertas";

interface TablaProps {
  moneda: string;
  filas: FilaPnlContenedor[];
}

export function TablaPorMoneda({ moneda, filas }: TablaProps) {
  const total = filas.find((f) => f.esTotal);
  const utilidad = total?.utilidad ?? 0;
  const margen = total?.margenPct ?? 0;

  const fmt = useCallback((n: number) => formatCurrency(n, moneda), [moneda]);
  const pct = (n: number) => `${n.toFixed(1)}%`;

  const columns = useMemo<ColumnDef<FilaPnlContenedor, unknown>[]>(
    () => defineColumns<FilaPnlContenedor>([
      {
        id: "sub",
        header: "Sub-expediente",
        accessorFn: (f) => f.subexpediente,
        meta: { sticky: true, className: "font-mono text-xs" },
        cell: ({ row }) => {
          const f = row.original;
          if (f.esTotal || f.esGenerales) return f.subexpediente;
          return <Badge variant="outline" className="font-mono">{f.subexpediente}</Badge>;
        },
      },
      { id: "numero", header: "# Contenedor", accessorFn: (f) => f.numeroContenedor, cell: ({ row }) => row.original.numeroContenedor },
      { id: "tipo", header: "Tipo", accessorFn: (f) => f.tipoContenedor, cell: ({ row }) => row.original.tipoContenedor },
      {
        id: "vd", header: "Venta directa", accessorFn: (f) => f.ventaDirecta,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => fmt(row.original.ventaDirecta),
      },
      {
        id: "vp", header: "Venta prorrateada", accessorFn: (f) => f.ventaProrrateada,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => fmt(row.original.ventaProrrateada),
      },
      {
        id: "vt", header: "Venta total", accessorFn: (f) => f.ventaTotal,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => fmt(row.original.ventaTotal),
      },
      {
        id: "cd", header: "Costo directo", accessorFn: (f) => f.costoDirecto,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => fmt(row.original.costoDirecto),
      },
      {
        id: "cp", header: "Costo prorrateado", accessorFn: (f) => f.costoProrrateado,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => fmt(row.original.costoProrrateado),
      },
      {
        id: "ct", header: "Costo total", accessorFn: (f) => f.costoTotal,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => fmt(row.original.costoTotal),
      },
      {
        id: "u", header: "Utilidad", accessorFn: (f) => f.utilidad,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => (
          <span className={row.original.utilidad < 0 ? "text-destructive" : ""}>
            {fmt(row.original.utilidad)}
          </span>
        ),
      },
      {
        id: "m", header: "Margen %", accessorFn: (f) => f.margenPct,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => pct(row.original.margenPct),
      },
    ]),
    [fmt],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          P&amp;L por contenedor
          <Badge variant="outline" className="font-mono">{moneda}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Venta total" value={fmt(total?.ventaTotal ?? 0)} />
          <KpiCard label="Costo total" value={fmt(total?.costoTotal ?? 0)} />
          <KpiCard
            label="Utilidad"
            value={fmt(utilidad)}
            variant={utilidad >= 0 ? "success" : "destructive"}
          />
          <KpiCard
            label="Margen"
            value={pct(margen)}
            variant={margen < PNL_UMBRAL_MARGEN_MIN_PCT ? "warning" : "success"}
          />
        </div>

        <DataTable<FilaPnlContenedor>
          columns={columns}
          data={filas}
          rowKey={(f) => `${f.contenedorId ?? "g"}-${f.subexpediente}`}
          rowClassName={(f) =>
            f.esTotal ? "font-semibold bg-muted/40" : f.esGenerales ? "bg-warning/5 text-muted-foreground" : ""
          }
          skeletonRows={3}
          emptyMessage="Sin filas."
        />
      </CardContent>
    </Card>
  );
}
