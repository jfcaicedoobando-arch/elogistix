/**
 * Hooks para las bandejas de trabajo del cockpit de Facturación (Fase 2).
 *
 * Cada hook envuelve una query de `services/bandejas.ts` con react-query
 * y una staleTime de 60 s. El hook de conteos alimenta los badges en la
 * fila de tabs.
 */
import { useQuery } from "@tanstack/react-query";
import { useOrgFilter } from "@/hooks/shared";
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

export type { BandejaConteos, FilaPorTimbrar, FilaPorEnviar, FilaRepPendiente };

const STALE = 60_000;

export function useFacturasPorTimbrar() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: ["facturacion", "bandeja", "por-timbrar", organizationId],
    queryFn: () => fetchFacturasPorTimbrar(organizationId!),
    enabled: !!organizationId,
    staleTime: STALE,
  });
}

export function useFacturasPorEnviar() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: ["facturacion", "bandeja", "por-enviar", organizationId],
    queryFn: () => fetchFacturasPorEnviar(organizationId!),
    enabled: !!organizationId,
    staleTime: STALE,
  });
}

export function usePagosRepPendientes() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: ["facturacion", "bandeja", "rep-pendientes", organizationId],
    queryFn: () => fetchPagosRepPendientes(organizationId!),
    enabled: !!organizationId,
    staleTime: STALE,
  });
}

export function useBandejaConteos() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: ["facturacion", "bandeja", "conteos", organizationId],
    queryFn: () => fetchBandejaConteos(organizationId!),
    enabled: !!organizationId,
    staleTime: STALE,
  });
}
