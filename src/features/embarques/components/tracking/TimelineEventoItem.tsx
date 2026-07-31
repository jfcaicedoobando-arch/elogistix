import { Clock, MapPin, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { iconoDeEvento } from "./timelineIconos";

export interface TimelineEvento {
  tipo: string;
  fecha: string;
  descripcion?: string | null;
  ubicacion?: string | null;
  /** Sólo se muestra en la vista interna (nunca en el portal del cliente). */
  usuario?: string | null;
}

interface ItemProps {
  evento: TimelineEvento;
  ultimo: boolean;
}

/**
 * Item de la bitácora de eventos de tracking. Compartido por la vista interna
 * y el portal público para que ambas líneas de tiempo se vean idénticas.
 */
export function TimelineEventoItem({ evento, ultimo }: ItemProps) {
  const Icono = iconoDeEvento(evento.tipo);
  return (
    <div className="relative pl-12">
      <div
        className={cn(
          "absolute left-0 top-0 flex items-center justify-center rounded-full border-2 border-background transition-colors",
          ultimo ? "h-8 w-8 bg-accent text-accent-foreground" : "h-8 w-8 bg-muted text-muted-foreground",
        )}
      >
        <Icono className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{evento.tipo}</span>
          {ultimo && <Badge variant="secondary" className="text-2xs">Último</Badge>}
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(evento.fecha, "HH:mm")}
          </span>
        </div>
        {evento.descripcion && <p className="text-sm text-foreground">{evento.descripcion}</p>}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {evento.ubicacion && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {evento.ubicacion}
            </span>
          )}
          {evento.usuario && (
            <span className="flex items-center gap-1" title={evento.usuario}>
              <User className="h-3 w-3" /> {evento.usuario}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
