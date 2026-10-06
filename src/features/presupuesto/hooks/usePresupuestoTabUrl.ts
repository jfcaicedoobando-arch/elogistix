import { useCallback } from "react";
import { useSearchParams } from "react-router";

type PresupuestoTab = "captura" | "vs-real" | "config";

function esPresupuestoTab(value: string | null): value is PresupuestoTab {
  return value === "captura" || value === "vs-real" || value === "config";
}

/** También acepta enlaces anteriores que sólo identificaban el periodo. */
export function usePresupuestoTabUrl() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: PresupuestoTab = esPresupuestoTab(requested)
    ? requested
    : params.has("periodo_vs_real") ? "vs-real" : "captura";

  const setTab = useCallback((value: string) => {
    if (!esPresupuestoTab(value)) return;
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", value);
      return next;
    }, { replace: true });
  }, [setParams]);

  return { tab, setTab };
}
