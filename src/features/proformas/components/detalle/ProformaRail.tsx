/**
 * Riel derecho del detalle de proforma: línea de tiempo del ciclo con el
 * cliente + bitácora de actividad, dentro de la misma tarjeta compartida que
 * usan facturas emitidas y recibidas ("Historial y actividad").
 */
import { DocumentoRailCard } from "@/components/shared/documento/DocumentoRailCard";
import { TimelineProforma } from "@/features/proformas/components/detalle/TimelineProforma";
import { ProformaBitacoraCard } from "@/features/proformas/components/detalle/ProformaBitacoraCard";
import type { ProformaTimelineFields } from "@/features/proformas/domain/proformaClienteEstado";
import type { ProformaEnvioLite } from "@/features/proformas/services";

interface Props {
  proformaId: string;
  fechaEmision: string;
  operador: string | null | undefined;
  timeline: ProformaTimelineFields;
  envios?: ProformaEnvioLite[];
}

export function ProformaRail({ proformaId, fechaEmision, operador, timeline, envios }: Props) {
  return (
    <DocumentoRailCard>
      <TimelineProforma
        bare
        fechaEmision={fechaEmision}
        operador={operador}
        timeline={timeline}
        envios={envios}
      />
      <div className="mt-4 border-t pt-3">
        <p className="mb-1 text-label font-medium uppercase tracking-wide text-muted-foreground">
          Actividad
        </p>
        <ProformaBitacoraCard bare proformaId={proformaId} />
      </div>
    </DocumentoRailCard>
  );
}
