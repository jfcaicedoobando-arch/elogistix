import { Clock } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { nombreDesdeEmail } from "@/lib/formatters";
import type { EventoEmbarque } from "@/features/embarques/hooks";
import { TimelineLista } from "./TimelineLista";

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
    <TimelineLista
      eventos={eventos.map((ev) => ({
        tipo: ev.tipo,
        fecha: ev.fecha,
        descripcion: ev.descripcion,
        ubicacion: ev.ubicacion,
        usuario: ev.usuario ? nombreDesdeEmail(ev.usuario) : null,
      }))}
    />
  );
}
