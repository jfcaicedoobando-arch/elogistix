import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { queryKeys } from "@/lib/query";
import { fetchEstadoResultadosMes } from "@/services/profit";
import { generarMesesDisponibles, mesActualKey } from "@/lib/domain/proyeccionFacturacion";

const MES_MINIMO = "2026-04";

export function useEstadoResultados() {
  const { organizationId } = useOrgFilter();
  const [searchParams, setSearchParams] = useSearchParams();

  // Lista de meses desde Abril 2026 hacia adelante.
  const mesesDisponibles = useMemo(
    () => generarMesesDisponibles().filter((m) => m.key >= MES_MINIMO),
    [],
  );

  const mesQp = searchParams.get("mes");
  const mesValido = mesesDisponibles.find((m) => m.key === mesQp);
  const defaultMes = mesesDisponibles.find((m) => m.key === mesActualKey()) ?? mesesDisponibles[0];
  const [mesKey, setMesKeyState] = useState<string>(mesValido?.key ?? defaultMes.key);

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
    queryKey: queryKeys.profit.estadoResultados(organizationId, mesActual.key),
    queryFn: () =>
      fetchEstadoResultadosMes({
        organizationId: organizationId ?? null,
        year: mesActual.year,
        month: mesActual.month,
      }),
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
  };
}
