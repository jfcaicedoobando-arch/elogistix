/**
 * /crm — Dashboard del módulo CRM (Fase 1: placeholder con KPIs base).
 * Las vistas detalladas (Leads, Oportunidades, Actividades, Forecast, Reportes)
 * se implementan en fases posteriores.
 */
import { useQuery } from "@tanstack/react-query";
import { Target, Users, Activity, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";

interface CrmKpis {
  leads: number;
  oportunidadesAbiertas: number;
  actividadesPendientes: number;
  pipelineMonto: number;
}

function useCrmKpis() {
  const { organizationId } = useOrgFilter();
  return useQuery<CrmKpis>({
    queryKey: ["crm", "kpis", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const [leads, ops, acts] = await Promise.all([
        supabase.from("crm_leads").select("id", { count: "exact", head: true }),
        supabase
          .from("crm_oportunidades")
          .select("monto_estimado, probabilidad, etapa_id, crm_etapas_pipeline!inner(tipo)")
          .eq("crm_etapas_pipeline.tipo", "abierta"),
        supabase
          .from("crm_actividades")
          .select("id", { count: "exact", head: true })
          .is("fecha_completada", null),
      ]);
      const opsData = (ops.data ?? []) as Array<{ monto_estimado: number; probabilidad: number }>;
      const pipeline = opsData.reduce(
        (sum, o) => sum + Number(o.monto_estimado ?? 0) * (Number(o.probabilidad ?? 0) / 100),
        0,
      );
      return {
        leads: leads.count ?? 0,
        oportunidadesAbiertas: opsData.length,
        actividadesPendientes: acts.count ?? 0,
        pipelineMonto: pipeline,
      };
    },
  });
}

const fmtMxn = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

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

export default function CrmDashboard() {
  const { data, isLoading } = useCrmKpis();
  const k = data ?? { leads: 0, oportunidadesAbiertas: 0, actividadesPendientes: 0, pipelineMonto: 0 };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="CRM"
        description="Gestión de leads, oportunidades, actividades y forecast comercial"
        icon={<Target className="h-6 w-6 text-primary" />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Leads" value={isLoading ? "…" : k.leads} />
        <KpiCard icon={Target} label="Oportunidades abiertas" value={isLoading ? "…" : k.oportunidadesAbiertas} />
        <KpiCard icon={Activity} label="Actividades pendientes" value={isLoading ? "…" : k.actividadesPendientes} />
        <KpiCard icon={TrendingUp} label="Pipeline ponderado" value={isLoading ? "…" : fmtMxn(k.pipelineMonto)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximas fases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Fase 1 (actual): fundación — base de datos, rol vendedor, sidebar y dashboard.</p>
          <p>Fase 2: Leads — CRUD, lista, conversión a cliente + oportunidad.</p>
          <p>Fase 3: Oportunidades — Kanban con drag &amp; drop, conversión a cotización.</p>
          <p>Fase 4: Actividades — calendario y timeline polimórfica.</p>
          <p>Fase 5: Forecast y Reportes — embudo, ranking de vendedores, motivos de pérdida.</p>
          <p>Fase 6: refinamiento del rol vendedor y dashboard personal.</p>
        </CardContent>
      </Card>
    </div>
  );
}
