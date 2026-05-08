import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import {
  fetchTrackingExterno,
  activarTrackingTerminal49,
  sincronizarTrackingTerminal49,
  eliminarTrackingTerminal49,
  type TrackingExterno,
} from "@/services/tracking/terminal49";

export type { TrackingExterno };

const keyTracking = (id: string) => ["tracking_externo", id];

export function useTrackingTerminal49(embarqueId: string | undefined) {
  return useQuery({
    queryKey: keyTracking(embarqueId ?? ""),
    queryFn: () => fetchTrackingExterno(embarqueId!),
    enabled: !!embarqueId,
    staleTime: 60 * 1000,
  });
}

export function useActivarTracking(embarqueId: string | undefined) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (requestType?: "bill_of_lading" | "booking_number" | "container") =>
      activarTrackingTerminal49(embarqueId!, requestType ?? "bill_of_lading"),
    onSuccess: () => {
      notifySuccess(toast, { title: "Tracking activado en Terminal49" });
      qc.invalidateQueries({ queryKey: keyTracking(embarqueId ?? "") });
      qc.invalidateQueries({ queryKey: ["tracking_intentos", embarqueId ?? ""] });
    },
    onError: (err) => {
      notifyError(toast, {
        title: "No se pudo activar el tracking",
        description: getErrorMessage(err),
      });
      qc.invalidateQueries({ queryKey: ["tracking_intentos", embarqueId ?? ""] });
    },
      notifyError(toast, {
        title: "No se pudo activar el tracking",
        description: getErrorMessage(err),
      });
    },
  });
}

export function useSincronizarTracking(embarqueId: string | undefined) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: () => sincronizarTrackingTerminal49(embarqueId!),
    onSuccess: (data) => {
      const eventos = data?.eventos_nuevos ?? 0;
      notifySuccess(toast, {
        title: "Tracking sincronizado",
        description: eventos > 0 ? `${eventos} evento(s) nuevo(s)` : "Sin cambios",
      });
      qc.invalidateQueries({ queryKey: keyTracking(embarqueId ?? "") });
      qc.invalidateQueries({ queryKey: ["embarque-full", embarqueId] });
      qc.invalidateQueries({ queryKey: ["eventos_embarque", embarqueId] });
    },
    onError: (err) => {
      notifyError(toast, {
        title: "Error al sincronizar",
        description: getErrorMessage(err),
      });
    },
  });
}

export function useEliminarTracking(embarqueId: string | undefined) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: () => eliminarTrackingTerminal49(embarqueId!),
    onSuccess: () => {
      notifySuccess(toast, { title: "Tracking desactivado" });
      qc.invalidateQueries({ queryKey: keyTracking(embarqueId ?? "") });
    },
    onError: (err) => {
      notifyError(toast, {
        title: "Error al eliminar tracking",
        description: getErrorMessage(err),
      });
    },
  });
}
