/**
 * Tarjetas de linaje del CRM:
 *  - LeadLineageCard:        Lead → Oportunidades generadas
 *  - OportunidadLineageCard: Oportunidad → Lead origen + Cotizaciones + Embarques
 * 11.13.0: las queries se mueven a `useLineage` (servicio CRM).
 */
import { ExternalLink, ClipboardList, Ship, Target, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyCompact, formatFechaDia } from "@/lib/formatters";
import { useLeadLineage, useOportunidadLineage } from "@/features/crm/hooks";
import { DrilldownRow } from "@/components/shared/dataTable/DrilldownRow";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";

function Empty({ text }: { text: string }) {
  return <p className="text-body-sm text-muted-foreground">{text}</p>;
}

export function LeadLineageCard({ leadId }: { leadId: string }) {
  const { data = [], isLoading, isError, error, refetch } = useLeadLineage(leadId);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" /> Oportunidades generadas
          <Badge variant="outline" className="ml-auto">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <EmptyStateInline loading message="Cargando…" className="py-2" />}
        {isError && (
          <ErrorStateInline
            message={error instanceof Error ? error.message : "No se pudieron cargar las oportunidades del lead."}
            onRetry={() => void refetch()}
          />
        )}
        {!isLoading && !isError && data.length === 0 && (
          <Empty text="Este lead aún no tiene oportunidades." />
        )}
        {data.map((o) => (
          <DrilldownRow
            key={o.id}
            href={`/crm/oportunidades/${o.id}`}
            ariaLabel={`Ver oportunidad ${o.nombre}`}
            className="flex items-center justify-between gap-2 p-2 rounded border hover:bg-muted/50 transition-colors"
          >
            <div className="min-w-0">
              <div className="text-body font-medium truncate">{o.nombre}</div>
              <div className="text-body-sm text-muted-foreground">
                {formatCurrencyCompact(Number(o.monto_estimado ?? 0), o.moneda)} ·{" "}
                {Number(o.probabilidad ?? 0)}% · cierre {o.fecha_estimada_cierre ?? "—"}
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          </DrilldownRow>
        ))}
      </CardContent>
    </Card>
  );
}

interface OpLineageProps {
  oportunidadId: string;
  leadId: string | null;
}

export function OportunidadLineageCard({ oportunidadId, leadId }: OpLineageProps) {
  const { cots, embs, lead, isLoadingCots, isError, refetch } = useOportunidadLineage(
    oportunidadId,
    leadId,
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-primary" /> Origen y conversiones
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isError && (
          <ErrorStateInline
            message="No se pudo cargar la trazabilidad de esta oportunidad."
            onRetry={() => void refetch()}
          />
        )}
        <div>
          <div className="text-body-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <UserPlus className="h-3 w-3" /> Lead de origen
          </div>
          {isError ? null : leadId && lead ? (
            <DrilldownRow
              href={`/crm/leads/${leadId}`}
              ariaLabel={`Ver lead ${lead.empresa}`}
              className="flex items-center justify-between gap-2 p-2 rounded border hover:bg-muted/50"
            >
              <div className="text-body font-medium truncate">{lead.empresa}</div>
              <Badge variant="outline">{lead.estado}</Badge>
            </DrilldownRow>
          ) : (
            <Empty text="Oportunidad creada directamente (sin lead)." />
          )}
        </div>

        <div>
          <div className="text-body-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <ClipboardList className="h-3 w-3" /> Cotizaciones <Badge variant="outline" className="ml-1">{cots.length}</Badge>
          </div>
          {isLoadingCots && <EmptyStateInline loading message="Cargando…" className="py-2" />}
          {!isLoadingCots && !isError && cots.length === 0 && (
            <Empty text="Aún no hay cotizaciones vinculadas." />
          )}
          <div className="space-y-1">
            {cots.map((c) => (
              <DrilldownRow
                key={c.id}
                href={`/cotizaciones/${c.id}/editar`}
                ariaLabel={`Ver cotización ${c.folio}`}
                className="flex items-center justify-between gap-2 p-2 rounded border hover:bg-muted/50"
              >
                <div className="text-body font-medium truncate">{c.folio}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-body-sm">{c.modo}</Badge>
                  <Badge variant="secondary" className="text-body-sm">{c.estado}</Badge>
                </div>
              </DrilldownRow>
            ))}
          </div>
        </div>

        <div>
          <div className="text-body-sm font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <Ship className="h-3 w-3" /> Embarques <Badge variant="outline" className="ml-1">{embs.length}</Badge>
          </div>
          {!isError && embs.length === 0 && <Empty text="Sin embarques generados todavía." />}
          <div className="space-y-1">
            {embs.map((e) => (
              <DrilldownRow
                key={e.id}
                href={`/embarques/${e.id}`}
                ariaLabel={`Ver embarque ${e.expediente}`}
                className="flex items-center justify-between gap-2 p-2 rounded border hover:bg-muted/50"
              >
                <div className="text-body font-medium truncate">{e.expediente}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-body-sm">{e.modo}</Badge>
                  <Badge variant="secondary" className="text-body-sm">{e.estado}</Badge>
                </div>
              </DrilldownRow>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
