/**
 * Formateo de saldos multi-moneda para Cartera.
 * Vive fuera del componente para no romper fast-refresh.
 */
import { formatCurrency } from "@/lib/formatters";
import { type SaldosPorMonedaCartera } from "@/features/bandejas/domain/aggregates";

/** Formatea saldos nativos como "$X MXN · $Y USD" (omite ceros). */
export function formatNativos(b: SaldosPorMonedaCartera): string {
  const parts: string[] = [];
  if (b.MXN > 0) parts.push(formatCurrency(b.MXN, "MXN"));
  if (b.USD > 0) parts.push(formatCurrency(b.USD, "USD"));
  for (const [cod, monto] of Object.entries(b.otras)) {
    if (monto > 0) parts.push(formatCurrency(monto, cod));
  }
  return parts.length > 0 ? parts.join(" · ") : formatCurrency(0, "MXN");
}
