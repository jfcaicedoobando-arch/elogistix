/**
 * Tabla migrada a `DataTable` (Ola F, punto 8), con footer de totales.
 */
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Landmark } from "lucide-react";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { ResumenCuenta } from "@/features/tesoreria/services";

import { TableCell, TableRow } from "@/components/ui/table";
interface Props {
  cuentas: ResumenCuenta[];
}

/** Orden contable de presentación; cualquier otra moneda presente va al final. */
const ORDEN_MONEDAS = ["MXN", "USD", "EUR"];

/** P1-7: totales por CADA moneda realmente presente en las cuentas activas.
 *  Antes el footer estaba fijo a MXN/USD y una cuenta EUR no sumaba en ningún total. */
function totalesPorMoneda(cuentas: ResumenCuenta[]): Array<{ moneda: string; total: number }> {
  const por = new Map<string, number>();
  for (const c of cuentas) por.set(c.moneda, (por.get(c.moneda) ?? 0) + c.saldo);
  if (!por.has("MXN")) por.set("MXN", 0);
  return Array.from(por.entries())
    .map(([moneda, total]) => ({ moneda, total }))
    .sort((a, b) => {
      const ia = ORDEN_MONEDAS.indexOf(a.moneda);
      const ib = ORDEN_MONEDAS.indexOf(b.moneda);
      return (ia === -1 ? ORDEN_MONEDAS.length : ia) - (ib === -1 ? ORDEN_MONEDAS.length : ib);
    });
}

export function SaldosBancosCard({ cuentas }: Props) {
  const totales = totalesPorMoneda(cuentas);


  const columns: ColumnDef<ResumenCuenta, unknown>[] = defineColumns<ResumenCuenta>([
    {
      id: "cuenta", header: "Cuenta", meta: { width: COL_W.texto },
      cell: ({ row }) => (
        <div>
          <div className="truncate">{row.original.alias}</div>
          <div className="text-body-sm text-muted-foreground">{row.original.banco}</div>
        </div>
      ),
    },
    {
      id: "saldo", header: "Saldo", meta: { width: COL_W.monto, align: "right" },
      cell: ({ row }) => formatCurrency(row.original.saldo, row.original.moneda),
    },
  ]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Saldos bancarios</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <DataTable
          columns={columns}
          data={cuentas}
          rowKey={(c) => c.id}
          density={TABLE_DENSITY.embebida}
          emptyIcon={Landmark}
          emptyMessage="Sin cuentas activas."
          footer={() => (
            <>
              <TableRow className="font-semibold">
                <TableCell>Total MXN</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(totalMxn, "MXN")}</TableCell>
              </TableRow>
              {totalUsd > 0 && (
                <TableRow className="font-semibold">
                  <TableCell>Total USD</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totalUsd, "USD")}</TableCell>
                </TableRow>
              )}
            </>
          )}
        />
      </CardContent>
    </Card>
  );
}
