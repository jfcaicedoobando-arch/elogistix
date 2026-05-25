/**
 * /crm — Inicio del CRM.
 * Enfoque "lo que tengo que hacer hoy": actividades de hoy y vencidas arriba,
 * ops por cerrar y leads sin contactar al centro, KPIs al final.
 */
import { Activity, Target, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useCrmInicioVM } from "@/hooks/crm/useCrmInicioVM";
import { VencidasAlert } from "@/components/crm/crmDashboard/VencidasAlert";
import { ActividadesHoyCard } from "@/components/crm/crmDashboard/ActividadesHoyCard";
import { CerrandoSemanaCard, LeadsSinContactarCard, TopDealsCard } from "@/components/crm/crmDashboard/DealsCards";

function KpiCard({ icon: Icon, label, value }: { icon: typeof Target; label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function kpiVal(loading: boolean, val: number | undefined): string | number {
  if (loading) return "…";
  return val ?? 0;
}

export default function CrmDashboard() {
  const vm = useCrmInicioVM();
  const { isLoading } = vm;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Inicio"
        description="Tu día comercial — qué hacer hoy, qué cerrar esta semana"
        icon={<Target className="h-6 w-6 text-primary" />}
      />

      <VencidasAlert vencidas={vm.vencidas} />
      <ActividadesHoyCard items={vm.actividadesHoy} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CerrandoSemanaCard items={vm.cerrandoSemana} />
        <LeadsSinContactarCard items={vm.leadsSinContactar} />
        <TopDealsCard items={vm.topDeals} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Leads" value={kpiVal(isLoading, vm.kpis.leads)} />
        <KpiCard icon={Target} label="Oportunidades abiertas" value={kpiVal(isLoading, vm.kpis.oportunidadesAbiertas)} />
        <KpiCard icon={Activity} label="Actividades pendientes" value={kpiVal(isLoading, vm.kpis.actividadesPendientes)} />
        <KpiCard
          icon={TrendingUp}
          label="Pipeline ponderado"
          value={isLoading ? "…" : formatCurrencyCompact(vm.kpis.pipelinePonderado, "MXN")}
        />
      </div>
    </div>
  );
}
