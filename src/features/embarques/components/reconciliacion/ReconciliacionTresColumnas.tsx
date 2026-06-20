/**
 * Tabla de reconciliación a 3 columnas: cotizado / refrescado / real (Fase 2).
 */
import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useReconciliacion3Columnas } from "@/features/embarques/hooks/useReconciliacion3Columnas";
import type {
  ClasificacionVarianza,
  FilaReconciliacion3C,
} from "@/lib/domain/versionadoCotizacion";

const fmt = (n: number, moneda: string) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda || "USD" }).format(n);

const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

function colorPorClasificacion(c: ClasificacionVarianza): string {
  switch (c) {
    case "critica":
      return "bg-destructive/10 text-destructive";
    case "alerta":
      return "bg-warning/10 text-warning-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

interface Props {
  embarqueId: string;
}

export function ReconciliacionTresColumnas({ embarqueId }: Props) {
  const [soloVarianza, setSoloVarianza] = useState(false);
  const { data, isLoading, error } = useReconciliacion3Columnas(embarqueId);

  const filas = useMemo<FilaReconciliacion3C[]>(() => {
    if (!data) return [];
    return soloVarianza
      ? data.filas.filter((f) => f.clasificacion !== "dentro_rango")
      : data.filas;
  }, [data, soloVarianza]);

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando reconciliación…</p>;
  }
  if (error) {
    return (
      <p className="text-sm text-destructive">
        Error al cargar reconciliación: {(error as Error).message}
      </p>
    );
  }
  if (!data) return null;

  if (!data.tiene_cotizacion) {
    return (
      <p className="text-sm text-muted-foreground">
        Este embarque no proviene de una cotización; no hay base "cotizado" para reconciliar.
      </p>
    );
  }

  const exportCsv = () => {
    const header = "Concepto,Moneda,Cotizado,Refrescado,Real,Δ Cot vs Real (%),Clasificación";
    const lines = data.filas.map((f) =>
      [f.concepto, f.moneda, f.cotizado, f.refrescado, f.real,
        f.delta_cot_vs_real.pct.toFixed(2), f.clasificacion].join(","),
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconciliacion-${embarqueId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
          </div>
          <button
            type="button"
            onClick={exportCsv}
            className="text-sm underline text-primary"
          >
            Exportar CSV
          </button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">
                <Tooltip>
                  <TooltipTrigger>Cotizado</TooltipTrigger>
                  <TooltipContent>Monto en la versión aceptada por el cliente.</TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-right">
                <Tooltip>
                  <TooltipTrigger>Refrescado</TooltipTrigger>
                  <TooltipContent>
                    Monto al crear el embarque, con la tarifa vigente (Fase 1).
                  </TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-right">
                <Tooltip>
                  <TooltipTrigger>Real</TooltipTrigger>
                  <TooltipContent>Monto registrado en los costos del embarque.</TooltipContent>
                </Tooltip>
              </TableHead>
              <TableHead className="text-right">Δ vs Cot.</TableHead>
              <TableHead className="text-right">Δ vs Refr.</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f, i) => (
              <TableRow key={`${f.concepto}-${f.moneda}-${i}`}>
                <TableCell>{f.concepto}</TableCell>
                <TableCell className="text-right">{fmt(f.cotizado, f.moneda)}</TableCell>
                <TableCell className="text-right">{fmt(f.refrescado, f.moneda)}</TableCell>
                <TableCell className="text-right">{fmt(f.real, f.moneda)}</TableCell>
                <TableCell className="text-right">{pct(f.delta_cot_vs_real.pct)}</TableCell>
                <TableCell className="text-right">{pct(f.delta_refr_vs_real.pct)}</TableCell>
                <TableCell>
                  <Badge className={colorPorClasificacion(f.clasificacion)}>
                    {f.clasificacion}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {filas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No hay filas con varianza.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="rounded-md border p-3 text-sm">
          <div className="flex justify-between">
            <span>Total cotizado:</span>
            <span>{fmt(data.resumen.total_cotizado, "USD")}</span>
          </div>
          <div className="flex justify-between">
            <span>Total refrescado:</span>
            <span>{fmt(data.resumen.total_refrescado, "USD")}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Total real:</span>
            <span>{fmt(data.resumen.total_real, "USD")}</span>
          </div>
          <div className="flex justify-between mt-1">
            <span>Δ Cot. vs Real:</span>
            <span>
              {pct(data.resumen.delta_cot_vs_real.pct)}{" "}
              <Badge className={colorPorClasificacion(data.resumen.clasificacion)}>
                {data.resumen.clasificacion}
              </Badge>
            </span>
          </div>
          {data.version_aceptada != null && (
            <div className="text-xs text-muted-foreground mt-2">
              Versión cotizada aceptada: v{data.version_aceptada}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
