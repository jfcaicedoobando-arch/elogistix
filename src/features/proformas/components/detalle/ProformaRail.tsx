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
import type { FacturaCicloLite } from "@/lib/domain/etiquetaCicloProforma";

interface Props {
  proformaId: string;
  fechaEmision: string;
  operador: string | null | undefined;
  timeline: ProformaTimelineFields;
  envios?: ProformaEnvioLite[];
  /** B9: para no llamar "Facturada" a una conversión a borrador. */
  facturas?: FacturaCicloLite[];
}

export function ProformaRail({ proformaId, fechaEmision, operador, timeline, envios, facturas }: Props) {
  return (
    <DocumentoRailCard>
      <TimelineProforma
        bare
        fechaEmision={fechaEmision}
        operador={operador}
        timeline={timeline}
        envios={envios}
        facturas={facturas}
      />
      <div className="mt-4 border-t pt-3">
        <p className="mb-1 text-overline font-medium">
          Actividad
        </p>
        <ProformaBitacoraCard bare proformaId={proformaId} />
      </div>
    </DocumentoRailCard>
  );
}
