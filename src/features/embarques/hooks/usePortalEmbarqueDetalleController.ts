import { useMemo } from "react";
import { Anchor, Building2, ClipboardList, Flag, Ship, type LucideIcon } from "lucide-react";
import { parseISO, differenceInDays } from "date-fns";
import {
  usePortalEmbarque,
  usePortalEventos,
  usePortalDocumentos,
} from "@/features/portal/hooks/usePortalData";
import { calcularEstadoEmbarque } from "@/features/embarques/domain/embarque";

export interface ProgressStep {
  key: string;
  label: string;
  /** v13.681.0 · UI-3: iconografía Lucide (antes emojis). */
  icon: LucideIcon;
}

export const PORTAL_EMBARQUE_PROGRESS_STEPS: ProgressStep[] = [
  { key: "Confirmado", label: "Confirmado", icon: ClipboardList },
  { key: "En Tránsito", label: "En Tránsito", icon: Ship },
  { key: "Arribo", label: "Arribo", icon: Anchor },
  { key: "En Aduana", label: "Aduana", icon: Building2 },
  { key: "Entregado", label: "Entregado", icon: Flag },
];

/**
 * Controller hook para PortalEmbarqueDetalle.
 * Carga embarque/eventos/documentos y calcula valores derivados:
 * estado visual, índice del paso actual, días hasta ETA y conteo de docs.
 */
export function usePortalEmbarqueDetalleController(id: string | undefined) {
  const { data: embarque, isLoading, isError, refetch } = usePortalEmbarque(id);
  // Defecto 5: eventos y documentos exponen su propio estado de error para que
  // un fallo de carga no se vea como "no hay nada" en la pestaña.
  const {
    data: eventos = [],
    isError: eventosError,
    isLoading: eventosLoading,
    refetch: refetchEventos,
  } = usePortalEventos(id);
  const {
    data: documentos = [],
    isError: documentosError,
    isLoading: documentosLoading,
    refetch: refetchDocumentos,
  } = usePortalDocumentos(id);

  const estadoVisual = useMemo(() => {
    if (!embarque) return null;
    return calcularEstadoEmbarque(
      embarque.modo,
      embarque.tipo,
      embarque.etd,
      embarque.eta,
      embarque.estado,
    );
  }, [embarque]);

  const currentStepIndex = useMemo(() => {
    if (!estadoVisual) return -1;
    if (estadoVisual === "Cerrado" || estadoVisual === "EIR" || estadoVisual === "Por liquidar") {
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
    isError,
    refetch,
    eventos,
    eventosError,
    eventosLoading,
    refetchEventos,
    documentos,
    documentosError,
    documentosLoading,
    refetchDocumentos,
    estadoVisual,
    currentStepIndex,
    diasParaEta,
    docsValidados,
    docsTotal,
    progressSteps: PORTAL_EMBARQUE_PROGRESS_STEPS,
  };
}
