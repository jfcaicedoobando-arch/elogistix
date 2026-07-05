/**
 * Pestaña "P&L por Contenedor" (v13.66.14) — modelo CargoWise.
 *
 * Muestra una vista de utilidad por contenedor dentro del mismo embarque.
 * v13.172.18: migrado a `DataTable` (Fase 5 homologación).
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrency } from "@/lib/formatters";
import { useContenedoresEmbarque } from "@/features/embarques/hooks/useContenedoresEmbarque";
import { useEmbarqueDetalleData } from "@/features/embarques/hooks/useEmbarqueDetalleData";
import {
  calcularPnlPorContenedor,
  type FilaPnlContenedor,
} from "@/features/embarques/services/pnlPorContenedor";
import { KpiCard } from "./pnl/KpiCard";

interface Props {
  embarqueId: string;
  expediente: string;
}

export function TabPnlContenedor({ embarqueId, expediente }: Props) {
  const { conceptosVenta, conceptosCosto, isLoading: loadingConceptos } =
    useEmbarqueDetalleData(embarqueId);
  const { data: contenedores = [], isLoading: loadingContenedores } =
    useContenedoresEmbarque(embarqueId);

  const porMoneda = useMemo(
    () =>
      calcularPnlPorContenedor({
        expediente,
        contenedores,
        conceptosVenta: conceptosVenta ?? [],
        conceptosCosto: conceptosCosto ?? [],
      }),
    [expediente, contenedores, conceptosVenta, conceptosCosto],
  );

  const monedas = Object.keys(porMoneda).sort();

  if (loadingConceptos || loadingContenedores) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (contenedores.length === 0 && monedas.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Este embarque no tiene contenedores registrados.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-info/30 bg-info/5">
        <CardContent className="pt-4 text-xs text-muted-foreground">
          Modelo CargoWise: 1 embarque = 1 expediente. El sub-expediente
          (ej. <span className="font-mono">{expediente}-01</span>) es sólo
          referencia operativa del contenedor. Los conceptos sin contenedor
          asignado se prorratean en partes iguales (÷N).
        </CardContent>
      </Card>

      {monedas.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No hay conceptos de venta ni costo registrados.
          </CardContent>
        </Card>
      ) : (
        monedas.map((moneda) => (
          <TablaPorMoneda
            key={moneda}
            moneda={moneda}
            filas={porMoneda[moneda]}
          />
        ))
      )}
    </div>
  );
}

interface TablaProps {
  moneda: string;
  filas: FilaPnlContenedor[];
}

function TablaPorMoneda({ moneda, filas }: TablaProps) {
  const total = filas.find((f) => f.esTotal);
  const utilidad = total?.utilidad ?? 0;
  const margen = total?.margenPct ?? 0;

  const fmt = (n: number) => formatCurrency(n, moneda);
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
      {
        id: "numero",
        header: "# Contenedor",
        accessorFn: (f) => f.numeroContenedor,
        cell: ({ row }) => row.original.numeroContenedor,
      },
      {
        id: "tipo",
        header: "Tipo",
        accessorFn: (f) => f.tipoContenedor,
        cell: ({ row }) => row.original.tipoContenedor,
      },
      {
        id: "vd",
        header: "Venta directa",
        accessorFn: (f) => f.ventaDirecta,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => fmt(row.original.ventaDirecta),
      },
      {
        id: "vp",
        header: "Venta prorrateada",
        accessorFn: (f) => f.ventaProrrateada,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => fmt(row.original.ventaProrrateada),
      },
      {
        id: "vt",
        header: "Venta total",
        accessorFn: (f) => f.ventaTotal,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => fmt(row.original.ventaTotal),
      },
      {
        id: "cd",
        header: "Costo directo",
        accessorFn: (f) => f.costoDirecto,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => fmt(row.original.costoDirecto),
      },
      {
        id: "cp",
        header: "Costo prorrateado",
        accessorFn: (f) => f.costoProrrateado,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => fmt(row.original.costoProrrateado),
      },
      {
        id: "ct",
        header: "Costo total",
        accessorFn: (f) => f.costoTotal,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => fmt(row.original.costoTotal),
      },
      {
        id: "u",
        header: "Utilidad",
        accessorFn: (f) => f.utilidad,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => (
          <span className={row.original.utilidad < 0 ? "text-destructive" : ""}>
            {fmt(row.original.utilidad)}
          </span>
        ),
      },
      {
        id: "m",
        header: "Margen %",
        accessorFn: (f) => f.margenPct,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) => pct(row.original.margenPct),
      },
    ]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [moneda],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          P&amp;L por contenedor
          <Badge variant="outline" className="font-mono">
            {moneda}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Venta total" value={fmt(total?.ventaTotal ?? 0)} />
          <KpiCard label="Costo total" value={fmt(total?.costoTotal ?? 0)} />
          <KpiCard
            label="Utilidad"
            value={fmt(utilidad)}
            tone={utilidad >= 0 ? "success" : "destructive"}
          />
          <KpiCard
            label="Margen"
            value={pct(margen)}
            tone={margen < 15 ? "warning" : "success"}
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
