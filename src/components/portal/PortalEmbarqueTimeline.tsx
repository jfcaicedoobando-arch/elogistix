import { Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/formatters";
import type { Tables } from "@/integrations/supabase/types";

const ICONO_EVENTO: Record<string, string> = {
  Zarpe: "🚢", Transbordo: "🔄", "Arribo a Puerto": "⚓", Descarga: "📦",
  "Despacho Aduanal": "🛃", Liberación: "✅", "En Ruta Terrestre": "🚛",
  Entrega: "🏁", Demora: "⚠️", Inspección: "🔍", Otro: "📝",
};

interface Props {
  eventos: Tables<"eventos_embarque">[];
}

export function PortalEmbarqueTimeline({ eventos }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm">Línea de Tiempo</CardTitle></CardHeader>
      <CardContent>
        {eventos.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No hay eventos registrados aún.</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
            <div className="space-y-6">
              {eventos.map((ev, i) => (
                <div key={ev.id} className="relative pl-10">
                  <div className={`absolute left-2.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-background transition-colors ${
                    i === 0 ? "bg-accent ring-4 ring-accent/20" : "bg-muted-foreground/40"
                  }`} />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base">{ICONO_EVENTO[ev.tipo] ?? "📝"}</span>
                      <Badge variant="secondary" className="text-xs">{ev.tipo}</Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(ev.fecha, "dd MMM yyyy, HH:mm")}
                      </span>
                    </div>
                    {ev.descripcion && <p className="text-sm text-foreground">{ev.descripcion}</p>}
                    {ev.ubicacion && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {ev.ubicacion}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
