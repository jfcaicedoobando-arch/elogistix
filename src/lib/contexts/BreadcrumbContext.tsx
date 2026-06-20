import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Registro global de etiquetas legibles para segmentos dinámicos del breadcrumb
 * (uuids, ids, expedientes). Las páginas de detalle registran su etiqueta una
 * vez que cargan el dato (por ejemplo, "Indimex Trading" para /clientes/<uuid>),
 * y el componente Breadcrumbs la usa en lugar del segmento crudo.
 *
 * La clave es el segmento exacto de la URL (`params.id`, `params.token`, etc.).
 */
type LabelMap = Record<string, string>;

interface BreadcrumbContextValue {
  labels: LabelMap;
  setLabel: (segment: string, label: string) => void;
  clearLabel: (segment: string) => void;
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | undefined>(undefined);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [labels, setLabels] = useState<LabelMap>({});

  const setLabel = useCallback((segment: string, label: string) => {
    if (!segment || !label) return;
    setLabels((prev) => (prev[segment] === label ? prev : { ...prev, [segment]: label }));
  }, []);

  const clearLabel = useCallback((segment: string) => {
    setLabels((prev) => {
      if (!(segment in prev)) return prev;
      const next = { ...prev };
      delete next[segment];
      return next;
    });
  }, []);

  const value = useMemo(() => ({ labels, setLabel, clearLabel }), [labels, setLabel, clearLabel]);

  return <BreadcrumbContext.Provider value={value}>{children}</BreadcrumbContext.Provider>;
}

export function useBreadcrumbLabels(): LabelMap {
  const ctx = useContext(BreadcrumbContext);
  return ctx?.labels ?? {};
}

/**
 * Hook de conveniencia para páginas de detalle. Registra `label` para `segment`
 * mientras el componente esté montado y el valor sea válido.
 */
export function useRegisterBreadcrumbLabel(segment: string | undefined, label: string | undefined | null) {
  const ctx = useContext(BreadcrumbContext);
  const setLabel = ctx?.setLabel;
  const clearLabel = ctx?.clearLabel;

  useEffect(() => {
    if (!setLabel || !clearLabel || !segment || !label) return;
    setLabel(segment, label);
    return () => clearLabel(segment);
  }, [setLabel, clearLabel, segment, label]);
}
