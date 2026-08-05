/**
 * Tiles del dashboard `/compras`.
 *
 * v13.426.0 — Armonización global: `KpiCard` dejó de ser un clon local y ahora
 * es un adaptador delgado sobre `@/components/shared/KpiCard` (la tarjeta KPI
 * canónica del ERP). Se conserva la API local (`sub`, `tone`, `hint`, `to`)
 * para no tocar los call sites de `Compras.tsx`.
 */
import { KpiCard as SharedKpiCard } from "@/components/shared/KpiCard";
import type { KpiVariant } from "@/components/shared/kpiCard.tokens";

export type KpiTone = "default" | "info" | "warn" | "danger" | "success";

const TONE_TO_VARIANT: Record<KpiTone, KpiVariant> = {
  default: "default",
  info: "info",
  warn: "warning",
  danger: "destructive",
  success: "success",
};

export function KpiCard({
  label, value, sub, tone = "default", hint, to, valueTooltip,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: KpiTone;
  hint?: string;
  to?: string;
  /** Se acepta por compatibilidad; el icono lo resuelve la tarjeta canónica. */
  icon?: React.ReactNode;
  /** Tooltip con la cifra exacta cuando `value` viene en notación compacta. */
  valueTooltip?: string;
}) {
  return (
    <SharedKpiCard
      label={label}
      value={value}
      sublabel={sub}
      variant={TONE_TO_VARIANT[tone]}
      hint={hint}
      to={to}
      valueTooltip={valueTooltip}
    />
  );
}
