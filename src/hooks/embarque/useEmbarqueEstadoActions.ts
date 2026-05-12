import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useRegistrarActividad } from "@/hooks/shared/useBitacora";
import { getErrorMessage } from "@/lib/errors";
import { ESTADOS_EMBARQUE } from "@/constants/embarqueConstants";
import {
  useAvanzarEstadoEmbarque,
  useSyncEstadoEmbarque,
  calcularEstadoEmbarque,
  type EmbarqueRow,
} from "@/hooks/embarque/useEmbarques";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { useEffect } from "react";

export function getSiguienteEstado(estadoActual: string) {
  const idx = (ESTADOS_EMBARQUE as readonly string[]).indexOf(estadoActual);
  if (idx < 0 || idx >= ESTADOS_EMBARQUE.length - 1) return null;
  return ESTADOS_EMBARQUE[idx + 1];
}

/**
 * Hook focalizado en la sincronización + avance de estado del embarque.
 * Separado de la gestión de documentos para mantener responsabilidades únicas.
 */
export function useEmbarqueEstadoActions(embarque: EmbarqueRow | undefined, id: string | undefined) {
  const { toast } = useToast();
  const { user } = useAuth();
  const registrarActividad = useRegistrarActividad();
  const avanzarEstado = useAvanzarEstadoEmbarque();
  const syncEstado = useSyncEstadoEmbarque();

  // Auto-sync estado calculado a BD
  useEffect(() => {
    if (!embarque) return;
    const estadoCalculado = calcularEstadoEmbarque(
      embarque.modo, embarque.tipo, embarque.etd, embarque.eta, embarque.estado, embarque.fecha_llegada_real,
    );
    if (estadoCalculado !== embarque.estado) {
      syncEstado.mutate({ embarqueId: embarque.id, nuevoEstado: estadoCalculado });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embarque?.id, embarque?.etd, embarque?.eta, embarque?.fecha_llegada_real]);

  const handleAvanzarEstado = async () => {
    if (!embarque || !id) return;
    const siguiente = getSiguienteEstado(embarque.estado);
    if (!siguiente) return;
    try {
      await avanzarEstado.mutateAsync({
        embarqueId: id,
        nuevoEstado: siguiente,
        usuarioEmail: user?.email ?? '',
      });
      registrarActividad.mutate({
        accion: 'cambiar_estado', modulo: 'embarques',
        entidad_id: id, entidad_nombre: embarque.expediente,
        detalles: { estado_anterior: embarque.estado, estado_nuevo: siguiente },
      });
      notifySuccess(toast, { title: `Estado actualizado a "${siguiente}"` });
    } catch (err: unknown) {
      notifyError(toast, { title: "Error al cambiar estado", description: getErrorMessage(err)});
    }
  };

  return { handleAvanzarEstado, avanzarEstado };
}
