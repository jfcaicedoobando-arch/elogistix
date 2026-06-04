import { Clock, MapPin, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { ICONO_EVENTO } from "@/constants/embarqueConstants";
import { formatDate, nombreDesdeEmail } from "@/lib/formatters";
import type { EventoEmbarque } from "@/hooks/embarque";

interface Props {
  eventos: EventoEmbarque[];
  isLoading: boolean;
}

export function TrackingEventTimeline({ eventos, isLoading }: Props) {
  if (isLoading) return <EmptyStateInline loading message="Cargando eventos..." />;
  if (eventos.length === 0) {
    return <EmptyStateInline icon={Clock} message="No hay eventos de tracking registrados." />;
  }
  return (
    <div className="relative">
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
      <div className="space-y-6">
        {eventos.map((ev, i) => (
          <div key={ev.id} className="relative pl-10">
            <div
              className={`absolute left-2.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-background ${
                i === 0 ? "bg-accent" : "bg-muted-foreground/40"
              }`}
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base">{ICONO_EVENTO[ev.tipo] ?? "📝"}</span>
                <Badge variant="secondary" className="text-xs">{ev.tipo}</Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(ev.fecha, "dd MMM yyyy, HH:mm")}
                </span>
              </div>
              {ev.descripcion && (
                <p className="text-sm text-foreground">{ev.descripcion}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {ev.ubicacion && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {ev.ubicacion}
                  </span>
                )}
                {ev.usuario && (
                  <span className="flex items-center gap-1" title={ev.usuario}>
                    <User className="h-3 w-3" /> {nombreDesdeEmail(ev.usuario)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
