/**
 * OLA B · B.1 — Lectura y reintento de la cola de recálculo de comisiones.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess, notifyWarning } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import {
  fetchComisionesPendientes,
  reprocesarComisionesPendientes,
} from "@/features/comisiones/services/recalculoPendiente";

export function useComisionesPendientes() {
  return useQuery({
    queryKey: queryKeys.comisiones.recalculoPendiente(),
    queryFn: fetchComisionesPendientes,
    staleTime: 60_000,
  });
}

export function useReprocesarComisionesPendientes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reprocesarComisionesPendientes,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: queryKeys.comisiones.all });
      if (res.resueltas === 0) {
        notifyWarning(
          "Revisa los tipos de cambio y los costos del embarque; el recálculo sigue dando cero.",
          { title: "Ninguna comisión se pudo recalcular" },
        );
        return;
      }
      notifySuccess(
        `${res.resueltas} de ${res.procesadas} comisiones quedaron recalculadas.`,
        { title: "Comisiones recalculadas" },
      );
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: "No se pudo reprocesar comisiones",
        description: getErrorMessage(error),
        error,
        method: "REPROCESAR_COMISIONES",
      });
    },
  });
}
