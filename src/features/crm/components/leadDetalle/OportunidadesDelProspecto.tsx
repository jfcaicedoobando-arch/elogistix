/**
 * Tarjeta con las oportunidades de un prospecto (Fase 2 rediseño CRM).
 * Muestra los negocios en el aire del prospecto y permite abrir cada uno.
 */
import { Link } from "react-router-dom";
import { Briefcase, Plus } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOportunidadesPorLead } from "@/features/crm/hooks";
import { formatCurrencyCompact } from "@/lib/formatters";
import { formatFechaEs } from "@/lib/formatters/dates";

interface Props {
  leadId: string;
  canEdit: boolean;
  onNuevaOportunidad: () => void;
}

export default function OportunidadesDelProspecto({ leadId, canEdit, onNuevaOportunidad }: Props) {
  const { data: oportunidades = [], isLoading } = useOportunidadesPorLead(leadId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-accent" />
          Oportunidades del prospecto
          <Badge variant="outline">{oportunidades.length}</Badge>
        </CardTitle>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={onNuevaOportunidad}>
            <Plus className="h-4 w-4 mr-1" /> Nueva oportunidad
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <EmptyStateInline loading message="Cargando oportunidades…" density="compact" />
        ) : oportunidades.length === 0 ? (
          <EmptyStateInline
            icon={Briefcase}
            message="Aún no hay oportunidades para este prospecto."
            hint="Crea una para llevar el negocio al pipeline."
            density="compact"
          />
        ) : (
          <ul className="divide-y divide-border">
            {oportunidades.map((o) => (
              <li key={o.id} className="py-2">
                <Link
                  to={`/crm/oportunidades/${o.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 hover:underline"
                >
                  <span className="font-medium truncate">{o.nombre}</span>
                  <span className="flex items-center gap-2 text-body-sm text-muted-foreground">
                    {o.etapa_nombre ? <Badge variant="outline">{o.etapa_nombre}</Badge> : null}
                    <span>
                      {formatCurrencyCompact(Number(o.monto_estimado ?? 0), o.moneda ?? "MXN")}
                    </span>
                    <span>
                      {o.fecha_estimada_cierre ? formatFechaEs(o.fecha_estimada_cierre) : "sin fecha"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
