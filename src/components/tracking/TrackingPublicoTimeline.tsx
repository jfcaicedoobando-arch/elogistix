import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, MapPin } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { ICONO_EVENTO } from "@/constants/embarqueConstants";
import type { TrackingPublicoData } from "@/services/tracking";

type Evento = TrackingPublicoData["eventos"][number];

function EventoItem({ ev, primero }: { ev: Evento; primero: boolean }) {
  const dotClass = primero ? "bg-accent" : "bg-muted-foreground/40";
  const icono = ICONO_EVENTO[ev.tipo] ?? "📝";
  return (
    <div className="relative pl-10">
      <div className={`absolute left-2.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-background ${dotClass}`} />
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-base">{icono}</span>
          <Badge variant="secondary" className="text-xs">{ev.tipo}</Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDate(ev.fecha, "dd MMM yyyy, HH:mm")}
          </span>
        </div>
        {ev.descripcion ? <p className="text-sm text-foreground">{ev.descripcion}</p> : null}
        {ev.ubicacion ? (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {ev.ubicacion}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function TrackingPublicoTimeline({ eventos }: { eventos: Evento[] }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm">Línea de Tiempo</CardTitle></CardHeader>
      <CardContent>
        {eventos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No hay eventos registrados aún.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
            <div className="space-y-6">
              {eventos.map((ev, i) => (
                <EventoItem key={i} ev={ev} primero={i === 0} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
