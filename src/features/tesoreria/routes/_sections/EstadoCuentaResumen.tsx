/**
 * Cabecera de cifras del estado de cuenta bancario (v13.450.0).
 */
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import type { EstadoCuentaBancario } from "@/features/tesoreria/domain/estadoCuenta";

interface Props {
  estado?: EstadoCuentaBancario;
  isLoading: boolean;
}

export function EstadoCuentaResumen({ estado, isLoading }: Props) {
  const items = estado
    ? [
        { label: "Saldo inicial", valor: formatCurrency(estado.saldo_inicial, estado.moneda) },
        { label: "Entradas", valor: formatCurrency(estado.total_entradas, estado.moneda), tone: "text-success" },
        { label: "Salidas", valor: formatCurrency(estado.total_salidas, estado.moneda), tone: "text-destructive" },
        {
          label: "Saldo final",
          valor: formatCurrency(estado.saldo_final, estado.moneda),
          tone: estado.saldo_final < 0 ? "text-destructive" : undefined,
        },
      ]
    : [];

  return (
    <Card>
      <CardContent density="compact" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading || !estado
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          : items.map((it) => (
              <div key={it.label}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{it.label}</p>
                <p className={`mt-1 text-lg font-semibold tabular-nums ${it.tone ?? ""}`}>{it.valor}</p>
              </div>
            ))}
      </CardContent>
    </Card>
  );
}
