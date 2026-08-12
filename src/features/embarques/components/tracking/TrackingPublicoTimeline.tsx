import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import type { TrackingPublicoData } from "@/features/embarques/services/tracking";
import { AvisoAccionable } from "@/components/shared/states/AvisoAccionable";
import { COPY_VACIO } from "@/lib/copy/publicoCopy";
import { TimelineLista } from "./TimelineLista";

type Evento = TrackingPublicoData["eventos"][number];

export function TrackingPublicoTimeline({ eventos }: { eventos: Evento[] }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle>Línea de tiempo</CardTitle></CardHeader>
      <CardContent>
        {eventos.length === 0 ? (
          <AvisoAccionable
            icon={<Clock className="h-5 w-5" />}
            titulo={COPY_VACIO.eventosTracking.titulo}
            descripcion={COPY_VACIO.eventosTracking.descripcion}
            pasos={COPY_VACIO.eventosTracking.pasos}
            className="border-dashed"
          />
        ) : (
          <TimelineLista
            eventos={eventos.map((ev) => ({
              tipo: ev.tipo,
              fecha: ev.fecha,
              descripcion: ev.descripcion,
              ubicacion: ev.ubicacion,
            }))}
          />
        )}
      </CardContent>
    </Card>
  );
}
