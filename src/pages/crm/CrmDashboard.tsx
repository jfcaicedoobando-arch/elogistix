/**
 * /crm — Dashboard del módulo CRM.
 * Widgets accionables: KPIs, mis actividades de hoy, oportunidades por cerrar,
 * leads sin contactar, top 5 deals y mini-embudo del pipeline.
 */
import { Link } from "react-router-dom";
import { Activity, Target, TrendingUp, Users, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useCrmDashboardData } from "@/hooks/crm/useCrmDashboard";

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

function entidadHref(tipo: string, id: string): string {
  if (tipo === "lead") return `/crm/leads/${id}`;
  if (tipo === "oportunidad") return `/crm/oportunidades/${id}`;
  if (tipo === "cliente") return `/clientes/${id}`;
  return "#";
}

export default function CrmDashboard() {
  const { data, isLoading } = useCrmDashboardData();
  const d = data;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Dashboard CRM"
        description="Vista rápida de tu día comercial"
        icon={<Target className="h-6 w-6 text-primary" />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Leads" value={isLoading ? "…" : d?.kpis.leads ?? 0} />
        <KpiCard icon={Target} label="Oportunidades abiertas" value={isLoading ? "…" : d?.kpis.oportunidadesAbiertas ?? 0} />
        <KpiCard icon={Activity} label="Actividades pendientes" value={isLoading ? "…" : d?.kpis.actividadesPendientes ?? 0} />
        <KpiCard icon={TrendingUp} label="Pipeline ponderado" value={isLoading ? "…" : formatCurrencyCompact(d?.kpis.pipelinePonderado ?? 0, "MXN")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Mis actividades de hoy
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!d?.misActividadesHoy.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin actividades programadas hoy</p>
            ) : (
              <ul className="space-y-1.5">
                {d.misActividadesHoy.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                    <Link to={entidadHref(a.entidad_tipo, a.entidad_id)} className="flex items-center gap-2 hover:underline">
                      <Badge variant="outline" className="text-[10px]">{a.tipo}</Badge>
                      <span className="font-medium truncate max-w-[260px]">{a.asunto}</span>
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {a.fecha_programada ? new Date(a.fecha_programada).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Cerrando esta semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!d?.cerrandoEstaSemana.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin oportunidades por cerrar</p>
            ) : (
              <ul className="space-y-1.5">
                {d.cerrandoEstaSemana.map((o) => (
                  <li key={o.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                    <Link to={`/crm/oportunidades/${o.id}`} className="flex flex-col hover:underline truncate">
                      <span className="font-medium truncate max-w-[260px]">{o.nombre}</span>
                      <span className="text-xs text-muted-foreground">{o.cliente_nombre || "Sin cliente"}</span>
                    </Link>
                    <div className="text-right">
                      <div className="text-xs tabular-nums font-semibold">{formatCurrencyCompact(o.monto_estimado, o.moneda)}</div>
                      <div className="text-[10px] text-muted-foreground">{o.fecha_estimada_cierre} · {o.probabilidad}%</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Leads sin contactar (&gt; 7 días)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!d?.leadsSinContactar.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Todos los leads nuevos están atendidos</p>
            ) : (
              <ul className="space-y-1.5">
                {d.leadsSinContactar.map((l) => (
                  <li key={l.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                    <Link to={`/crm/leads/${l.id}`} className="flex flex-col hover:underline truncate">
                      <span className="font-medium truncate max-w-[260px]">{l.empresa}</span>
                      <span className="text-xs text-muted-foreground">{l.contacto || "Sin contacto"} · {l.fuente}</span>
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleDateString("es-MX")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Top 5 deals abiertos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!d?.topDeals.length ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin oportunidades abiertas</p>
            ) : (
              <ul className="space-y-1.5">
                {d.topDeals.map((o) => (
                  <li key={o.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                    <Link to={`/crm/oportunidades/${o.id}`} className="flex flex-col hover:underline truncate">
                      <span className="font-medium truncate max-w-[260px]">{o.nombre}</span>
                      <span className="text-xs text-muted-foreground">{o.cliente_nombre || "Sin cliente"}</span>
                    </Link>
                    <div className="text-right">
                      <div className="text-xs tabular-nums font-semibold">{formatCurrencyCompact(o.ponderado, o.moneda)}</div>
                      <div className="text-[10px] text-muted-foreground">{formatCurrencyCompact(o.monto_estimado, o.moneda)} · {o.probabilidad}%</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Mini-embudo (oportunidades abiertas)</CardTitle></CardHeader>
        <CardContent>
          {!d?.embudo.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin etapas configuradas</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {d.embudo.filter((e) => e.tipo === "abierta").map((e) => (
                <Link
                  key={e.etapa_id}
                  to="/crm/oportunidades"
                  className="rounded-md border p-3 hover:bg-muted/40 transition-colors"
                  style={{ borderLeftColor: e.color, borderLeftWidth: 4 }}
                >
                  <div className="text-xs text-muted-foreground truncate">{e.nombre}</div>
                  <div className="text-xl font-bold tabular-nums">{e.count}</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">{formatCurrencyCompact(e.monto, "MXN")}</div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
