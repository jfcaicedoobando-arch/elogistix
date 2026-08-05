/**
 * Sección "Mi operación" — visible solo para el rol `operador`.
 * Combina pendientes derivados del dashboard (demoras + arribos inminentes)
 * con dos queries dedicadas: documentos faltantes y embarques sin tracking
 * reciente. Todo filtrado por `operador = user.email`.
 */
import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, FileWarning, Radio } from "lucide-react";
import { toTitleCase } from "@/lib/formatters";
import type { AlertaDemora, ProximoArribo } from "@/features/dashboard/hooks";
import {
  useDocsFaltantesOperador,
  useSinTrackingOperador,
  type DocsFaltantesItem,
  type SinTrackingItem,
} from "@/features/dashboard/hooks";
import { WidgetCard, Row } from "./MiOperacionWidgets";
import { buildPendientes } from "./miOperacionUtils";
import { SectionHeading } from "@/components/shared/SectionHeading";

interface Props {
  alertasDemora: AlertaDemora[];
  proximosArribos: ProximoArribo[];
  isLoading: boolean;
}

const MAX_ITEMS = 5;

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

  const anyLoading = isLoading || loadingDocs || loadingTracking;
  const totalCount = pendientes.length + docs.length + sinTracking.length;
  if (!anyLoading && totalCount === 0) return null;

  return (
    <section className="space-y-3">
      <SectionHeading variant="overline">
        Mi operación
      </SectionHeading>
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
              title={d.expediente ?? "Sin folio"}
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
              badge={t.proximoArribo ? "ETA" : t.diasSinUpdate === null ? "—" : `${t.diasSinUpdate}d`}
              badgeClass={t.proximoArribo ? "bg-warning" : "bg-muted-foreground"}
              title={`${t.expediente}${t.proximoArribo ? " · Próximo a arribar" : ""}`}
              subtitle={`${toTitleCase(t.cliente_nombre)} · ${t.estado}`}
            />
          ))}
        </WidgetCard>
      </div>
    </section>
  );
});
