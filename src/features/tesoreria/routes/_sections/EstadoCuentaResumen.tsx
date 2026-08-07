/**
 * Cabecera de cifras del estado de cuenta bancario (v13.450.0).
 */
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/formatters";
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
    <div className="space-y-2">
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
      {estado?.fecha_saldo_inicial && (
        <p className="text-xs text-muted-foreground">
          Arranque de la cuenta: saldo inicial al {formatDate(estado.fecha_saldo_inicial)}.
          {estado.movimientos_previos_corte > 0 && (
            <>
              {" "}
              {estado.movimientos_previos_corte} movimiento
              {estado.movimientos_previos_corte === 1 ? "" : "s"} con fecha anterior al arranque
              {estado.movimientos_previos_corte === 1 ? " no afecta" : " no afectan"} el saldo.
            </>
          )}
        </p>
      )}
    </div>
  );
}
