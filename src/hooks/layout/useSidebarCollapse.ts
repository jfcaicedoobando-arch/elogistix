/**
 * Sidebar Etapa 3 · 3.A — Secciones colapsables con memoria.
 *
 * Estado por sección (`true` = colapsada). Persiste en `localStorage` con
 * key versionada + parseo defensivo (try/catch → `{}`).
 *
 * Regla de oro: la sección de la ruta activa se auto-expande igual, aunque
 * el usuario la haya colapsado. Este hook sólo guarda la preferencia; la
 * lógica de auto-expansión vive en `SidebarGroupBlock`.
 */
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "sidebar:collapsed:v1";

type CollapsedMap = Record<string, boolean>;

function readInitial(): CollapsedMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: CollapsedMap = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "boolean") result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export interface UseSidebarCollapseApi {
  isCollapsed: (label: string) => boolean;
  toggle: (label: string) => void;
}

export function useSidebarCollapse(): UseSidebarCollapseApi {
  const [state, setState] = useState<CollapsedMap>(readInitial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignorar (cuota / modo privado / etc.)
    }
  }, [state]);

  const isCollapsed = useCallback((label: string) => state[label] === true, [state]);
  const toggle = useCallback((label: string) => {
    setState((prev) => ({ ...prev, [label]: !prev[label] }));
  }, []);

  return { isCollapsed, toggle };
}
