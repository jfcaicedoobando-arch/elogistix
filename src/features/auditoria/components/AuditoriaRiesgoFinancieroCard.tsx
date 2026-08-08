/**
 * Tarjeta ejecutiva de fuga financiera. Suma MXN de los hallazgos
 * financieros pendientes y los desglosa por regla.
 */
import { TrendingDown } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import type { ReglaAuditoria } from "@/features/auditoria/types";
import { formatCurrency } from "@/lib/formatters/numbers";

interface Props {
  total: number;
  porRegla: Partial<Record<ReglaAuditoria, number>>;
}

const reglaLabel: Partial<Record<ReglaAuditoria, string>> = {
  margen_negativo: "Margen estimado negativo",
  margen_bajo: "Margen estimado bajo",
  proforma_vencida: "Proformas vencidas",
};

/** Riesgo financiero se muestra sin decimales para ahorrar espacio en la tarjeta. */
const fmt = (n: number): string =>
  formatCurrency(Math.round(n), "MXN").replace(/\.00$/, "");

export function AuditoriaRiesgoFinancieroCard({ total, porRegla }: Props) {
  const items = Object.entries(porRegla)
    .filter(([, v]) => (v ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));

  return (
    <KpiCard
      label="Riesgo financiero pendiente"
      value={fmt(total)}
      icon={TrendingDown}
      variant="warning"
    >
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-2">
          Sin fugas financieras detectadas en los embarques actuales.
        </p>
      ) : (
        <div className="space-y-1 text-xs mt-2">
          {items.map(([regla, monto]) => (
            <div
              key={regla}
              className="flex items-center justify-between border-t pt-1 first:border-t-0 first:pt-0"
            >
              <span className="text-muted-foreground">
                {reglaLabel[regla as ReglaAuditoria] ?? regla}
              </span>
              <span className="font-semibold tabular-nums">
                {fmt(monto ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </KpiCard>
  );
}
