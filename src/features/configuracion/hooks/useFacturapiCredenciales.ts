/**
 * Hooks para leer/escribir las credenciales de FacturApi de la org actual.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchFacturapiCredenciales,
  upsertFacturapiCredenciales,
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
  });
}
