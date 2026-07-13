/**
 * P3 (v13.297.0) — Hooks para Duplicar cotización y Versiones (snapshots).
 * Refactor v13.297.4: I/O delegado a `services/versiones.ts`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { notifyError } from "@/components/shared/utils/appFeedback";
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
      toast.success("Cotización duplicada. Se abrió el borrador nuevo.");
    },
    onError: (e) => toast.error(e.message || "No se pudo duplicar la cotización"),
  });
}

export function useVersionesCotizacion(cotizacionId: string | null | undefined) {
  return useQuery<CotizacionVersionRow[]>({
    queryKey: queryKeys.cotizaciones.versiones(cotizacionId ?? "none"),
    enabled: !!cotizacionId,
    queryFn: () => fetchVersiones(cotizacionId as string),
  });
}
