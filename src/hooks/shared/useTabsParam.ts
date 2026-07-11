import { useSearchParams } from "react-router-dom";
import { useCallback, useEffect } from "react";

/**
 * Hook genérico: estado de tab persistido en query param (?tab=<id>).
 * Reemplaza el valor por defecto cuando se selecciona la primera opción.
 *
 * v13.66.15: soporta `legacyMap` opcional para redirigir deep-links antiguos
 * (p.ej. `pnl-contenedor` → `pnl`, `demoras` → `garantias`) cuando se fusionan
 * o renombran tabs sin romper bookmarks ni enlaces compartidos.
 */
export function useTabsParam<T extends string>(
  validTabs: readonly T[],
  defaultTab: T,
  paramName = "tab",
  legacyMap?: Record<string, T>,
): { activeTab: T; setActiveTab: (v: string) => void } {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get(paramName);

  const isValid = (validTabs as readonly string[]).includes(param ?? "");
  const legacyTarget = !isValid && legacyMap && param ? legacyMap[param] : undefined;
  const activeTab = isValid ? (param as T) : (legacyTarget ?? defaultTab);

  // Si vino un valor legacy, normalizar la URL para no exponer el id viejo.
  useEffect(() => {
    if (!legacyTarget) return;
    const next = new URLSearchParams(searchParams);
    if (legacyTarget === defaultTab) next.delete(paramName);
    else next.set(paramName, legacyTarget);
    setSearchParams(next, { replace: true });
  }, [legacyTarget, searchParams, setSearchParams, defaultTab, paramName]);

  const setActiveTab = useCallback(
    (v: string) => {
      const next = new URLSearchParams(searchParams);
      if (v === defaultTab) next.delete(paramName);
      else next.set(paramName, v);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, defaultTab, paramName],
  );

  return { activeTab, setActiveTab };
}
