/**
 * Tarjetas de linaje del CRM:
 *  - LeadLineageCard:        Lead → Oportunidades generadas
 *  - OportunidadLineageCard: Oportunidad → Lead origen + Cotizaciones + Embarques
 * 11.13.0: las queries se mueven a `useLineage` (servicio CRM).
 */
import { ExternalLink, FileText, Ship, Target, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useLeadLineage, useOportunidadLineage } from "@/features/crm/hooks";
import { DrilldownRow } from "@/components/shared/dataTable/DrilldownRow";

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

export function LeadLineageCard({ leadId }: { leadId: string }) {
  const { data = [], isLoading } = useLeadLineage(leadId);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" /> Oportunidades generadas
          <Badge variant="outline" className="ml-auto">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-xs text-muted-foreground">Cargando…</p>}
        {!isLoading && data.length === 0 && <Empty text="Este lead aún no tiene oportunidades." />}
        {data.map((o) => (
          <DrilldownRow
            key={o.id}
            href={`/crm/oportunidades/${o.id}`}
            ariaLabel={`Ver oportunidad ${o.nombre}`}
            className="flex items-center justify-between gap-2 p-2 rounded border hover:bg-muted/50 transition-colors"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{o.nombre}</div>
              <div className="text-xs text-muted-foreground">
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
  const { cots, embs, lead, isLoadingCots } = useOportunidadLineage(oportunidadId, leadId);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ExternalLink className="h-4 w-4 text-primary" /> Origen y conversiones
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <UserPlus className="h-3 w-3" /> Lead de origen
          </div>
          {leadId && lead ? (
            <Link to={`/crm/leads/${leadId}`} className="flex items-center justify-between gap-2 p-2 rounded border hover:bg-muted/50">
              <div className="text-sm font-medium truncate">{lead.empresa}</div>
              <Badge variant="outline">{lead.estado}</Badge>
            </Link>
          ) : (
            <Empty text="Oportunidad creada directamente (sin lead)." />
          )}
        </div>

        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <FileText className="h-3 w-3" /> Cotizaciones <Badge variant="outline" className="ml-1">{cots.length}</Badge>
          </div>
          {isLoadingCots && <p className="text-xs text-muted-foreground">Cargando…</p>}
          {!isLoadingCots && cots.length === 0 && <Empty text="Aún no hay cotizaciones vinculadas." />}
          <div className="space-y-1">
            {cots.map((c) => (
              <Link key={c.id} to={`/cotizaciones/${c.id}/editar`} className="flex items-center justify-between gap-2 p-2 rounded border hover:bg-muted/50">
                <div className="text-sm font-medium truncate">{c.folio}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{c.modo}</Badge>
                  <Badge variant="secondary" className="text-xs">{c.estado}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
            <Ship className="h-3 w-3" /> Embarques <Badge variant="outline" className="ml-1">{embs.length}</Badge>
          </div>
          {embs.length === 0 && <Empty text="Sin embarques generados todavía." />}
          <div className="space-y-1">
            {embs.map((e) => (
              <Link key={e.id} to={`/embarques/${e.id}`} className="flex items-center justify-between gap-2 p-2 rounded border hover:bg-muted/50">
                <div className="text-sm font-medium truncate">{e.expediente}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{e.modo}</Badge>
                  <Badge variant="secondary" className="text-xs">{e.estado}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
