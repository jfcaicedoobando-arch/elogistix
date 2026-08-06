import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { ResumenCuenta } from "@/features/tesoreria/services";

interface Props {
  cuentas: ResumenCuenta[];
}

export function SaldosBancosCard({ cuentas }: Props) {
  const totalMxn = cuentas.filter((c) => c.moneda === "MXN").reduce((a, c) => a + c.saldo, 0);
  const totalUsd = cuentas.filter((c) => c.moneda === "USD").reduce((a, c) => a + c.saldo, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Saldos bancarios</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {cuentas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cuentas activas.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1 font-medium text-muted-foreground">Cuenta</th>
                <th className="text-right py-1 font-medium text-muted-foreground">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {cuentas.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-1.5">
                    <div className="truncate">{c.alias}</div>
                    <div className="text-xs text-muted-foreground">{c.banco}</div>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatCurrency(c.saldo, c.moneda)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td className="py-2">Total MXN</td>
                <td className="py-2 text-right tabular-nums">{formatCurrency(totalMxn, "MXN")}</td>
              </tr>
              {totalUsd > 0 && (
                <tr className="font-semibold">
                  <td className="py-1">Total USD</td>
                  <td className="py-1 text-right tabular-nums">{formatCurrency(totalUsd, "USD")}</td>
                </tr>
              )}
            </tfoot>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
