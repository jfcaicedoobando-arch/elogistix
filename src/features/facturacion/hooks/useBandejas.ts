/**
 * Hooks para las bandejas de trabajo del cockpit de Facturación (Fase 2).
 *
 * Cada hook envuelve una query de `services/bandejas.ts` con react-query
 * y una staleTime de 60 s. El hook de conteos alimenta los badges en la
 * fila de tabs.
 */
import { useQuery } from "@tanstack/react-query";
import { useOrgFilter } from "@/hooks/shared";
import { queryKeys } from "@/lib/query";
import {
  fetchFacturasPorTimbrar,
  fetchFacturasPorEnviar,
  fetchPagosRepPendientes,
  fetchBandejaConteos,
  type BandejaConteos,
  type FilaPorTimbrar,
  type FilaPorEnviar,
  type FilaRepPendiente,
} from "@/features/facturacion/services/bandejas";

export type {  FilaPorTimbrar, FilaPorEnviar, FilaRepPendiente };

const STALE = 60_000;

export function useFacturasPorTimbrar() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.facturacion.bandejaPorTimbrar(organizationId),
    queryFn: () => fetchFacturasPorTimbrar(organizationId!),
    enabled: !!organizationId,
    staleTime: STALE,
  });
}

export function useFacturasPorEnviar() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.facturacion.bandejaPorEnviar(organizationId),
    queryFn: () => fetchFacturasPorEnviar(organizationId!),
    enabled: !!organizationId,
    staleTime: STALE,
  });
}

export function usePagosRepPendientes() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.facturacion.bandejaRepPendientes(organizationId),
    queryFn: () => fetchPagosRepPendientes(organizationId!),
    enabled: !!organizationId,
    staleTime: STALE,
  });
}

export function useBandejaConteos() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.facturacion.bandejaConteos(organizationId),
    queryFn: () => fetchBandejaConteos(organizationId!),
    enabled: !!organizationId,
    staleTime: STALE,
  });
}
