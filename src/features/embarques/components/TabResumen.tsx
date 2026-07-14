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
  const estadoVisual = calcularEstadoEmbarque(embarque.modo, embarque.tipo, embarque.etd, embarque.eta, embarque.estado, embarque.fecha_llegada_real);
  const currentStepIndex = ESTADOS_EMBARQUE.indexOf(estadoVisual as typeof ESTADOS_EMBARQUE[number]);
  const { data: relacionados = [] } = useEmbarquesRelacionados(embarque.id, embarque.bl_master);
  const { registerRef } = useFocusSection();

  return (
    <div className="space-y-6">
      <EstadoProgresoCard currentStepIndex={currentStepIndex} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <DatosGeneralesCard embarque={embarque} />
        <RutaTransporteCard embarque={embarque} />
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Partes</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Shipper</div>
            <div className="text-foreground">{toTitleCase(embarque.shipper) || "—"}</div>
          </div>
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Consignatario</div>
            <div className="text-foreground">{toTitleCase(embarque.consignatario) || "—"}</div>
          </div>
        </CardContent>
      </Card>

      {embarque.modo === "Marítimo" && (
        <div ref={registerRef("contenedores")} data-focus="contenedores">
          <SeccionContenedoresReadonly embarqueId={embarque.id} />
        </div>
      )}

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
