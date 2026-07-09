/**
 * Formatters compartidos por componentes de tarifas de costeo.
 *
 * DRY: son wrappers finos sobre `@/lib/formatters` para preservar las firmas
 * existentes en los call-sites y evitar duplicar `new Intl.NumberFormat`.
 */
import { formatCurrency, formatDate } from "@/lib/formatters";

export const usdTarifa = (n: number | null | undefined): string =>
  formatCurrency(Number(n || 0), "USD");

export const formatFechaMx = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const clean = String(iso).split("T")[0];
  return formatDate(clean, "dd/MM/yyyy");
};
