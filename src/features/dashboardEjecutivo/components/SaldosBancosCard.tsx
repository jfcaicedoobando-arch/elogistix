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

export function SaldosBancosCard({ cuentas }: Props) {
  const totalMxn = cuentas.filter((c) => c.moneda === "MXN").reduce((a, c) => a + c.saldo, 0);
  const totalUsd = cuentas.filter((c) => c.moneda === "USD").reduce((a, c) => a + c.saldo, 0);

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
