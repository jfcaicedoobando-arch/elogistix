/**
 * Tabla "Presupuestado vs. Real" por concepto del bloque P&L.
 * Extraída de `TabPnl.tsx` en v13.56.2 (auditoría — paso 5).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingDown, TrendingUp } from "lucide-react";
import { fmtPnl, pctPnl, deltaPnl } from "@/lib/formatters/pnl";
import type { PnlPorConcepto } from "@/features/embarques/services/pnlFinanciero";

interface Props {
  titulo: string;
  rows: PnlPorConcepto[];
  /** Si true, las desviaciones positivas (gastos > presupuesto) se marcan en rojo. */
  invertirAlerta: boolean;
}

export function PnlComparativaTable({ titulo, rows, invertirAlerta }: Props) {
  const totPresup = rows.reduce((a, r) => a + (r.presupuestado_mxn ?? 0), 0);
  const totReal = rows.reduce((a, r) => a + (r.real_mxn ?? 0), 0);
  const totDesv = totReal - totPresup;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Concepto</TableHead>
              <TableHead className="text-right">Presupuestado</TableHead>
              <TableHead className="text-right">Real</TableHead>
              <TableHead className="text-right">Δ MXN</TableHead>
              <TableHead className="text-right">Δ %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">Sin datos</TableCell>
              </TableRow>
            )}
            {rows.map((r, idx) => {
              const d = deltaPnl(r.real_mxn, r.presupuestado_mxn);
              const isBad = invertirAlerta ? d.abs > 0 : d.abs < 0;
              const Icon = d.abs >= 0 ? TrendingUp : TrendingDown;
              return (
                <TableRow key={`${r.concepto}-${idx}`}>
                  <TableCell className="capitalize">{r.concepto}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPnl(r.presupuestado_mxn)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPnl(r.real_mxn)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${isBad ? "text-destructive" : "text-success"}`}>
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Icon className="h-3 w-3" />
                      {fmtPnl(d.abs)}
                    </span>
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${isBad ? "text-destructive" : "text-success"}`}>
                    {r.presupuestado_mxn > 0 ? pctPnl(d.pct) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow className="font-semibold border-t-2">
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPnl(totPresup)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtPnl(totReal)}</TableCell>
                <TableCell className={`text-right tabular-nums ${(invertirAlerta ? totDesv > 0 : totDesv < 0) ? "text-destructive" : "text-success"}`}>
                  {fmtPnl(totDesv)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {totPresup > 0 ? pctPnl((totDesv / totPresup) * 100) : "—"}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </CardContent>
    </Card>
  );
}
