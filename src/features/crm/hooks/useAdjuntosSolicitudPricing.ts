import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listarAdjuntos,
  subirAdjunto,
  urlAdjunto,
} from "@/features/crm/services/pricing/adjuntosPricing";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

export function useUrlAdjuntoPricing(path: string) {
  return useQuery({
    queryKey: ["crm", "pricing", "adjunto-url", path],
    queryFn: () => urlAdjunto(path),
    staleTime: 50 * 60_000,
  });
}

export function useAdjuntosSolicitudPricing(organizationId: string, solicitudId: string) {
  const qc = useQueryClient();
  const key = ["crm", "pricing", "adjuntos", solicitudId];
  const { data: adjuntos = [], isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => listarAdjuntos(organizationId, solicitudId),
  });
  const subir = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) await subirAdjunto(organizationId, solicitudId, file);
    },
    onSuccess: (_data, files) => notifySuccess(undefined, {
      title: files.length === 1 ? "Archivo adjuntado" : `${files.length} archivos adjuntados`,
    }),
    onError: (e) => notifyError(undefined, {
      title: "No se pudo adjuntar el archivo",
      description: e instanceof Error ? e.message : undefined,
      error: e,
      method: "CRM_PRICING_ADJUNTO",
    }),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { adjuntos, isLoading, error, subir };
}
