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

export type { EmbarqueDependenciasFinancieras, FacturaLigada };

export function useEmbarqueDependenciasFinancieras(
  embarqueId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.embarques.dependenciasFinancieras(embarqueId),
    queryFn: () => fetchEmbarqueDependenciasFinancieras(embarqueId as string),
    enabled: enabled && Boolean(embarqueId),
    staleTime: 30_000,
  });
}
