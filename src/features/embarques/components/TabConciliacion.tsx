/**
 * Pestaña "Conciliación" del detalle de embarque (Fase 2).
 *
 * Muestra, por concepto_costo, qué tan cerca quedó la factura real del
 * proveedor vs el costo cotizado. Verde si la diferencia es ≤ 5%, amarillo
 * 5–15%, rojo > 15% o sin factura recibida.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scale } from "lucide-react";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import EmptyState from "@/components/empty/EmptyState";
import { formatCurrency, toTitleCase } from "@/lib/formatters";
import { useReconciliacionEmbarque, type FilaReconciliacion } from "@/features/embarques/hooks";
import { calcularResumen } from "@/features/embarques/services/reconciliacionCostos";
import { ReconciliacionTresColumnas } from "@/features/embarques/components/reconciliacion/ReconciliacionTresColumnas";


interface Props {
  embarqueId: string;
}

function colorDesviacion(pct: number, sinFactura: boolean): string {
  if (sinFactura) return "bg-muted text-muted-foreground border";
  const abs = Math.abs(pct);
  if (abs <= 5) return "bg-success/15 text-success border border-success/30";
  if (abs <= 15) return "bg-warning/15 text-warning-foreground border border-warning/30";
  return "bg-destructive/15 text-destructive border border-destructive/30";
}

function fmtPct(p: number): string {
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}%`;
}

export function TabConciliacion({ embarqueId }: Props) {
  const { data: filas = [], isLoading } = useReconciliacionEmbarque(embarqueId);
  const resumen = useMemo(() => calcularResumen(filas), [filas]);

  const cols = useMemo<ColumnDef<FilaReconciliacion, unknown>[]>(() => defineColumns<FilaReconciliacion>([
    { id: "proveedor", header: "Proveedor", cell: ({ row }) => <span title={row.original.proveedor_nombre}>{toTitleCase(row.original.proveedor_nombre)}</span> },
    { id: "concepto", header: "Concepto", cell: ({ row }) => row.original.concepto },
    { id: "cotizado", header: "Cotizado", meta: { align: "right", className: "tabular-nums" }, cell: ({ row }) => formatCurrency(row.original.cotizado, row.original.moneda) },
    { id: "real", header: "Real facturado", meta: { align: "right", className: "tabular-nums" }, cell: ({ row }) => formatCurrency(row.original.real_facturado, row.original.moneda) },
    {
      id: "dif", header: "Diferencia",
      meta: { align: "right", className: "tabular-nums font-medium" },
      cell: ({ row }) => {
        const sinFac = row.original.facturas.length === 0;
        if (sinFac) return <span className="text-muted-foreground text-xs">— sin factura —</span>;
        return (
          <span className={row.original.diferencia > 0 ? "text-destructive" : row.original.diferencia < 0 ? "text-success" : ""}>
            {formatCurrency(row.original.diferencia, row.original.moneda)}
          </span>
        );
      },
    },
    {
      id: "pct", header: "Desviación",
      cell: ({ row }) => {
        const sinFac = row.original.facturas.length === 0;
        return <Badge className={`text-xs ${colorDesviacion(row.original.desviacion_pct, sinFac)}`}>{sinFac ? "Pendiente" : fmtPct(row.original.desviacion_pct)}</Badge>;
      },
    },
    {
      id: "facs", header: "Facturas",
      cell: ({ row }) => row.original.facturas.length === 0
        ? <span className="text-muted-foreground text-xs">—</span>
        : (
          <div className="flex flex-wrap gap-1">
            {row.original.facturas.map((f) => (
              <Link key={f.proveedor_factura_id} to={`/cxp?factura=${f.proveedor_factura_id}`}
                className="text-xs text-primary hover:underline font-mono" onClick={(e) => e.stopPropagation()}>
                {f.folio_proveedor}
              </Link>
            ))}
          </div>
        ),
    },
  ]), []);

  const kpis = [
    { label: "Total Cotizado", value: formatCurrency(resumen.total_cotizado) },
    { label: "Total Real", value: formatCurrency(resumen.total_real) },
    {
      label: "Desviación",
      value: filas.length === 0 ? "—" : fmtPct(resumen.desviacion_pct_total),
      color: resumen.desviacion_pct_total > 5 ? "text-destructive" : resumen.desviacion_pct_total < -5 ? "text-success" : "",
    },
    {
      label: "Sin factura",
      value: `${resumen.conceptos_sin_factura} / ${filas.length}`,
      color: resumen.conceptos_sin_factura > 0 ? "text-warning-foreground" : "",
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Reconciliación 3 columnas (Cotizado · Refrescado · Real)</CardTitle>
        </CardHeader>
        <CardContent>
          <ReconciliacionTresColumnas embarqueId={embarqueId} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{k.label}</p>
              <p className={`text-lg font-bold mt-1 tabular-nums ${k.color ?? ""}`}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Cotizado vs Real por concepto (facturas proveedor)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={cols}
            data={filas}
            rowKey={(r) => r.concepto_costo_id}
            density="compact"
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={Scale}
                  title={isLoading ? "Cargando conciliación…" : "Sin costos para conciliar"}
                  description="Carga conceptos de costo y vincúlalos desde las facturas de proveedor para ver la comparación cotizado vs real."
                />
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

