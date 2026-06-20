import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toTitleCase } from "@/lib/formatters";
import { ESTADOS_EMBARQUE } from "@/features/embarques/constants/embarqueConstants";
import { calcularEstadoEmbarque } from "@/features/embarques/domain/embarque";
import { useEmbarquesRelacionados } from "@/features/embarques/hooks";
import { useFocusSection } from "@/features/embarques/hooks/useFocusSection";
import type { EmbarqueRow } from "@/features/embarques/hooks";
import { EstadoProgresoCard } from "./tabResumen/EstadoProgresoCard";
import { DatosGeneralesCard, RutaTransporteCard } from "./tabResumen/ResumenCards";
import { EmbarquesRelacionadosCard } from "./tabResumen/EmbarquesRelacionadosCard";
import { OrigenCostosSection } from "./OrigenCostosSection";
import { SeccionContenedoresReadonly } from "./contenedores/SeccionContenedoresReadonly";

interface Props {
  embarque: EmbarqueRow;
}

export function TabResumen({ embarque }: Props) {
  const estadoVisual = calcularEstadoEmbarque(embarque.modo, embarque.tipo, embarque.etd, embarque.eta, embarque.estado);
  const currentStepIndex = ESTADOS_EMBARQUE.indexOf(estadoVisual as typeof ESTADOS_EMBARQUE[number]);
  const { data: relacionados = [] } = useEmbarquesRelacionados(embarque.id, embarque.bl_master);

  return (
    <div className="space-y-6">
      <EstadoProgresoCard currentStepIndex={currentStepIndex} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-fr">
        <DatosGeneralesCard embarque={embarque} />
        <RutaTransporteCard embarque={embarque} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-fr">
        <Card className="h-full">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Shipper</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{toTitleCase(embarque.shipper)}</CardContent>
        </Card>
        <Card className="h-full">
          <CardHeader className="pb-3"><CardTitle className="text-sm">Consignatario</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">{toTitleCase(embarque.consignatario)}</CardContent>
        </Card>
      </div>

      {embarque.modo === "Marítimo" && <SeccionContenedoresReadonly embarqueId={embarque.id} />}

      <OrigenCostosSection
        tarifaIdOriginal={(embarque as { tarifa_id_original?: string | null }).tarifa_id_original}
        tarifaIdAplicada={(embarque as { tarifa_id_aplicada?: string | null }).tarifa_id_aplicada}
        decision={(embarque as { tarifa_decision?: string | null }).tarifa_decision}
        deltaJsonb={(embarque as { tarifa_delta_jsonb?: unknown }).tarifa_delta_jsonb}
        revalidadaEn={(embarque as { tarifa_revalidada_en?: string | null }).tarifa_revalidada_en}
      />

      {relacionados.length > 1 && (
        <EmbarquesRelacionadosCard
          embarqueId={embarque.id}
          blMaster={embarque.bl_master}
          relacionados={relacionados}
        />
      )}
    </div>
  );
}
