import { useMemo } from "react";
import { parseISO, differenceInDays } from "date-fns";
import {
  usePortalEmbarque,
  usePortalEventos,
  usePortalDocumentos,
} from "@/hooks/portal/usePortalData";
import { calcularEstadoEmbarque } from "@/lib/domain/embarque";

export interface ProgressStep {
  key: string;
  label: string;
  icon: string;
}

export const PORTAL_EMBARQUE_PROGRESS_STEPS: ProgressStep[] = [
  { key: "Confirmado", label: "Confirmado", icon: "📋" },
  { key: "En Tránsito", label: "En Tránsito", icon: "🚢" },
  { key: "Arribo", label: "Arribo", icon: "⚓" },
  { key: "En Aduana", label: "Aduana", icon: "🛃" },
  { key: "Entregado", label: "Entregado", icon: "🏁" },
];

/**
 * Controller hook para PortalEmbarqueDetalle.
 * Carga embarque/eventos/documentos y calcula valores derivados:
 * estado visual, índice del paso actual, días hasta ETA y conteo de docs.
 */
export function usePortalEmbarqueDetalleController(id: string | undefined) {
  const { data: embarque, isLoading } = usePortalEmbarque(id);
  const { data: eventos = [] } = usePortalEventos(id);
  const { data: documentos = [] } = usePortalDocumentos(id);

  const estadoVisual = useMemo(() => {
    if (!embarque) return null;
    return calcularEstadoEmbarque(
      embarque.modo,
      embarque.tipo,
      embarque.etd,
      embarque.eta,
      embarque.estado,
      embarque.fecha_llegada_real,
    );
  }, [embarque]);

  const currentStepIndex = useMemo(() => {
    if (!estadoVisual) return -1;
    if (estadoVisual === "Cerrado" || estadoVisual === "EIR") {
      return PORTAL_EMBARQUE_PROGRESS_STEPS.length;
    }
    const idx = PORTAL_EMBARQUE_PROGRESS_STEPS.findIndex((s) => s.key === estadoVisual);
    return idx >= 0 ? idx : 0;
  }, [estadoVisual]);

  const diasParaEta = useMemo(() => {
    if (!embarque?.eta) return null;
    try {
      return differenceInDays(parseISO(embarque.eta), new Date());
    } catch {
      return null;
    }
  }, [embarque]);

  const docsValidados = useMemo(
    () =>
      documentos.filter(
        (d) => d.estado === "Recibido" || d.estado === "Validado",
      ).length,
    [documentos],
  );
  const docsTotal = documentos.length;

  return {
    embarque,
    isLoading,
    eventos,
    documentos,
    estadoVisual,
    currentStepIndex,
    diasParaEta,
    docsValidados,
    docsTotal,
    progressSteps: PORTAL_EMBARQUE_PROGRESS_STEPS,
  };
}
