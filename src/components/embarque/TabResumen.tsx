import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toTitleCase } from "@/lib/formatters";
import { ESTADOS_EMBARQUE } from "@/constants/embarqueConstants";
import { calcularEstadoEmbarque } from "@/lib/domain/embarque";
import { useEmbarquesRelacionados } from "@/hooks/embarque";
import type { EmbarqueRow } from "@/hooks/embarque";
import { EstadoProgresoCard } from "./tabResumen/EstadoProgresoCard";
import { DatosGeneralesCard, RutaTransporteCard } from "./tabResumen/ResumenCards";
import { EmbarquesRelacionadosCard } from "./tabResumen/EmbarquesRelacionadosCard";

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
