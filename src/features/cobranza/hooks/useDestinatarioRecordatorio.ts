import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthOperationChangedError, captureAuthDataScope } from "@/lib/auth/authOperationScope";
import { getSessionCacheGeneration, subscribeSessionCacheGeneration } from "@/lib/auth/sessionCacheRegistry";
import { queryKeys } from "@/lib/query";
import { consultarDestinatarioRecordatorio } from "@/features/cobranza/services/recordatorioCobranzaService";

export function useDestinatarioRecordatorio(facturaId: string | undefined, open: boolean) {
  const generation = useSyncExternalStore(
    subscribeSessionCacheGeneration, getSessionCacheGeneration, getSessionCacheGeneration,
  );
  const scope = captureAuthDataScope();
  const query = useQuery({
    queryKey: queryKeys.facturacion.destinatarioRecordatorio(
      facturaId, scope.userId, scope.organizationId, generation,
    ),
    queryFn: async ({ signal }) => {
      scope.assertCurrent();
      const result = await consultarDestinatarioRecordatorio(facturaId!);
      scope.assertCurrent();
      if (signal.aborted) throw new AuthOperationChangedError();
      return result;
    },
    enabled: open && !!facturaId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    retry: false,
    meta: { silentError: true },
  });
  return { ...query, isCurrentScope: scope.isCurrent };
}
