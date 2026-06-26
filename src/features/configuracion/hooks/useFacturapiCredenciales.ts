/**
 * Hooks para leer/escribir las credenciales de FacturApi de la org actual.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifyError } from "@/components/shared/utils/appFeedback";
import {
  fetchFacturapiCredenciales,
  upsertFacturapiCredenciales,
  setFacturapiApiKey,
  clearFacturapiApiKey,
  probarFacturapiConexion,
  type FacturapiAmbiente,
  type FacturapiCredencialesInput,
  type FacturapiCredencialesRow,
} from "@/features/configuracion/services/facturapiCredenciales";

const KEY = (orgId: string) => ["facturapi_credenciales", orgId] as const;

export function useFacturapiCredenciales(orgId: string | null | undefined) {
  return useQuery<FacturapiCredencialesRow | null>({
    queryKey: orgId ? KEY(orgId) : ["facturapi_credenciales", "noop"],
    enabled: !!orgId,
    queryFn: () => fetchFacturapiCredenciales(orgId!),
    staleTime: 60 * 1000,
  });
}

export function useUpsertFacturapiCredenciales(orgId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FacturapiCredencialesInput) => {
      if (!orgId) throw new Error("organization_id requerido");
      return upsertFacturapiCredenciales(orgId, input);
    },
    onSuccess: () => {
      if (orgId) qc.invalidateQueries({ queryKey: KEY(orgId) });
    },
    onError: (error) => {
      notifyError(undefined, {
        title: "No se pudo guardar la configuración de FacturApi",
        method: "useUpsertFacturapiCredenciales",
        error,
      });
    },
  });
}

export function useSetFacturapiApiKey(orgId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ambiente, apiKey }: { ambiente: FacturapiAmbiente; apiKey: string }) => {
      if (!orgId) throw new Error("organization_id requerido");
      return setFacturapiApiKey(orgId, ambiente, apiKey);
    },
    onSuccess: () => {
      if (orgId) qc.invalidateQueries({ queryKey: KEY(orgId) });
    },
    onError: (error) => {
      notifyError(undefined, {
        title: "No se pudo guardar la API key",
        method: "useSetFacturapiApiKey",
        error,
      });
    },
  });
}

export function useClearFacturapiApiKey(orgId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ambiente: FacturapiAmbiente) => {
      if (!orgId) throw new Error("organization_id requerido");
      return clearFacturapiApiKey(orgId, ambiente);
    },
    onSuccess: () => {
      if (orgId) qc.invalidateQueries({ queryKey: KEY(orgId) });
    },
    onError: (error) => {
      notifyError(undefined, {
        title: "No se pudo borrar la API key",
        method: "useClearFacturapiApiKey",
        error,
      });
    },
  });
}

export function useProbarFacturapiConexion(orgId: string | null | undefined) {
  return useMutation({
    mutationFn: (ambiente: FacturapiAmbiente) => {
      if (!orgId) throw new Error("organization_id requerido");
      return probarFacturapiConexion(orgId, ambiente);
    },
    onError: (error) => {
      notifyError(undefined, {
        title: "No se pudo probar la conexión",
        method: "useProbarFacturapiConexion",
        error,
      });
    },
  });
}
