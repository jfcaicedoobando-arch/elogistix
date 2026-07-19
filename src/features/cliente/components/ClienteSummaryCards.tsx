import { Ship, ClipboardList, Users, DollarSign, AlertCircle, TrendingUp, type LucideIcon } from "lucide-react";
import { KpiCard, type KpiVariant } from "@/components/shared/KpiCard";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";

interface Props {
  embarques: number;
  cotizaciones: number;
  contactos: number;
  facturadoUSD: number;
  pendienteUSD: number;
  profitUSD: number;
}

/**
 * v8.99.40: KPIs monetarios usan notación compacta (USD 1.2M / USD 845K) para
 * evitar truncamiento "USD …" en grids de 6 columnas estrechas. El valor completo
 * (formato `formatCurrency`, ej. "USD 1,234,567.89") se expone como tooltip nativo
 * mediante `valueTooltip`.
 *
 * v13.302.3: migrado al `KpiCard` canónico (`iconVariant="chip"`).
 */
export default function ClienteSummaryCards({ embarques, cotizaciones, contactos, facturadoUSD, pendienteUSD, profitUSD }: Props) {
  const items: Array<{ label: string; value: string; tooltip?: string; icon: LucideIcon; variant: KpiVariant }> = [
    { label: "Embarques", value: String(embarques), icon: Ship, variant: "info" },
    { label: "Cotizaciones", value: String(cotizaciones), icon: ClipboardList, variant: "accent" },
    { label: "Contactos", value: String(contactos), icon: Users, variant: "success" },
    {
      label: "Facturado",
      value: formatCurrencyCompact(facturadoUSD, "USD"),
      tooltip: formatCurrency(facturadoUSD, "USD"),
      icon: DollarSign,
      variant: "secondary",
    },
    {
      label: "Pendiente",
      value: formatCurrencyCompact(pendienteUSD, "USD"),
      tooltip: formatCurrency(pendienteUSD, "USD"),
      icon: AlertCircle,
      variant: "warning",
    },
    {
      label: "Profit",
      value: formatCurrencyCompact(profitUSD, "USD"),
      tooltip: formatCurrency(profitUSD, "USD"),
      icon: TrendingUp,
      variant: "success",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {items.map((it) => (
        <KpiCard
          key={it.label}
          label={it.label}
          value={it.value}
          valueTooltip={it.tooltip}
          icon={it.icon}
          variant={it.variant}
          iconVariant="chip"
        />
      ))}
    </div>
  );
}
