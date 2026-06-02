/**
 * Sección "Mi operación" — visible solo para el rol `operador`.
 * Combina pendientes derivados del dashboard (demoras + arribos inminentes)
 * con dos queries dedicadas: documentos faltantes y embarques sin tracking
 * reciente. Todo filtrado por `operador = user.email`.
 */
import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, FileWarning, Radio, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toTitleCase } from "@/lib/formatters";
import type { AlertaDemora, ProximoArribo } from "@/hooks/dashboard";
import {
  useDocsFaltantesOperador,
  useSinTrackingOperador,
  type DocsFaltantesItem,
  type SinTrackingItem,
} from "@/hooks/dashboard/useDashboardOperador";

interface Pendiente {
  id: string;
  expediente: string;
  cliente_nombre: string;
  motivo: string;
  badge: string;
}

interface Props {
  alertasDemora: AlertaDemora[];
  proximosArribos: ProximoArribo[];
  isLoading: boolean;
}

const MAX_ITEMS = 5;

function buildPendientes(alertas: AlertaDemora[], arribos: ProximoArribo[]): Pendiente[] {
  const out: Pendiente[] = [];
  for (const a of alertas) {
    out.push({
      id: a.id,
      expediente: a.expediente,
      cliente_nombre: a.cliente_nombre,
      motivo: "Demora — confirmar arribo",
      badge: `${a.diasDemora}d`,
    });
  }
  for (const a of arribos) {
    if (a.diasRestantes > 1) continue;
    if (out.some((p) => p.id === a.id)) continue;
    out.push({
      id: a.id,
      expediente: a.expediente,
      cliente_nombre: a.cliente_nombre,
      motivo: a.diasRestantes <= 0 ? "Arribo hoy" : "Arribo mañana",
      badge: "ETA",
    });
  }
  return out;
}

interface WidgetProps {
  icon: typeof AlertCircle;
  title: string;
  count: number;
  empty: string;
  isLoading: boolean;
  iconClass: string;
  children: React.ReactNode;
}

function WidgetCard({ icon: Icon, title, count, empty, isLoading, iconClass, children }: WidgetProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconClass}`} />
          {title}
          {!isLoading && count > 0 && (
            <Badge variant="secondary" className="ml-auto text-[10px]">{count}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 max-h-[260px] overflow-y-auto">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
        ) : count === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{empty}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function Row({ onClick, badge, badgeClass, title, subtitle }: {
  onClick: () => void;
  badge: string;
  badgeClass: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border p-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
    >
      <div className={`shrink-0 min-w-[2.25rem] h-8 px-2 rounded-md flex items-center justify-center text-[11px] font-bold text-white ${badgeClass}`}>
        {badge}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}

export const MiOperacionSection = memo(function MiOperacionSection({
  alertasDemora,
  proximosArribos,
  isLoading,
}: Props) {
  const navigate = useNavigate();
  const { data: docs = [] as DocsFaltantesItem[], isLoading: loadingDocs } = useDocsFaltantesOperador();
  const { data: sinTracking = [] as SinTrackingItem[], isLoading: loadingTracking } = useSinTrackingOperador();

  const pendientes = buildPendientes(alertasDemora, proximosArribos).slice(0, MAX_ITEMS);
  const docsTop: DocsFaltantesItem[] = docs.slice(0, MAX_ITEMS);
  const trackingTop: SinTrackingItem[] = sinTracking.slice(0, MAX_ITEMS);

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Mi operación
      </h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <WidgetCard
          icon={AlertCircle}
          title="Mis pendientes hoy"
          count={pendientes.length}
          empty="Sin pendientes hoy"
          isLoading={isLoading}
          iconClass="text-warning"
        >
          {pendientes.map((p) => (
            <Row
              key={p.id}
              onClick={() => navigate(`/embarques/${p.id}`)}
              badge={p.badge}
              badgeClass={p.badge === "ETA" ? "bg-primary" : "bg-warning"}
              title={`${p.expediente} · ${p.motivo}`}
              subtitle={toTitleCase(p.cliente_nombre)}
            />
          ))}
        </WidgetCard>

        <WidgetCard
          icon={FileWarning}
          title="Docs faltantes"
          count={docs.length}
          empty="Sin documentación pendiente"
          isLoading={loadingDocs}
          iconClass="text-destructive"
        >
          {docsTop.map((d) => (
            <Row
              key={d.id}
              onClick={() => navigate(`/embarques/${d.id}`)}
              badge={`${d.pendientes}`}
              badgeClass="bg-destructive"
              title={d.expediente}
              subtitle={toTitleCase(d.cliente_nombre)}
            />
          ))}
        </WidgetCard>

        <WidgetCard
          icon={Radio}
          title="Sin tracking reciente"
          count={sinTracking.length}
          empty="Tracking al día"
          isLoading={loadingTracking}
          iconClass="text-info"
        >
          {trackingTop.map((t) => (
            <Row
              key={t.id}
              onClick={() => navigate(`/embarques/${t.id}`)}
              badge={t.diasSinUpdate === null ? "—" : `${t.diasSinUpdate}d`}
              badgeClass="bg-muted-foreground"
              title={t.expediente}
              subtitle={`${toTitleCase(t.cliente_nombre)} · ${t.estado}`}
            />
          ))}
        </WidgetCard>
      </div>
    </section>
  );
});
