import { Ship, ClipboardList, Users, DollarSign, AlertCircle, TrendingUp, type LucideIcon } from "lucide-react";
import { KpiCard, type KpiVariant } from "@/components/shared/KpiCard";
import { KpiStrip } from "@/components/shared/KpiStrip";
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
 * v13.571.0: migrado a `KpiStrip` (carrusel en móvil, 3 columnas en desktop)
 * para que la franja se comporte igual que la del detalle de proveedor.
 */
export default function ClienteSummaryCards({ embarques, cotizaciones, contactos, facturadoUSD, pendienteUSD, profitUSD }: Props) {
  const items: Array<{
    label: string;
    value: string;
    sublabel?: string;
    tooltip?: string;
    icon: LucideIcon;
    variant: KpiVariant;
  }> = [
    { label: "Embarques", value: String(embarques), sublabel: "Operaciones del cliente", icon: Ship, variant: "info" },
    { label: "Cotizaciones", value: String(cotizaciones), sublabel: "Histórico comercial", icon: ClipboardList, variant: "accent" },
    { label: "Contactos", value: String(contactos), sublabel: "Exportadores / importadores", icon: Users, variant: "success" },
    {
      label: "Facturado",
      value: formatCurrencyCompact(facturadoUSD, "USD"),
      sublabel: "Total emitido (USD)",
      tooltip: formatCurrency(facturadoUSD, "USD"),
      icon: DollarSign,
      variant: "secondary",
    },
    {
      label: "Por cobrar",
      value: formatCurrencyCompact(pendienteUSD, "USD"),
      sublabel: "Saldo pendiente (USD)",
      tooltip: formatCurrency(pendienteUSD, "USD"),
      icon: AlertCircle,
      variant: "warning",
    },
    {
      label: "Utilidad",
      value: formatCurrencyCompact(profitUSD, "USD"),
      sublabel: "Utilidad acumulada (USD)",
      tooltip: formatCurrency(profitUSD, "USD"),
      icon: TrendingUp,
      variant: "success",
    },
  ];

  return (
    <KpiStrip desktopCols={3}>
      {items.map((it) => (
        <KpiCard
          key={it.label}
          label={it.label}
          value={it.value}
          sublabel={it.sublabel}
          valueTooltip={it.tooltip}
          icon={it.icon}
          variant={it.variant}
          iconVariant="chip"
        />
      ))}
    </KpiStrip>
  );
}
