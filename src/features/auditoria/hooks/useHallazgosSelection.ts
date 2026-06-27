/**
 * Estado de selección múltiple para la tabla de hallazgos.
 * Reglas:
 *  - sólo IDs "seleccionables" (pendientes visibles en la página) pueden quedar marcados.
 *  - `toggleAllVisible` actúa sobre los seleccionables actuales (no cross-page).
 */
import { useCallback, useMemo, useState } from "react";
import { revisionKey } from "@/features/auditoria/hooks/useAuditoriaRevisiones";
import type { AuditoriaRevision, HallazgoAuditoria } from "@/features/auditoria/types";

export function useHallazgosSelection(
  visibles: HallazgoAuditoria[],
  revisiones: Map<string, AuditoriaRevision> | undefined,
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const selectablesEnPagina = useMemo(() => {
    const ids: string[] = [];
    for (const h of visibles) {
      const rev = revisiones?.get(revisionKey(h));
      if (rev?.estado_revision !== "revisado") ids.push(revisionKey(h));
    }
    return ids;
  }, [visibles, revisiones]);

  const clearSelection = useCallback(() => {
    setSelectedIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected =
        selectablesEnPagina.length > 0 &&
        selectablesEnPagina.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        for (const id of selectablesEnPagina) next.delete(id);
      } else {
        for (const id of selectablesEnPagina) next.add(id);
      }
      return next;
    });
  }, [selectablesEnPagina]);

  return {
    selectedIds,
    selectablesEnPagina,
    toggleSelected,
    toggleAllVisible,
    clearSelection,
  };
}
