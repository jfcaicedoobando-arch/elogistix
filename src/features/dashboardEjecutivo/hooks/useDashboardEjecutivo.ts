import { useMemo } from 'react';
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { fetchDashboardEjecutivo } from "@/features/dashboardEjecutivo/services";
import { useCobranza } from "@/features/facturacion/hooks";
import { useFacturasCxP } from "@/features/cxp/hooks";
import { useFuenteEerr } from "@/features/profit/hooks/useFuenteEerr";

import { buildFinancialAnalysis, type FinancialAnalysis } from '../services/financialAnalysis';
import { fetchSaldosCuentas } from '@/features/tesoreria/services';
import { useDiaNegocio } from '@/hooks/shared/useDiaNegocio';

function canReadSnapshot(organizationId: string | null, cxc: unknown, cxp: unknown, periodo: string) {
  return Boolean(organizationId && cxc && cxp && periodo);
}
function financialScopeError(analysis: FinancialAnalysis | undefined, organizationId: string | null, periodo: string) {
  return analysis && (analysis.organizationId !== organizationId || analysis.selectedMonth !== periodo)
    ? new Error("La respuesta financiera no corresponde a la organización y periodo actuales.") : null;
}

export function useDashboardEjecutivo(periodo: string) {
  const { organizationId } = useOrganization();
  const { fuente } = useFuenteEerr();
  const cobranzaQ = useCobranza({});
  const cxpQ = useFacturasCxP({});
  const currentBalanceReference = useDiaNegocio();
  // Own existing bank reader/cache: an EERR failure cannot hide diagnostic coverage.
  const cuentasQ = useQuery({
    queryKey: queryKeys.tesoreria.saldosCuentasPorOrg(organizationId),
    queryFn: () => fetchSaldosCuentas(organizationId),
    enabled: Boolean(organizationId),
    staleTime: 60_000,
  });
  const ready = canReadSnapshot(organizationId, cobranzaQ.data, cxpQ.data, periodo) && Boolean(cuentasQ.data);

  // Si CxC o CxP fallan, el snapshot queda deshabilitado para siempre: en React
  // Query v5 una query deshabilitada reporta `pending` sin `error` ni carga, y
  // la pantalla quedaba en blanco (sin data, sin error, sin skeleton). Por eso
  // el error de la dependencia se propaga como error del dashboard.
  const dependencies = [cobranzaQ, cxpQ, cuentasQ];
  const depsError = (dependencies.find(dependency => dependency.error)?.error ?? null) as Error | null;
  const depsLoading = dependencies.some(dependency => dependency.isLoading);
  const financialAnalysis = useMemo(() => ready && !depsError
    ? buildFinancialAnalysis({ organizationId, selectedMonth: periodo, currentBalanceReference,
      currencyRows: [...cobranzaQ.data!, ...cxpQ.data!, ...cuentasQ.data!] })
    : undefined, [ready, depsError, organizationId, periodo, currentBalanceReference,
      cobranzaQ.data, cxpQ.data, cuentasQ.data]);

  const query = useQuery({
    queryKey: queryKeys.dashboardEjecutivo.snapshot(organizationId, periodo, fuente),
    queryFn: () =>
      fetchDashboardEjecutivo({
        organizationId,
        periodo,
        fuente,
        cobranza: cobranzaQ.data!,
        cxp: cxpQ.data!,
        cuentas: cuentasQ.data!,
      }),
    staleTime: 60_000,
    gcTime: 300_000,
    enabled: ready && !depsError,
  });

  const refetch = () => {
    // Reintenta primero las fuentes fallidas; sólo un snapshot habilitado puede leerlas.
    if (cobranzaQ.error) void cobranzaQ.refetch();
    if (cxpQ.error) void cxpQ.refetch();
    if (cuentasQ.error) void cuentasQ.refetch();
    // Retrying a disabled snapshot would read with unresolved dependencies.
    if (depsError) return Promise.resolve();
    return query.refetch();
  };

  const snapshotError = depsError ?? query.error ?? financialScopeError(query.data?.financialAnalysis, organizationId, periodo);
  return {
    ...query,
    financialAnalysis,
    financialAnalysisError: depsError,
    financialAnalysisLoading: !depsError && depsLoading,
    // Exactamente una rama: error de dependencia gana y no expone data vieja.
    data: snapshotError ? undefined : query.data,
    error: snapshotError,
    isError: Boolean(snapshotError),
    isSuccess: !snapshotError && query.isSuccess,
    // `query.isLoading` ya es false cuando la query está deshabilitada (v5),
    // así que sumamos la carga real de las dependencias sin confundir
    // "pending deshabilitado" con "cargando".
    isLoading: !snapshotError && (depsLoading || query.isLoading),
    isFetching: query.isFetching || dependencies.some(dependency => dependency.isFetching),
    refetch,
  };
}
