/**
 * Hooks de versionado de cotizaciones (Fase 2).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import {
  recotizarCotizacion,
  aceptarCotizacionVersion,
  obtenerCostosCotizacionVersion,
  type CostoVersionado,
} from "@/features/cotizacion/services/versionado";

export function useRecotizarCotizacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cotizacionId, motivo }: { cotizacionId: string; motivo: string }) =>
      recotizarCotizacion(cotizacionId, motivo),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(vars.cotizacionId) });
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      notifySuccess(undefined, {
        title: `Cotización versionada a v${data.version_nueva}`,
      });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: `No se pudo re-cotizar: ${error.message}`,
        error,
        method: "VERSIONADO_RECOTIZAR",
      });
    },
  });
}

export function useAceptarCotizacionVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cotizacionId }: { cotizacionId: string }) =>
      aceptarCotizacionVersion(cotizacionId),
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.detail(vars.cotizacionId) });
      qc.invalidateQueries({ queryKey: queryKeys.cotizaciones.all });
      notifySuccess(undefined, {
        title: `Cotización aceptada (v${data.version_aceptada})`,
      });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: `Error al aceptar: ${error.message}`,
        error,
        method: "VERSIONADO_ACEPTAR",
      });
    },
  });
}

export function useCostosCotizacionVersion(
  cotizacionId: string | undefined,
  version?: number | null,
) {
  return useQuery<CostoVersionado[]>({
    queryKey: ["cotizaciones", "version", cotizacionId, version ?? "actual"],
    queryFn: () => obtenerCostosCotizacionVersion(cotizacionId as string, version),
    enabled: Boolean(cotizacionId),
    staleTime: 30_000,
  });
}
