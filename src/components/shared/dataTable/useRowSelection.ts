import { useCallback, useMemo, useState } from "react";

/**
 * useRowSelection — estado controlado de selección multi-fila para DataTable.
 * El consumidor pasa `selectedIds` + `onSelectionChange` al DataTable.
 */
export interface RowSelectionApi {
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  toggle: (id: string) => void;
  toggleAll: (ids: string[]) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
  selectedCount: number;
}

export function useRowSelection(): RowSelectionApi {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const onSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedIds(new Set(ids));
  }, []);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const allIn = ids.length > 0 && ids.every((id) => prev.has(id));
      if (allIn) {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  return useMemo(
    () => ({ selectedIds, onSelectionChange, toggle, toggleAll, clear, isSelected, selectedCount: selectedIds.size }),
    [selectedIds, onSelectionChange, toggle, toggleAll, clear, isSelected],
  );
}
