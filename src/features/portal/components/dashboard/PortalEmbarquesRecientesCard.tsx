import { Ship, ArrowRight, Clock } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ROUTES } from "@/constants/routes";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { calcularEstadoEmbarque } from "@/features/embarques/domain/embarque";
import { labelExpediente } from "@/lib/domain/labelExpediente";
import { formatDate, getOrigen, getDestino } from "@/lib/formatters";
import { useDrilldownRow } from "@/components/shared/dataTable/useDrilldownRow";
import { cn } from "@/lib/utils";

interface EmbarqueItem {
  id: string;
  expediente: string | null;
  modo: string;
  tipo?: string | null;
  etd?: string | null;
  eta?: string | null;
  estado?: string | null;
  puerto_origen?: string | null;
  aeropuerto_origen?: string | null;
  ciudad_origen?: string | null;
  puerto_destino?: string | null;
  aeropuerto_destino?: string | null;
  ciudad_destino?: string | null;
}

interface Props {
  embarques: EmbarqueItem[];
  className?: string;
}

export function PortalEmbarquesRecientesCard({ embarques, className }: Props) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Ship className="h-4 w-4 text-accent" />
            Embarques Recientes
          </CardTitle>
          <Link to={ROUTES.PORTAL_EMBARQUES}>
            <Button variant="ghost" size="sm" className="text-xs h-7">
              Ver todos <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {embarques.length === 0 ? (
          <EmptyStateInline icon={Ship} message="No hay embarques activos." />
        ) : (
          <div className="space-y-2">
            {embarques.slice(0, 5).map((e) => {
              const estadoVisual = calcularEstadoEmbarque(e.modo, e.tipo ?? "", e.etd ?? null, e.eta ?? null, e.estado ?? "");
              return (
                <EmbarqueRecienteRow key={e.id} e={e} estadoVisual={estadoVisual} />
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmbarqueRecienteRow({ e, estadoVisual }: { e: EmbarqueItem; estadoVisual: string }) {
  const nav = useDrilldownRow({
    href: `/portal/embarques/${e.id}`,
    ariaLabel: `Ver embarque ${labelExpediente(e.expediente, e.id)}`,
  });
  return (
    <div
      {...nav}
      className={cn(nav.className, "flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors group")}
    >
      <div className="flex items-center gap-3 min-w-0">
        <ModoIcon modo={e.modo} size={16} circle className="flex-shrink-0" />
        <div className="min-w-0">
          <p className="font-medium text-sm">{labelExpediente(e.expediente, e.id)}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">
              {getOrigen(e)} → {getDestino(e)}
            </span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        {e.eta && (
          <span className="text-2xs text-muted-foreground hidden sm:block">
            ETA {formatDate(e.eta, "dd/MM")}
          </span>
        )}
        <Badge className={getEstadoColor(estadoVisual)}>{estadoVisual}</Badge>
      </div>
    </div>
  );
}
