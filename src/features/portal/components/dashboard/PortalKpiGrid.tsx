import { Ship, FileText, Receipt, ArrowRight, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";

type KpiKey = "embarques" | "cotizaciones" | "facturas";

interface KpiDef {
  key: KpiKey;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  href: string;
  color: string;
  bg: string;
}

const KPIS: KpiDef[] = [
  { key: "embarques", label: "Embarques Activos", shortLabel: "Embarques", icon: Ship, href: "/portal/embarques", color: "text-accent", bg: "bg-accent/10" },
  { key: "cotizaciones", label: "Cotizaciones Pendientes", shortLabel: "Cotizaciones", icon: FileText, href: "/portal/cotizaciones", color: "text-[hsl(var(--state-en-proceso))]", bg: "bg-[hsl(var(--state-en-proceso)/0.1)]" },
  { key: "facturas", label: "Facturas Pendientes", shortLabel: "Facturas", icon: Receipt, href: "/portal/facturas", color: "text-[hsl(var(--warning))]", bg: "bg-[hsl(var(--warning)/0.1)]" },
];

interface Props {
  values: Record<KpiKey, number>;
}

export function PortalKpiGrid({ values }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {KPIS.map((kpi) => (
        <Link key={kpi.key} to={kpi.href}>
          {/* Mobile: compact card. Desktop: full card with icon + label + arrow. */}
          <Card className="hover:shadow-raised transition-all hover:border-accent/30 cursor-pointer group h-full">
            <CardContent className="flex flex-col sm:flex-row items-center sm:gap-4 gap-1 p-3 sm:p-5 text-center sm:text-left">
              <div className={`rounded-xl p-2 sm:p-3 ${kpi.bg} transition-colors`}>
                <kpi.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${kpi.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium leading-tight">
                  <span className="sm:hidden">{kpi.shortLabel}</span>
                  <span className="hidden sm:inline">{kpi.label}</span>
                </p>
                <p className="text-xl sm:text-2xl font-bold mt-0.5 tabular-nums">{values[kpi.key]}</p>
              </div>
              <ArrowRight className="hidden sm:block h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
