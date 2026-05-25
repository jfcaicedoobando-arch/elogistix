/**
 * /crm/mi-dia — Vista enfocada en lo que el vendedor debe hacer hoy.
 * Tres secciones colapsables: Hoy, Esta semana, Pipeline (stat strip).
 */
import { Activity, Target, TrendingUp, Users } from "lucide-react";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useCrmInicioVM } from "@/hooks/crm";
import { CrmSubheader } from "@/components/crm/CrmSubheader";
import { ActividadesHoyCard } from "@/components/crm/crmDashboard/ActividadesHoyCard";
import { CerrandoSemanaCard, LeadsSinContactarCard } from "@/components/crm/crmDashboard/DealsCards";
import { NextBestActionsCard } from "@/components/crm/crmDashboard/NextBestActionsCard";
import { CotizacionesSinRespuestaCard } from "@/components/crm/crmDashboard/CotizacionesSinRespuestaCard";

function Stat({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 px-4 h-14 border-r last:border-r-0 flex-1 min-w-0">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground truncate">{label}</div>
        <div className="text-base font-semibold tabular-nums truncate">{value}</div>
      </div>
    </div>
  );
}

const v = (loading: boolean, n: number | undefined): string | number => loading ? "…" : (n ?? 0);

export default function MiDia() {
  const vm = useCrmInicioVM();
  const { isLoading } = vm;
  const hoyTop = vm.nba.slice(0, 3);
  const hoy = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-4 p-6">
      <CrmSubheader context={`Mi día · ${hoy}`} />

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hoy</h2>
        <NextBestActionsCard items={hoyTop} isLoading={vm.nbaLoading} />
        <ActividadesHoyCard items={vm.actividadesHoy} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Esta semana</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CerrandoSemanaCard items={vm.cerrandoSemana} />
          <CotizacionesSinRespuestaCard items={vm.cotsSinResp} />
          <LeadsSinContactarCard items={vm.leadsSinContactar} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pipeline</h2>
        <div className="flex border rounded-md bg-card overflow-hidden">
          <Stat icon={Users} label="Leads" value={v(isLoading, vm.kpis.leads)} />
          <Stat icon={Target} label="Oportunidades" value={v(isLoading, vm.kpis.oportunidadesAbiertas)} />
          <Stat icon={Activity} label="Actividades" value={v(isLoading, vm.kpis.actividadesPendientes)} />
          <Stat icon={TrendingUp} label="Ponderado" value={isLoading ? "…" : formatCurrencyCompact(vm.kpis.pipelinePonderado, "MXN")} />
        </div>
      </section>
    </div>
  );
}
