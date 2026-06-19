import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useOrgFilter } from "@/hooks/shared";
import { notifyError } from "@/components/shared/utils/appFeedback";
import {
  enviarRecordatorio,
  fetchUltimosRecordatorios,
  type CanalRecordatorio,
} from "@/features/facturacion/services/recordatorios";

const KEY_ULTIMOS = (ids: string[]) => ["factura_recordatorios", "ultimos", ids.slice().sort().join(",")] as const;

export function useUltimosRecordatorios(facturaIds: string[]) {
  return useQuery({
    queryKey: KEY_ULTIMOS(facturaIds),
    queryFn: () => fetchUltimosRecordatorios(facturaIds),
    enabled: facturaIds.length > 0,
    staleTime: 30_000,
  });
}

export function useEnviarRecordatorio() {
  const queryClient = useQueryClient();
  const { organizationId } = useOrgFilter();
  return useMutation({
    mutationFn: (args: { factura_id: string; canal?: CanalRecordatorio; nota?: string }) => {
      if (!organizationId) throw new Error("Sin organización activa");
      return enviarRecordatorio({ ...args, organization_id: organizationId });
    },
    onSuccess: () => {
      toast.success("Recordatorio registrado");
      queryClient.invalidateQueries({ queryKey: ["factura_recordatorios"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      notifyError(toast, { title: `No se pudo registrar el recordatorio: ${msg}`, error: e, method: "FEATURES_FACTURACION_HOOKS_USERECORDATORIOS_1" });
    },
  });
}
