import { Ship, FileText, Users, DollarSign, AlertCircle, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/operaciones/KpiCard";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import type { KpiTone } from "@/lib/ui/kpiTones";

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
 * mediante `valorTooltip`.
 */
export default function ClienteSummaryCards({ embarques, cotizaciones, contactos, facturadoUSD, pendienteUSD, profitUSD }: Props) {
  const items: Array<{ label: string; value: string; tooltip?: string; icon: React.ElementType; tone: KpiTone }> = [
    { label: "Embarques", value: String(embarques), icon: Ship, tone: "info" },
    { label: "Cotizaciones", value: String(cotizaciones), icon: FileText, tone: "accent" },
    { label: "Contactos", value: String(contactos), icon: Users, tone: "success" },
    {
      label: "Facturado",
      value: formatCurrencyCompact(facturadoUSD, "USD"),
      tooltip: formatCurrency(facturadoUSD, "USD"),
      icon: DollarSign,
      tone: "secondary",
    },
    {
      label: "Pendiente",
      value: formatCurrencyCompact(pendienteUSD, "USD"),
      tooltip: formatCurrency(pendienteUSD, "USD"),
      icon: AlertCircle,
      tone: "warning",
    },
    {
      label: "Profit",
      value: formatCurrencyCompact(profitUSD, "USD"),
      tooltip: formatCurrency(profitUSD, "USD"),
      icon: TrendingUp,
      tone: "success",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {items.map((it) => (
        <KpiCard
          key={it.label}
          titulo={it.label}
          valor={it.value}
          valorTooltip={it.tooltip}
          icono={it.icon}
          color={it.tone}
        />
      ))}
    </div>
  );
}
