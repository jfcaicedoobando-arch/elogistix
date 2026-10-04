import { Button } from "@/components/ui/button";
import { useSaldosCuentas } from "@/features/tesoreria/hooks/useTesoreriaCuentas";
import { roundMoney } from "@/lib/financial/financialUtils";
import { formatCurrency } from "@/lib/formatters";

/** Proyección informativa: no impone una política nueva de sobregiros. */
export function TraspasoSaldoOrigen({ cuentaId, moneda, cargo }: { cuentaId: string; moneda: string; cargo: number }) {
  const { data, isLoading, isError, refetch } = useSaldosCuentas();
  const cuenta = data?.find((c) => c.id === cuentaId);
  if (isLoading) return <p className="text-body-sm text-muted-foreground">Consultando el saldo actual de la cuenta origen…</p>;
  if (isError) return <div role="alert" className="text-body-sm text-warning">
    No se pudo consultar el saldo; la proyección no está disponible.
    <Button type="button" variant="ghost" size="sm" onClick={() => void refetch()}>Reintentar</Button>
  </div>;
  if (!cuenta || !Number.isFinite(cuenta.saldo) || cuenta.moneda !== moneda) {
    return <p className="text-body-sm text-warning">Saldo actual no disponible para esta cuenta.</p>;
  }
  const proyectado = roundMoney(cuenta.saldo - cargo);
  return <div className="border-t border-border pt-2 space-y-1 text-body-sm">
    <p>Saldo actual de la cuenta origen: <strong className="tabular-nums">{formatCurrency(cuenta.saldo, moneda)}</strong></p>
    <p>Saldo proyectado después del cargo y la comisión: <strong className="tabular-nums">{formatCurrency(proyectado, moneda)}</strong></p>
    <p className="text-muted-foreground">Proyección sobre el saldo actual; otros movimientos pueden cambiarlo antes de registrar.</p>
    {proyectado < 0 && <p role="status" className="text-warning">El saldo proyectado es negativo. Revisa el importe y la comisión antes de continuar.</p>}
  </div>;
}
