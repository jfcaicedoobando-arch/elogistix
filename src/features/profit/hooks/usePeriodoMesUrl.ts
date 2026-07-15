/**
 * Hook compartido para persistir el periodo (`YYYY-MM`) en la URL vía
 * `?<paramName>=`. Devuelve API idéntica a `useEstadoResultados` /
 * `useTabProyeccionController` para poder unificar la UX de selector de mes
 * a lo largo del módulo Profit.
 *
 * - Escribe con `replace: true` para no ensuciar historial.
 * - Si el valor de la URL no está en `mesesDisponibles`, cae al mes actual
 *   (o al primero disponible si el mes actual quedó fuera del rango).
 */
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { generarMesesDisponibles, mesActualKey } from "@/features/facturacion/domain/proyeccionFacturacion";

export interface MesDisponible {
  key: string;
  label: string;
  year: number;
  month: number;
}

export interface UsePeriodoMesUrlResult {
  mesActual: MesDisponible;
  mesesDisponibles: MesDisponible[];
  setMesKey: (key: string) => void;
  irMesAnterior: () => void;
  irMesSiguiente: () => void;
  puedeIrAtras: boolean;
  puedeIrAdelante: boolean;
}

export function usePeriodoMesUrl(
  paramName: string = "mes",
  minMes?: string,
): UsePeriodoMesUrlResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const mesesDisponibles = useMemo(() => {
    const todos = generarMesesDisponibles();
    return minMes ? todos.filter((m) => m.key >= minMes) : todos;
  }, [minMes]);

  const qp = searchParams.get(paramName);
  const valido = mesesDisponibles.find((m) => m.key === qp);
  const defaultMes =
    mesesDisponibles.find((m) => m.key === mesActualKey()) ?? mesesDisponibles[0];
  const [mesKey, setMesKeyState] = useState<string>(valido?.key ?? defaultMes?.key ?? "");

  const setMesKey = useCallback(
    (key: string) => {
      setMesKeyState(key);
      const next = new URLSearchParams(searchParams);
      next.set(paramName, key);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, paramName],
  );

  const mesActual = useMemo(
    () => mesesDisponibles.find((m) => m.key === mesKey) ?? defaultMes,
    [mesesDisponibles, mesKey, defaultMes],
  );

  const indice = mesesDisponibles.findIndex((m) => m.key === mesActual.key);
  const irMesAnterior = useCallback(() => {
    if (indice > 0) setMesKey(mesesDisponibles[indice - 1].key);
  }, [indice, mesesDisponibles, setMesKey]);
  const irMesSiguiente = useCallback(() => {
    if (indice < mesesDisponibles.length - 1) setMesKey(mesesDisponibles[indice + 1].key);
  }, [indice, mesesDisponibles, setMesKey]);

  return {
  ...(mesesDisponibles.length === 0
    ? {
        // Guard: lista vacía → devolvemos un mes sintético para no romper consumers.
        mesActual: { key: "", label: "", year: 0, month: 0 } as MesDisponible,
      }
    : { mesActual }),
    mesesDisponibles,
    setMesKey,
    irMesAnterior,
    irMesSiguiente,
    puedeIrAtras: indice > 0,
    puedeIrAdelante: indice < mesesDisponibles.length - 1,
  };
}
