import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import { calcularUtilidad, calcularMargen } from "@/lib/financial/financialUtils";
import { ProfitBadge } from "@/components/ProfitBadge";
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
                <TableHead>Concepto</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Costo Unit.</TableHead>
                <TableHead className="text-right">Venta</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">% Profit</TableHead>
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
                    <TableRow>
                      <TableCell className="font-medium text-sm">{fila.concepto}</TableCell>
                      <TableCell>
                        {canEdit ? (
                          <Input value={fila.proveedor} onChange={e => onUpdate(globalIdx, "proveedor", e.target.value)} className="h-8 text-sm" placeholder="Proveedor" />
                        ) : <span className="text-sm">{fila.proveedor || "-"}</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {canEdit ? (
                          <Input type="number" value={fila.costo_unitario || ""} onChange={e => onUpdate(globalIdx, "costo_unitario", e.target.value)} className="h-8 text-sm text-right w-28 ml-auto" min={0} step={0.01} />
                        ) : <span className="text-sm">{formatCurrency(fila.costo_unitario, moneda)}</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(fila.venta, moneda)}
                        {fila.aplica_iva && <span className="text-xs text-muted-foreground ml-1">+ IVA</span>}
                      </TableCell>
                      <TableCell className={`text-right text-sm font-medium ${profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {formatCurrency(profit, moneda)}
                      </TableCell>
                      <TableCell className="text-right"><ProfitBadge porcentaje={pct} /></TableCell>
                    </TableRow>
                    {(canEdit || fila.notas) && (
                      <TableRow>
                        <TableCell colSpan={6} className="pt-0 pb-2" style={{ borderTop: 'none' }}>
                          {canEdit ? (
                            <Textarea
                              placeholder="Notas (opcional)"
                              value={fila.notas || ""}
                              onChange={e => onUpdate(globalIdx, "notas", e.target.value)}
                              className="text-xs h-8 min-h-[32px] resize-none focus:min-h-[60px] transition-all"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground italic">↳ {fila.notas}</span>
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
                <TableCell className="text-right">{formatCurrency(totales.totalCosto, moneda)}</TableCell>
                <TableCell className="text-right">{formatCurrency(totales.totalVenta, moneda)}</TableCell>
                <TableCell className={`text-right ${totales.profit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {formatCurrency(totales.profit, moneda)}
                </TableCell>
                <TableCell className="text-right"><ProfitBadge porcentaje={totales.porcentaje} /></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        {moneda === "MXN" && (
          <div className="mt-3 space-y-1">
            <p className="text-xs text-muted-foreground">* P&L calculado sobre subtotales sin IVA</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
