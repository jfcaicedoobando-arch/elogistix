import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ship } from "lucide-react";
import { useTrackingLiveCard } from "@/hooks/embarque";
import { DialogBolContainers } from "./DialogBolContainers";
import { TrackingActions } from "./trackingLive/TrackingActions";
import { TrackingWarnings } from "./trackingLive/TrackingWarnings";
import { TrackingFechasPropuestas } from "./trackingLive/TrackingFechasPropuestas";
import { TrackingSummaryGrid } from "./trackingLive/TrackingSummaryGrid";

interface Props {
  embarqueId: string;
  modo: string | null;
  naviera: string | null;
  contenedor: string | null;
  blMaster?: string | null;
  etd?: string | null;
  eta?: string | null;
  fechaLlegadaReal?: string | null;
  /** Si true, no muestra botón de sincronizar (portal cliente). */
  readOnly?: boolean;
}

export function TrackingLiveCard({ embarqueId, modo, naviera, contenedor, blMaster, etd, eta, fechaLlegadaReal, readOnly }: Props) {
  // Hook se llama siempre arriba para respetar reglas de hooks; el guard de modo viene después.
  const ctrl = useTrackingLiveCard({ embarqueId, naviera, contenedor, etd, eta, fechaLlegadaReal, readOnly });

  if (modo !== "Marítimo") return null;

  const { tracking, bolDialogOpen, setBolDialogOpen } = ctrl;

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Ship className="h-4 w-4 text-accent" />
          Tracking en vivo (JSONCargo)
          {tracking?.status === "ok" && <Badge variant="secondary" className="text-[10px]">Conectado</Badge>}
          {tracking?.status === "failed" && <Badge variant="destructive" className="text-[10px]">Error</Badge>}
        </CardTitle>
        <TrackingActions ctrl={ctrl} blMaster={blMaster} readOnly={readOnly} />
      </CardHeader>
      <CardContent className="space-y-3">
        <TrackingWarnings ctrl={ctrl} naviera={naviera} contenedor={contenedor} blMaster={blMaster} readOnly={readOnly} />
        <TrackingFechasPropuestas ctrl={ctrl} etd={etd} eta={eta} fechaLlegadaReal={fechaLlegadaReal} />
        <TrackingSummaryGrid ctrl={ctrl} />
      </CardContent>
      {!readOnly && (
        <DialogBolContainers
          open={bolDialogOpen}
          onOpenChange={setBolDialogOpen}
          embarqueId={embarqueId}
          blMaster={blMaster ?? null}
          naviera={naviera}
          contenedorActual={contenedor}
        />
      )}
    </Card>
  );
}
