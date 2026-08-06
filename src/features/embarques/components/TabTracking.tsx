import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Clock, AlertTriangle } from "lucide-react";
import { useEventosEmbarque } from "@/features/embarques/hooks";
import { usePermissions } from "@/hooks/shared";

import { FasesEmbarqueStepper } from "./tracking/FasesEmbarqueStepper";
import { TrackingEventTimeline } from "./tracking/TrackingEventTimeline";
import { TrackingNuevoEventoForm } from "./tracking/TrackingNuevoEventoForm";
import { TrackingNavieraActions } from "./tracking/TrackingNavieraActions";
import { formatDate } from "@/lib/formatters";
import { esEmbarqueArribado, esEtaVencida } from "@/features/embarques/domain/embarqueFases";
import type { Tables } from "@/integrations/supabase/types";


type EmbarqueTrackingProps = Pick<Tables<"embarques">,
  | "modo" | "tipo" | "estado" | "etd" | "eta" | "fecha_llegada_real"
  | "fecha_creacion" | "cotizacion_id" | "updated_at" | "naviera" | "aerolinea"
  | "bl_master" | "mawb" | "expediente" | "puerto_destino" | "aeropuerto_destino"
  | "ciudad_destino">;

interface Props {
  embarqueId: string;
  embarque?: EmbarqueTrackingProps | null;
}

const DAY_MS = 86_400_000;

interface Freshness {
  label: string;
  critical: boolean;
  etaProxima: boolean;
  dias: number;
}

function computeFreshness(
  eventos: Array<{ fecha: string; tipo: string; ubicacion: string | null }>,
  eta: string | null | undefined,
  arribado: boolean,
): Freshness {
  if (eventos.length === 0) {
    return { label: "Sin eventos registrados", critical: !arribado, etaProxima: false, dias: 0 };
  }
  const ultimo = eventos[0];
  const dias = Math.floor((Date.now() - new Date(ultimo.fecha).getTime()) / DAY_MS);
  const ubicacion = ultimo.ubicacion ? ` en ${ultimo.ubicacion}` : "";

  if (arribado) {
    return {
      label: `Arribado — ${ultimo.tipo}${ubicacion}`,
      critical: false,
      etaProxima: false,
      dias,
    };
  }

  const diasParaEta = eta != null ? Math.ceil((new Date(eta).getTime() - Date.now()) / DAY_MS) : null;
  const etaProxima = diasParaEta != null && diasParaEta >= 0 && diasParaEta <= 2;
  const label = dias === 0
    ? `Último evento hoy — ${ultimo.tipo}`
    : `Último evento hace ${dias} día${dias === 1 ? "" : "s"} — ${ultimo.tipo}${ubicacion}`;
  return { label, critical: dias >= 7 || etaProxima, etaProxima, dias };
}

function EtaVencidaBanner({ eta }: { eta: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
      <div className="text-sm">
        <div className="font-medium text-destructive">ETA vencida</div>
        <div className="text-muted-foreground">
          La ETA era {formatDate(eta, "dd/MM/yyyy")}. Consulta la web de la naviera y
          actualiza el estado o la fecha de llegada real.
        </div>
      </div>
    </div>
  );
}

function FreshnessHeader({
  freshness, canEdit, onToggleForm,
}: { freshness: Freshness; canEdit: boolean; onToggleForm: () => void }) {
  const badgeLabel = freshness.etaProxima ? "Actualiza antes del arribo" : "Requiere actualización";
  return (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">{freshness.label}</span>
        {freshness.critical && <Badge variant="warning">{badgeLabel}</Badge>}
      </div>
      {canEdit && (
        <Button size="sm" onClick={onToggleForm}>
          <Plus className="h-4 w-4 mr-1" /> Registrar Evento
        </Button>
      )}
    </div>
  );
}

// eslint-disable-next-line complexity -- Render de alto nivel con múltiples secciones condicionales opcionales; extraer más subcomponentes fragmentaría el layout.
export function TabTracking({ embarqueId, embarque }: Props) {
  const { data: eventos = [], isLoading } = useEventosEmbarque(embarqueId);
  const { canEdit } = usePermissions();
  const [formAbierto, setFormAbierto] = useState(false);

  const arribado = esEmbarqueArribado(embarque);
  const freshness = useMemo(() => computeFreshness(eventos, embarque?.eta, arribado), [eventos, embarque?.eta, arribado]);
  const etaVencida = esEtaVencida(embarque);
  const showEtaBanner = etaVencida && embarque?.eta;

  return (
    <div className="space-y-6">
      {embarque && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Avance del embarque</CardTitle>
          </CardHeader>
          <CardContent>
            <FasesEmbarqueStepper
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
          </CardContent>
        </Card>
      )}


      {embarque && (
        <TrackingNavieraActions
          modo={embarque.modo}
          naviera={embarque.naviera}
          aerolinea={embarque.aerolinea}
          blMaster={embarque.bl_master}
          mawb={embarque.mawb}
        />
      )}

      {showEtaBanner && <EtaVencidaBanner eta={embarque.eta!} />}

      <FreshnessHeader
        freshness={freshness}
        canEdit={canEdit}
        onToggleForm={() => setFormAbierto((v) => !v)}
      />

      {formAbierto && (
        <TrackingNuevoEventoForm
          embarqueId={embarqueId}
          estadoActual={embarque?.estado}
          etaActual={embarque?.eta}
          fechaLlegadaRealActual={embarque?.fecha_llegada_real}
          destinoDefault={
            embarque?.puerto_destino ?? embarque?.aeropuerto_destino ?? embarque?.ciudad_destino ?? ""
          }
          onClose={() => setFormAbierto(false)}
        />
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Línea de tiempo</CardTitle>
        </CardHeader>
        <CardContent>
          <TrackingEventTimeline eventos={eventos} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}

