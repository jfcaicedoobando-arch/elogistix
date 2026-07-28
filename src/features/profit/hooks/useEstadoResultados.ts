import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useOrgFilter } from "@/hooks/shared";
import { queryKeys } from "@/lib/query";
import { fetchEstadoResultadosMes } from "@/features/profit/services/estadoResultados";
import { fetchEstadoResultadosDevengado } from "@/features/profit/services/estadoResultadosDevengado";
import { generarMesesDisponibles, mesActualKey } from "@/features/facturacion/domain/proyeccionFacturacion";
import { useFuenteEerr } from "@/features/profit/hooks/useFuenteEerr";

;

const MES_MINIMO = "2026-04";

export function useEstadoResultados() {
  const { organizationId } = useOrgFilter();
  const [searchParams, setSearchParams] = useSearchParams();

  const mesesDisponibles = useMemo(
    () => generarMesesDisponibles().filter((m) => m.key >= MES_MINIMO),
    [],
  );

  const mesQp = searchParams.get("mes");
  const mesValido = mesesDisponibles.find((m) => m.key === mesQp);
  const defaultMes = mesesDisponibles.find((m) => m.key === mesActualKey()) ?? mesesDisponibles[0];
  const [mesKey, setMesKeyState] = useState<string>(mesValido?.key ?? defaultMes.key);

  const { fuente, setFuente } = useFuenteEerr();

  const setMesKey = useCallback(
    (key: string) => {
      setMesKeyState(key);
      const next = new URLSearchParams(searchParams);
      next.set("mes", key);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const mesActual = useMemo(
    () => mesesDisponibles.find((m) => m.key === mesKey) ?? defaultMes,
    [mesesDisponibles, mesKey, defaultMes],
  );

  const indiceMes = mesesDisponibles.findIndex((m) => m.key === mesActual.key);
  const irMesAnterior = useCallback(() => {
    if (indiceMes > 0) setMesKey(mesesDisponibles[indiceMes - 1].key);
  }, [indiceMes, mesesDisponibles, setMesKey]);
  const irMesSiguiente = useCallback(() => {
    if (indiceMes < mesesDisponibles.length - 1) setMesKey(mesesDisponibles[indiceMes + 1].key);
  }, [indiceMes, mesesDisponibles, setMesKey]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.profit.estadoResultados(organizationId, mesActual.key, fuente),
    queryFn: () => {
      const p = { organizationId: organizationId ?? null, year: mesActual.year, month: mesActual.month };
      return fuente === "facturas"
        ? fetchEstadoResultadosDevengado(p)
        : fetchEstadoResultadosMes(p);
    },
    staleTime: 60_000,
  });

  return {
    mesActual,
    mesesDisponibles,
    setMesKey,
    irMesAnterior,
    irMesSiguiente,
    puedeIrAtras: indiceMes > 0,
    puedeIrAdelante: indiceMes < mesesDisponibles.length - 1,
    data,
    isLoading,
    fuente,
    setFuente,
  };
}
