/**
 * Hook compartido para persistir el periodo (`YYYY-MM`) en la URL vía
 * `?<paramName>=`. Devuelve API idéntica a `useEstadoResultados` /
 * `useTabProyeccionController` para poder unificar la UX de selector de mes
 * a lo largo del módulo Profit.
 *
 * Garantías:
 * - Sincroniza cambios externos de URL (back/forward) → estado interno.
 * - Canonicaliza URL en el primer render si el valor es inválido o queda
 *   fuera de la ventana `[minMes, +∞)`.
 * - `setMesKey` usa `setSearchParams((prev) => …)` — callback estable.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
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

const MES_VACIO: MesDisponible = { key: "", label: "", year: 0, month: 0 };

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
  const defaultMes = useMemo(
    () =>
      mesesDisponibles.find((m) => m.key === mesActualKey()) ??
      mesesDisponibles[0] ??
      MES_VACIO,
    [mesesDisponibles],
  );

  const [mesKey, setMesKeyState] = useState<string>(() => {
    const inicial = mesesDisponibles.find((m) => m.key === qp);
    return inicial?.key ?? defaultMes.key;
  });

  // Sincroniza cambios externos de URL (back/forward, deep-link) hacia el estado.
  useEffect(() => {
    if (!qp) return;
    const match = mesesDisponibles.find((m) => m.key === qp);
    if (match && match.key !== mesKey) {
      setMesKeyState(match.key);
    }
  }, [qp, mesesDisponibles, mesKey]);

  // Canonicaliza URL: si `qp` existe pero es inválido/fuera de rango, reescribimos
  // al valor por defecto para dejar URL y estado siempre consistentes.
  useEffect(() => {
    if (!qp) return;
    const valido = mesesDisponibles.some((m) => m.key === qp);
    if (!valido && defaultMes.key) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(paramName, defaultMes.key);
          return next;
        },
        { replace: true },
      );
    }
    // Sólo se ejecuta al montar y cuando cambia qp o el rango disponible.
  }, [qp, mesesDisponibles, defaultMes.key, setSearchParams, paramName]);

  const setMesKey = useCallback(
    (key: string) => {
      setMesKeyState(key);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set(paramName, key);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams, paramName],
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
    mesActual,
    mesesDisponibles,
    setMesKey,
    irMesAnterior,
    irMesSiguiente,
    puedeIrAtras: indice > 0,
    puedeIrAdelante: indice >= 0 && indice < mesesDisponibles.length - 1,
  };
}
