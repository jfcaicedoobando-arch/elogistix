import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrackingPublicoData } from "@/features/embarques/services/tracking";
import { TimelineLista } from "./TimelineLista";

type Evento = TrackingPublicoData["eventos"][number];

export function TrackingPublicoTimeline({ eventos }: { eventos: Evento[] }) {
  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm">Línea de tiempo</CardTitle></CardHeader>
      <CardContent>
        {eventos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No hay eventos registrados aún.</p>
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
