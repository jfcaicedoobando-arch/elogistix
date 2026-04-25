import { Ship, FileText, Receipt, ArrowRight, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";

type KpiKey = "embarques" | "cotizaciones" | "facturas";

interface KpiDef {
  key: KpiKey;
  label: string;
  icon: LucideIcon;
  href: string;
  color: string;
  bg: string;
}

const KPIS: KpiDef[] = [
  { key: "embarques", label: "Embarques Activos", icon: Ship, href: "/portal/embarques", color: "text-accent", bg: "bg-accent/10" },
  { key: "cotizaciones", label: "Cotizaciones", icon: FileText, href: "/portal/cotizaciones", color: "text-[hsl(var(--state-en-proceso))]", bg: "bg-[hsl(var(--state-en-proceso)/0.1)]" },
  { key: "facturas", label: "Facturas Pendientes", icon: Receipt, href: "/portal/facturas", color: "text-[hsl(var(--warning))]", bg: "bg-[hsl(var(--warning)/0.1)]" },
];

interface Props {
  values: Record<KpiKey, number>;
}

export function PortalKpiGrid({ values }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {KPIS.map((kpi) => (
        <Link key={kpi.key} to={kpi.href}>
          <Card className="hover:shadow-md transition-all hover:border-accent/30 cursor-pointer group">
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-xl p-3 ${kpi.bg} transition-colors`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                <p className="text-2xl font-bold mt-0.5">{values[kpi.key]}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
