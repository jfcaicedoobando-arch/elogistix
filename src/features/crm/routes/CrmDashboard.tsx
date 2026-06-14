/**
 * /crm — Inicio del CRM.
 * Enfoque "lo que tengo que hacer hoy": Next Best Actions arriba,
 * actividades y ops por cerrar al centro, KPIs compactos al final.
 */
import { Activity, Target, TrendingUp, Users } from "lucide-react";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useCrmInicioVM } from "@/features/crm/hooks";
import { ActividadesHoyCard } from "@/features/crm/components/crmDashboard/ActividadesHoyCard";
import { CerrandoSemanaCard, LeadsSinContactarCard } from "@/features/crm/components/crmDashboard/DealsCards";
import { NextBestActionsCard } from "@/features/crm/components/crmDashboard/NextBestActionsCard";
import { CotizacionesSinRespuestaCard } from "@/features/crm/components/crmDashboard/CotizacionesSinRespuestaCard";
import { KpiStrip } from "@/components/shared/KpiStrip";
import { Card } from "@/components/ui/card";

function StatStripItem({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string | number }) {
  return (
    <Card className="flex items-center gap-3 px-4 h-14 rounded-md sm:rounded-none sm:border-0 sm:border-r last:sm:border-r-0 sm:shadow-none">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground truncate">{label}</div>
        <div className="text-base font-semibold tabular-nums truncate">{value}</div>
      </div>
    </Card>
  );
}

const v = (loading: boolean, n: number | undefined): string | number => loading ? "…" : (n ?? 0);

export default function CrmDashboard() {
  const vm = useCrmInicioVM();
  const { isLoading } = vm;

  return (
    <div className="space-y-4 p-6">
      <NextBestActionsCard items={vm.nba} isLoading={vm.nbaLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActividadesHoyCard items={vm.actividadesHoy} />
        <CerrandoSemanaCard items={vm.cerrandoSemana} />
        <CotizacionesSinRespuestaCard items={vm.cotsSinResp} />
        <LeadsSinContactarCard items={vm.leadsSinContactar} />
      </div>

      <div className="flex border rounded-md bg-card overflow-hidden">
        <StatStripItem icon={Users} label="Leads" value={v(isLoading, vm.kpis.leads)} />
        <StatStripItem icon={Target} label="Oportunidades abiertas" value={v(isLoading, vm.kpis.oportunidadesAbiertas)} />
        <StatStripItem icon={Activity} label="Actividades pendientes" value={v(isLoading, vm.kpis.actividadesPendientes)} />
        <StatStripItem icon={TrendingUp} label="Pipeline ponderado" value={isLoading ? "…" : formatCurrencyCompact(vm.kpis.pipelinePonderado, "MXN")} />
      </div>
    </div>
  );
}
