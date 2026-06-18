/**
 * Pestaña "P&L por Contenedor" (v13.66.14) — modelo CargoWise.
 *
 * Muestra una vista de utilidad por contenedor dentro del mismo embarque.
 * El "sub-expediente" (ELIMP00272-01) es sólo etiqueta de display.
 * Los conceptos con `contenedor_id = NULL` se prorratean flat (÷N).
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sub-expediente</TableHead>
                <TableHead># Contenedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Venta directa</TableHead>
                <TableHead className="text-right">Venta prorrateada</TableHead>
                <TableHead className="text-right">Venta total</TableHead>
                <TableHead className="text-right">Costo directo</TableHead>
                <TableHead className="text-right">Costo prorrateado</TableHead>
                <TableHead className="text-right">Costo total</TableHead>
                <TableHead className="text-right">Utilidad</TableHead>
                <TableHead className="text-right">Margen %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((f, idx) => {
                const isTotal = !!f.esTotal;
                const isGen = !!f.esGenerales;
                return (
                  <TableRow
                    key={`${f.contenedorId ?? "g"}-${idx}`}
                    className={
                      isTotal
                        ? "font-semibold bg-muted/40"
                        : isGen
                          ? "bg-warning/5 text-muted-foreground"
                          : idx % 2 === 0
                            ? "bg-muted/20"
                            : ""
                    }
                  >
                    <TableCell className="font-mono text-xs">
                      {isTotal || isGen ? (
                        f.subexpediente
                      ) : (
                        <Badge variant="outline" className="font-mono">
                          {f.subexpediente}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{f.numeroContenedor}</TableCell>
                    <TableCell>{f.tipoContenedor}</TableCell>
                    <TableCell className="text-right">{fmt(f.ventaDirecta)}</TableCell>
                    <TableCell className="text-right">{fmt(f.ventaProrrateada)}</TableCell>
                    <TableCell className="text-right">{fmt(f.ventaTotal)}</TableCell>
                    <TableCell className="text-right">{fmt(f.costoDirecto)}</TableCell>
                    <TableCell className="text-right">{fmt(f.costoProrrateado)}</TableCell>
                    <TableCell className="text-right">{fmt(f.costoTotal)}</TableCell>
                    <TableCell
                      className={`text-right ${f.utilidad < 0 ? "text-destructive" : ""}`}
                    >
                      {fmt(f.utilidad)}
                    </TableCell>
                    <TableCell className="text-right">{pct(f.margenPct)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
