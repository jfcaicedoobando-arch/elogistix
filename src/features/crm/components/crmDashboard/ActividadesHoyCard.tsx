import { Clock } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DrilldownRow } from "@/components/shared/dataTable/DrilldownRow";

interface Actividad {
  id: string;
  tipo: string;
  asunto: string;
  entidad_tipo: string;
  entidad_id: string;
  fecha_programada: string | null;
}

function entidadHref(tipo: string, id: string): string {
  if (tipo === "lead") return `/crm/leads/${id}`;
  if (tipo === "oportunidad") return `/crm/oportunidades/${id}`;
  if (tipo === "cliente") return `/clientes/${id}`;
  return "#";
}

function formatHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  items: Actividad[];
  /** Tercera tanda YAGNI · hallazgo 2: si la lectura falló no se muestra
   *  "Sin actividades"; se comunica el error con reintento. */
  isError?: boolean;
  onRetry?: () => void;
}

export function ActividadesHoyCard({ items, isError = false, onRetry }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Mis actividades de hoy
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isError ? (
          <ErrorStateInline
            message="No se pudieron cargar tus actividades de hoy."
            onRetry={onRetry}
          />
        ) : items.length === 0 ? (
          <EmptyStateInline icon={Clock} message="Sin actividades programadas hoy" />
        ) : (
          <ul className="space-y-1.5">
            {items.map((a) => (
              <DrilldownRow
                key={a.id}
                as="li"
                href={entidadHref(a.entidad_tipo, a.entidad_id)}
                ariaLabel={`Abrir ${a.entidad_tipo} vinculado a ${a.asunto}`}
                className="flex items-center justify-between text-body py-1 border-b last:border-0 hover:bg-muted/40 rounded-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="text-label">{a.tipo}</Badge>
                  <span className="font-medium truncate max-w-[420px]">{a.asunto}</span>
                </div>
                <span className="text-body-sm text-muted-foreground">{formatHora(a.fecha_programada)}</span>
              </DrilldownRow>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
