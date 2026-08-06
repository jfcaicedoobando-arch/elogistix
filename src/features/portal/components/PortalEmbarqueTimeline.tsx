import {
  Clock, MapPin, Ship, Repeat, Anchor, PackageOpen, ShieldCheck, CheckCircle2,
  Truck, Flag, AlertTriangle, Search, FileText, type LucideIcon,
} from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/formatters";
import { filtrarEventosVisiblesCliente } from "@/features/portal/domain/eventosVisiblesCliente";
import type { Tables } from "@/types/db";

// v13.301.90 (Fase Q.1): portal no expone `deleted_at`/`deleted_by`.
interface Props {
  eventos: Omit<Tables<"eventos_embarque">, "deleted_at" | "deleted_by">[];
}

const ICONO_EVENTO_LUCIDE: Record<string, LucideIcon> = {
  Zarpe: Ship,
  Transbordo: Repeat,
  "Arribo a Puerto": Anchor,
  Descarga: PackageOpen,
  "Despacho Aduanal": ShieldCheck,
  Liberación: CheckCircle2,
  "En Ruta Terrestre": Truck,
  Entrega: Flag,
  Demora: AlertTriangle,
  Inspección: Search,
  Otro: FileText,
};

export function PortalEmbarqueTimeline({ eventos: eventosCrudos }: Props) {
  // P2-6.4: el cliente sólo ve hitos de negocio, nunca eventos internos.
  const eventos = filtrarEventosVisiblesCliente(eventosCrudos);
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle >Línea de Tiempo</CardTitle></CardHeader>
      <CardContent>
        {eventos.length === 0 ? (
          <EmptyStateInline icon={Clock} message="No hay eventos registrados aún." className="py-12" />
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
            <div className="space-y-6">
              {eventos.map((ev, i) => {
                const EventIcon = ICONO_EVENTO_LUCIDE[ev.tipo] ?? FileText;
                return (
                  <div key={ev.id} className="relative pl-10">
                    <div className={`absolute left-2.5 top-1 h-3.5 w-3.5 rounded-full border-2 border-background transition-colors ${
                      i === 0 ? "bg-accent ring-4 ring-accent/20" : "bg-muted-foreground/40"
                    }`} />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <EventIcon className="h-4 w-4 text-accent" aria-hidden />
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
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
