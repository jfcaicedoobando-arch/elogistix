/**
 * Hook delegado al service `fetchEmbarqueDependenciasFinancieras`.
 * Mantiene `useQuery` y los tipos públicos para los consumidores existentes.
 */
import { useQuery } from '@tanstack/react-query';
import {
  fetchEmbarqueDependenciasFinancieras,
  type EmbarqueDependenciasFinancieras,
  type FacturaLigada,
} from '@/features/embarques/services/dependenciasFinancieras';
import { queryKeys } from '@/lib/query';
import { usePermissions } from '@/hooks/shared/usePermissions';
import { useEmbarquePrivateScope } from './useEmbarquePrivateScope';

export type { EmbarqueDependenciasFinancieras, FacturaLigada };

export function useEmbarqueDependenciasFinancieras(
  embarqueId: string | undefined,
  enabled: boolean,
) {
  const scope = useEmbarquePrivateScope();
  const { canEliminarEmbarque } = usePermissions();
  const verificationEnabled = Boolean(embarqueId) && scope.staff && canEliminarEmbarque;
  const query = useQuery({
    queryKey: queryKeys.embarques.dependenciasFinancieras(embarqueId, scope.key),
    queryFn: ({ signal }) => fetchEmbarqueDependenciasFinancieras(embarqueId as string, signal),
    enabled: enabled && verificationEnabled,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });
  return { ...query, verificationEnabled, verificationReady: scope.ready };
}
