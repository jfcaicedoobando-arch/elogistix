import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useOrgFilter } from "@/hooks/shared";
import { queryKeys } from "@/lib/query";
import { fetchEstadoResultadosMes } from "@/features/profit/services/estadoResultados";
import { fetchEstadoResultadosDevengado } from "@/features/profit/services/estadoResultadosDevengado";
import { usePeriodoMesUrl } from "./usePeriodoMesUrl";
import { useFuenteEerr, type FuenteEERR } from "@/features/profit/hooks/useFuenteEerr";

;

const MES_MINIMO = "2026-04";

export function useEstadoResultados() {
  const { organizationId, orgListo } = useOrgFilter();
  const [searchParams, setSearchParams] = useSearchParams();

  const periodo = usePeriodoMesUrl("mes", MES_MINIMO);
  const { mesActual, mesesDisponibles, setMesKey, irMesAnterior, irMesSiguiente } = periodo;
  const preferencia = useFuenteEerr();
  const fuenteUrl = searchParams.get("fuente");
  const fuente: FuenteEERR = fuenteUrl === "embarques" || fuenteUrl === "facturas" ? fuenteUrl : preferencia.fuente;
  const setFuente = useCallback((next: FuenteEERR) => {
    preferencia.setFuente(next);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set("fuente", next);
      return params;
    }, { replace: true });
  }, [preferencia, setSearchParams]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.profit.estadoResultados(organizationId, mesActual.key, fuente),
    queryFn: () => {
      const p = { organizationId: organizationId ?? null, year: mesActual.year, month: mesActual.month };
      return fuente === "facturas"
        ? fetchEstadoResultadosDevengado(p)
        : fetchEstadoResultadosMes(p);
    },
    // EERR-ORG (v13.823.246): sin esta puerta la consulta se disparaba con
    // `organizationId = null` mientras el contexto resolvía y sumaba facturas
    // de todas las empresas por un instante.
    enabled: orgListo,
    staleTime: 60_000,
  });

  return {
    mesActual,
    mesesDisponibles,
    setMesKey,
    irMesAnterior,
    irMesSiguiente,
    puedeIrAtras: periodo.puedeIrAtras,
    puedeIrAdelante: periodo.puedeIrAdelante,
    data,
    isLoading,
    isError,
    error,
    refetch,
    fuente,
    setFuente,
  };
}
