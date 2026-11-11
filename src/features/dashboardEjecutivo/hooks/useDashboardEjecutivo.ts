import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { queryKeys } from "@/lib/query";
import { useDiaNegocio } from "@/hooks/shared/useDiaNegocio";
import { useCobranza } from "@/features/facturacion/hooks";
import { useFacturasCxP } from "@/features/cxp/hooks";
import { useFuenteEerr } from "@/features/profit/hooks/useFuenteEerr";
import { fetchLiquidacionesPendientes, fetchSaldosCuentas } from "@/features/tesoreria/services";
import {
  construirSnapshotEjecutivo,
  fetchFuentesDashboardEjecutivo,
  type FuentesDashboardEjecutivo,
} from "@/features/dashboardEjecutivo/services";
import { buildFinancialAnalysis } from "../services/financialAnalysis";

function errorDeAmbito(
  fuentes: FuentesDashboardEjecutivo | undefined,
  organizationId: string | null,
  periodo: string,
  fuente: FuentesDashboardEjecutivo["fuente"],
): Error | null {
  if (!fuentes) return null;
  const coincide = fuentes.organizationId === organizationId && fuentes.periodo === periodo && fuentes.fuente === fuente;
  return coincide ? null : new Error("La respuesta financiera no corresponde a la organización y periodo actuales.");
}

export function useDashboardEjecutivo(periodo: string) {
  const { organizationId } = useOrganization();
  const { fuente } = useFuenteEerr();
  const cobranzaQ = useCobranza({});
  const cxpQ = useFacturasCxP({});
  const currentBalanceReference = useDiaNegocio();
  const cuentasQ = useQuery({
    queryKey: queryKeys.tesoreria.saldosCuentasPorOrg(organizationId),
    queryFn: () => fetchSaldosCuentas(organizationId),
    enabled: Boolean(organizationId),
  });
  const { data: cobranza } = cobranzaQ;
  const { data: cxp } = cxpQ;
  const { data: cuentas } = cuentasQ;
  const balanceQueries = [cobranzaQ, cxpQ, cuentasQ];
  const balanceError = balanceQueries.find(({ error }) => error)?.error ?? null;
  const ready = Boolean(organizationId && periodo && cobranza && cxp && cuentas && !balanceError);
  const financialAnalysis = useMemo(() => ready
    ? buildFinancialAnalysis({
      organizationId, selectedMonth: periodo, currentBalanceReference,
      currencyRows: [...cobranza!, ...cxp!, ...cuentas!],
    })
    : undefined, [ready, organizationId, periodo, currentBalanceReference, cobranza, cxp, cuentas]);

  const fuentesQ = useQuery({
    queryKey: queryKeys.dashboardEjecutivo.fuentes(organizationId, periodo, fuente),
    queryFn: () => fetchFuentesDashboardEjecutivo({ organizationId, periodo, fuente }),
    enabled: ready,
  });
  const liquidacionesQ = useQuery({
    queryKey: queryKeys.comisiones.liquidacionesPendientesTesoreria(organizationId),
    queryFn: () => fetchLiquidacionesPendientes(organizationId),
    enabled: ready,
  });
  const { data: fuentes } = fuentesQ;
  const { data: liquidaciones } = liquidacionesQ;
  const queries = [...balanceQueries, fuentesQ, liquidacionesQ];
  const queryError = queries.find(({ error }) => error)?.error ?? null;
  const error = queryError ?? errorDeAmbito(fuentes, organizationId, periodo, fuente);

  // La tabla y el PDF reciben el mismo snapshot, derivado de las fuentes vigentes.
  const data = useMemo(() => !error && financialAnalysis && fuentes && liquidaciones
    ? construirSnapshotEjecutivo({
      fuentes, cuentas: cuentas!, cobranza: cobranza!, cxp: cxp!, liquidaciones,
      financialAnalysis, generadoEn: new Date().toISOString(),
    })
    : undefined, [error, financialAnalysis, fuentes, liquidaciones, cuentas, cobranza, cxp]);

  const refetch = () => {
    const failed = queries.filter(({ error }) => error);
    // Una fuente derivada se habilita al recuperar las lecturas de saldo.
    const targets = failed.length ? failed : ready ? queries : balanceQueries;
    return Promise.all(targets.map((query) => query.refetch()));
  };

  return {
    data,
    error,
    isError: Boolean(error),
    isSuccess: Boolean(data),
    isLoading: !error && queries.some(({ isLoading }) => isLoading),
    isFetching: queries.some(({ isFetching }) => isFetching),
    refetch,
    financialAnalysis,
    financialAnalysisError: balanceError,
    financialAnalysisLoading: !balanceError && balanceQueries.some(({ isLoading }) => isLoading),
  };
}
