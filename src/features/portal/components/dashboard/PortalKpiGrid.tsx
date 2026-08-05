import { Ship, ClipboardList, Receipt, type LucideIcon } from "lucide-react";
import { KpiCard, type KpiVariant } from "@/components/shared/KpiCard";
import { ROUTES } from "@/constants/routes";

type KpiKey = "embarques" | "cotizaciones" | "facturas";

interface KpiDef {
  key: KpiKey;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  href: string;
  variant: KpiVariant;
}

/**
 * v13.424.0 — Estas tarjetas eran un clon artesanal (Card + CardContent +
 * clases de color ad-hoc como `text-[hsl(var(--warning))]`). Ahora usan la
 * `KpiCard` canónica con `iconVariant="chip"`, igual que el resto del ERP.
 */
const KPIS: KpiDef[] = [
  { key: "embarques", label: "Embarques activos", shortLabel: "Embarques", icon: Ship, href: ROUTES.PORTAL_EMBARQUES, variant: "accent" },
  { key: "cotizaciones", label: "Cotizaciones pendientes", shortLabel: "Cotizaciones", icon: ClipboardList, href: ROUTES.PORTAL_COTIZACIONES, variant: "info" },
  { key: "facturas", label: "Facturas pendientes", shortLabel: "Facturas", icon: Receipt, href: ROUTES.PORTAL_FACTURAS, variant: "warning" },
];

interface Props {
  values: Record<KpiKey, number>;
}

export function PortalKpiGrid({ values }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {KPIS.map((kpi) => (
        <KpiCard
          key={kpi.key}
          to={kpi.href}
          icon={kpi.icon}
          iconVariant="chip"
          variant={kpi.variant}
          label={kpi.label}
          value={values[kpi.key]}
          className="hover:border-accent/30"
        />
      ))}
    </div>
  );
}
