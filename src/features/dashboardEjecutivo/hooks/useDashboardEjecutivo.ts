import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { fetchDashboardEjecutivo } from "@/features/dashboardEjecutivo/services";
import { useCobranza } from "@/features/facturacion/hooks";
import { useFacturasCxP } from "@/features/cxp/hooks";
import { useFuenteEerr } from "@/features/profit/hooks/useFuenteEerr";

export function useDashboardEjecutivo(periodo: string) {
  const { organizationId } = useOrganization();
  const { fuente } = useFuenteEerr();
  const cobranzaQ = useCobranza({});
  const cxpQ = useFacturasCxP({});
  const ready = !!cobranzaQ.data && !!cxpQ.data && !!periodo;

  // Si CxC o CxP fallan, el snapshot queda deshabilitado para siempre: en React
  // Query v5 una query deshabilitada reporta `pending` sin `error` ni carga, y
  // la pantalla quedaba en blanco (sin data, sin error, sin skeleton). Por eso
  // el error de la dependencia se propaga como error del dashboard.
  const depsError = (cobranzaQ.error ?? cxpQ.error ?? null) as Error | null;
  const depsLoading = cobranzaQ.isLoading || cxpQ.isLoading;

  const query = useQuery({
    queryKey: queryKeys.dashboardEjecutivo.snapshot(organizationId, periodo, fuente),
    queryFn: () =>
      fetchDashboardEjecutivo({
        organizationId,
        periodo,
        fuente,
        cobranza: cobranzaQ.data!,
        cxp: cxpQ.data!,
      }),
    staleTime: 60_000,
    gcTime: 300_000,
    enabled: ready && !depsError,
  });

  const refetch = () => {
    // El retry reintenta la dependencia fallida además del snapshot.
    if (cobranzaQ.error) void cobranzaQ.refetch();
    if (cxpQ.error) void cxpQ.refetch();
    return query.refetch();
  };

  return {
    ...query,
    // Exactamente una rama: error de dependencia gana y no expone data vieja.
    data: depsError ? undefined : query.data,
    error: depsError ?? query.error,
    isError: Boolean(depsError) || query.isError,
    isSuccess: !depsError && query.isSuccess,
    // `query.isLoading` ya es false cuando la query está deshabilitada (v5),
    // así que sumamos la carga real de las dependencias sin confundir
    // "pending deshabilitado" con "cargando".
    isLoading: !depsError && (depsLoading || query.isLoading),
    isFetching: query.isFetching || cobranzaQ.isFetching || cxpQ.isFetching,
    refetch,
  };
}
