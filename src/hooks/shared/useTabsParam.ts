import { useSearchParams } from "react-router-dom";
import { useCallback } from "react";

/**
 * Hook genérico: estado de tab persistido en query param (?tab=<id>).
 * Reemplaza el valor por defecto cuando se selecciona la primera opción.
 */
export function useTabsParam<T extends string>(
  validTabs: readonly T[],
  defaultTab: T,
  paramName = "tab",
): { activeTab: T; setActiveTab: (v: string) => void } {
  const [searchParams, setSearchParams] = useSearchParams();
  const param = searchParams.get(paramName);
  const activeTab = (validTabs as readonly string[]).includes(param ?? "")
    ? (param as T)
    : defaultTab;

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
