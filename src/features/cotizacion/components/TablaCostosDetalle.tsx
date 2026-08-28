import { MONTO_MAX } from "@/lib/validation/limitesNumericos";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { DetailTableHead, DetailTableRow } from "@/components/shared/DetailTable";
import { formatCurrency } from "@/lib/formatters";
import { calcularUtilidad, calcularMargen } from "@/lib/financial/financialUtils";
import { ProfitBadge } from "@/features/cotizacion/components/ProfitBadge";
import type { TotalesPL } from "@/lib/financial/profitUtils";

interface FilaCostoDetalle {
  concepto: string;
  moneda: "USD" | "MXN";
  proveedor: string;
  cantidad: number;
  costo_unitario: number;
  venta: number;
  aplica_iva?: boolean;
  notas?: string;
}

function getGlobalIndex(filas: { moneda: string }[], moneda: string, localIdx: number) {
  let count = 0;
  for (let i = 0; i < filas.length; i++) {
    if (filas[i].moneda === moneda) {
      if (count === localIdx) return i;
      count++;
    }
  }
  return -1;
}

interface Props {
  filas: FilaCostoDetalle[];
  filasMoneda: FilaCostoDetalle[];
  moneda: "USD" | "MXN";
  title: string;
  icon: React.ReactNode;
  totales: TotalesPL;
  canEdit: boolean;
  onUpdate: (globalIdx: number, field: "proveedor" | "costo_unitario" | "notas", value: string) => void;
}

export default function TablaCostosDetalle({ filas, filasMoneda, moneda, title, icon, totales, canEdit, onUpdate }: Props) {
  if (filasMoneda.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">{icon} {title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <DetailTableHead className="whitespace-nowrap">Concepto</DetailTableHead>
                <DetailTableHead className="whitespace-nowrap">Proveedor</DetailTableHead>
                <DetailTableHead className="text-right whitespace-nowrap">Costo Unit.</DetailTableHead>
                <DetailTableHead className="text-right whitespace-nowrap">Venta</DetailTableHead>
                <DetailTableHead className="text-right whitespace-nowrap">Utilidad</DetailTableHead>
                <DetailTableHead className="text-right whitespace-nowrap">% Utilidad</DetailTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filasMoneda.map((fila, idx) => {
                const costo = fila.cantidad * fila.costo_unitario;
                const profit = calcularUtilidad(fila.venta, costo);
                const pct = calcularMargen(fila.venta, costo);
                const globalIdx = getGlobalIndex(filas, moneda, idx);

                return (
                  <React.Fragment key={idx}>
                    <DetailTableRow>
                      <TableCell className="font-medium text-body">{fila.concepto}</TableCell>
                      <TableCell>
                        {canEdit ? (
                          <Input value={fila.proveedor} onChange={e => onUpdate(globalIdx, "proveedor", e.target.value)} className="h-8 text-body" placeholder="Proveedor" aria-label={`Proveedor de ${fila.concepto}`} />
                        ) : <span className="text-body">{fila.proveedor || "-"}</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit ? (
                          <Input type="number" value={fila.costo_unitario || ""} onChange={e => onUpdate(globalIdx, "costo_unitario", e.target.value)} className="h-8 text-body text-right tabular-nums w-28 ml-auto" min={0} max={MONTO_MAX} step={0.01} aria-label={`Costo unitario de ${fila.concepto}`} />
                        ) : <span className="text-body tabular-nums">{formatCurrency(fila.costo_unitario, moneda)}</span>}
                      </TableCell>
                      <TableCell className="text-right text-body tabular-nums whitespace-nowrap">
                        {formatCurrency(fila.venta, moneda)}
                      </TableCell>
                      <TableCell className={`text-right text-body tabular-nums font-medium ${profit >= 0 ? "text-success" : "text-destructive"}`}>
                        {formatCurrency(profit, moneda)}
                      </TableCell>
                      <TableCell className="text-right"><ProfitBadge porcentaje={pct} /></TableCell>
                    </DetailTableRow>
                    {(canEdit || fila.notas) && (
                      <TableRow>
                        <TableCell colSpan={6} className="pt-0 pb-2 border-t-0">
                          {canEdit ? (
                            <Textarea
                              placeholder="Notas (opcional)"
                              value={fila.notas || ""}
                              onChange={e => onUpdate(globalIdx, "notas", e.target.value)}
                              className="text-body-sm h-8 resize-none focus:min-h-16 transition-[min-height]"
                            />
                          ) : (
                            <span className="text-body-sm text-muted-foreground italic">↳ {fila.notas}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="font-semibold">
                <TableCell colSpan={2}>Totales</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(totales.totalCosto, moneda)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(totales.totalVenta, moneda)}</TableCell>
                <TableCell className={`text-right tabular-nums ${totales.profit >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(totales.profit, moneda)}
                </TableCell>
                <TableCell className="text-right"><ProfitBadge porcentaje={totales.porcentaje} /></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        {moneda === "MXN" && (
          <div className="mt-3 space-y-1">
            <p className="text-body-sm text-muted-foreground">* P&L calculado sobre subtotales sin IVA</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
