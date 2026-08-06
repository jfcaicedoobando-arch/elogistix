import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { contarMovimientosPendientes } from "@/features/tesoreria/services";
import { useOrgFilter } from "@/hooks/shared";

/** Movimientos bancarios sin conciliar (badge del dashboard de Tesorería). */
export function useMovimientosPendientes() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.tesoreria.movimientosPendientes(organizationId ?? null),
    queryFn: contarMovimientosPendientes,
    enabled: !!organizationId,
    staleTime: 60_000,
  });
}
