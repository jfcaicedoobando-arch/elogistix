/**
 * P3 (v13.297.0) — Hooks para Duplicar cotización y Versiones (snapshots).
 * Refactor v13.297.4: I/O delegado a `services/versiones.ts`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { notifyError } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
import {
  duplicarCotizacionRpc,
  fetchVersiones,
  type CotizacionVersionRow,
} from "@/features/cotizacion/services/versiones";

export type { CotizacionVersionRow };

export function useDuplicarCotizacion() {
  const qc = useQueryClient();
  return useMutation<string, Error, string>({
    mutationFn: (cotizacionId: string) => duplicarCotizacionRpc(cotizacionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      notifySuccess(undefined, { title: "Cotización duplicada. Se abrió el borrador nuevo." });
    },
    onError: (e) =>
      notifyError(undefined, {
        title: "No se pudo duplicar la cotización",
        error: e,
        method: "useDuplicarCotizacion",
      }),
  });
}

export function useVersionesCotizacion(cotizacionId: string | null | undefined) {
  return useQuery<CotizacionVersionRow[]>({
    queryKey: queryKeys.cotizaciones.versiones(cotizacionId ?? "none"),
    enabled: !!cotizacionId,
    queryFn: () => fetchVersiones(cotizacionId as string),
  });
}
