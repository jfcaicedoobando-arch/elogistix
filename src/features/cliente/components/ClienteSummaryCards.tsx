import { Ship, ClipboardList, Users, DollarSign, AlertCircle, TrendingUp, type LucideIcon } from "lucide-react";
import { KpiCard, type KpiVariant } from "@/components/shared/KpiCard";
import { KpiStrip } from "@/components/shared/KpiStrip";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";

interface Props {
  embarques: number;
  cotizaciones: number;
  contactos: number;
  facturadoMXN: number;
  pendienteMXN: number;
  profitMXN: number;
  /** Facturas/embarques excluidos por falta de tipo de cambio confiable (Ola 6 · M1). */
  facturasSinTc?: number;
  embarquesSinTc?: number;
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
 * v13.773.1 (Ola 6 · M1): los importes están en MXN convertidos con el TC de
 * cada documento — antes se rotulaban USD sumando monedas distintas. Cuando hay
 * documentos sin TC confiable se avisa en el subtítulo en lugar de callarlo.
 */
export default function ClienteSummaryCards({
  embarques,
  cotizaciones,
  contactos,
  facturadoMXN,
  pendienteMXN,
  profitMXN,
  facturasSinTc = 0,
  embarquesSinTc = 0,
}: Props) {
  const avisoFacturas = facturasSinTc > 0
    ? ` · ${facturasSinTc} sin tipo de cambio (excluida${facturasSinTc === 1 ? "" : "s"})`
    : "";
  const avisoEmbarques = embarquesSinTc > 0
    ? ` · ${embarquesSinTc} embarque${embarquesSinTc === 1 ? "" : "s"} sin tipo de cambio`
    : "";
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
      value: formatCurrencyCompact(facturadoMXN, "MXN"),
      sublabel: `Total emitido (MXN)${avisoFacturas}`,
      tooltip: formatCurrency(facturadoMXN, "MXN"),
      icon: DollarSign,
      variant: "secondary",
    },
    {
      label: "Por cobrar",
      value: formatCurrencyCompact(pendienteMXN, "MXN"),
      sublabel: `Saldo pendiente (MXN)${avisoFacturas}`,
      tooltip: formatCurrency(pendienteMXN, "MXN"),
      icon: AlertCircle,
      variant: "warning",
    },
    {
      label: "Utilidad",
      value: formatCurrencyCompact(profitMXN, "MXN"),
      sublabel: `Utilidad acumulada (MXN)${avisoEmbarques}`,
      tooltip: formatCurrency(profitMXN, "MXN"),
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
