import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrgFilter } from "@/hooks/shared";
import { useExchangeRates } from "@/features/catalogos/hooks/useExchangeRates";
import { calcularDireccionKpis, fetchDireccionKpiSources } from "@/features/dashboard/direccion/services/kpiDireccion";
import { diaNegocio, ventanaDireccionDesdeIso } from "@/features/dashboard/direccion/services/mxn";
import { parseLocalMx } from "@/lib/date/mx";
import { queryKeys } from "@/lib/query";

export function useDireccionKpis() {
  const { organizationId } = useOrgFilter();
  const { data: tc } = useExchangeRates();
  const usd = tc?.usdMxn ?? 0;
  const eur = tc?.eurMxn ?? 0;
  const dia = diaNegocio();
  const hoy = useMemo(() => parseLocalMx(dia), [dia]);
  const desdeIso = useMemo(() => ventanaDireccionDesdeIso(hoy), [hoy]);
  const { data: fuentes, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.direccion.kpis(organizationId, desdeIso),
    queryFn: () => fetchDireccionKpiSources(organizationId ?? null, desdeIso),
    staleTime: 60_000,
  });
  const data = useMemo(
    () => fuentes ? calcularDireccionKpis(fuentes, { usd, eur }, hoy) : undefined,
    [fuentes, usd, eur, hoy],
  );
  return { data, isLoading, error, refetch };
}
