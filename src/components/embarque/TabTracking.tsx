import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useEventosEmbarque } from "@/hooks/embarque/useEventosEmbarque";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { TrackingLiveCard } from "./TrackingLiveCard";
import { TrackingFasesTimeline } from "./TrackingFasesTimeline";
import { TabNotas } from "./TabNotas";
import { TrackingEventTimeline } from "./tracking/TrackingEventTimeline";
import { TrackingNuevoEventoForm } from "./tracking/TrackingNuevoEventoForm";
import type { Tables } from "@/integrations/supabase/types";
import type { NotaEmbarqueRow } from "@/hooks/embarque/useEmbarques";

type EmbarqueTrackingProps = Pick<
  Tables<"embarques">,
  "modo" | "tipo" | "estado" | "naviera" | "contenedor" | "bl_master" | "etd" | "eta" | "fecha_llegada_real" | "fecha_creacion" | "cotizacion_id" | "updated_at"
>;

interface Props {
  embarqueId: string;
  embarque?: EmbarqueTrackingProps | null;
  notas?: NotaEmbarqueRow[];
}

export function TabTracking({ embarqueId, embarque, notas = [] }: Props) {
  const { data: eventos = [], isLoading } = useEventosEmbarque(embarqueId);
  const { canEdit } = usePermissions();
  const [formAbierto, setFormAbierto] = useState(false);

  return (
    <div className="space-y-6">
      {embarque && (
        <TrackingFasesTimeline
          embarque={{
            modo: embarque.modo,
            tipo: embarque.tipo,
            estado: embarque.estado,
            etd: embarque.etd,
            eta: embarque.eta,
            fecha_creacion: embarque.fecha_creacion,
            fecha_llegada_real: embarque.fecha_llegada_real,
            cotizacion_id: embarque.cotizacion_id,
            updated_at: embarque.updated_at,
          }}
        />
      )}
      {embarque && (
        <TrackingLiveCard
          embarqueId={embarqueId}
          modo={embarque.modo}
          naviera={embarque.naviera}
          contenedor={embarque.contenedor}
          blMaster={embarque.bl_master}
          etd={embarque.etd}
          eta={embarque.eta}
          fechaLlegadaReal={embarque.fecha_llegada_real}
        />
      )}
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setFormAbierto(!formAbierto)}>
            <Plus className="h-4 w-4 mr-1" /> Registrar Evento
          </Button>
        </div>
      )}

      {formAbierto && (
        <TrackingNuevoEventoForm embarqueId={embarqueId} onClose={() => setFormAbierto(false)} />
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Línea de Tiempo</CardTitle>
        </CardHeader>
        <CardContent>
          <TrackingEventTimeline eventos={eventos} isLoading={isLoading} />
        </CardContent>
      </Card>

      <TabNotas notas={notas} embarqueId={embarqueId} />
    </div>
  );
}
