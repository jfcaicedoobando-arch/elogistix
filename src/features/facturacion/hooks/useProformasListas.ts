/**
 * Hook: proformas aprobadas listas para convertir a factura.
 * Wrapper de react-query con staleTime de 60s.
 */
import { useQuery } from "@tanstack/react-query";
import { useOrgFilter } from "@/hooks/shared";
import {
import { queryKeys } from "@/lib/query";
  fetchProformasListas,
  fetchProformasListasCount,
  type FilaProformaLista,
} from "@/features/facturacion/services/proformasListas";

export type { FilaProformaLista };

const STALE = 60_000;

export function useProformasListas() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.facturacion.bandejaProformasListas(organizationId),
    queryFn: () => fetchProformasListas(organizationId!),
    enabled: !!organizationId,
    staleTime: STALE,
  });
}

export function useProformasListasCount() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.facturacion.bandejaProformasListasCount(organizationId),
    queryFn: () => fetchProformasListasCount(organizationId!),
    enabled: !!organizationId,
    staleTime: STALE,
  });
}
