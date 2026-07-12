import { useCallback, useMemo, useState } from "react";
import type { OnChangeFn, RowSelectionState, Updater } from "@tanstack/react-table";

/**
 * useRowSelection — estado controlado de selección multi-fila para DataTable.
 *
 * v13.286.0: internamente respaldado por `RowSelectionState` de TanStack
 * (`Record<string, boolean>`) y expuesto al `<DataTable>` vía
 * `rowSelection` + `onRowSelectionChange`. La API pública (`selectedIds`,
 * `toggle`, `toggleAll`, `clear`, `isSelected`, `selectedCount`) se conserva
 * para no romper call-sites; TanStack es ahora la única fuente de verdad.
 */
export interface RowSelectionApi {
  /** API TanStack — pasar tal cual al `<DataTable>`. */
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  /** API legacy conservada para consumidores existentes. */
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  toggle: (id: string) => void;
  toggleAll: (ids: string[]) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
  selectedCount: number;
}

function resolve<T>(updater: Updater<T>, prev: T): T {
  return typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
}

function toSet(state: RowSelectionState): Set<string> {
  const s = new Set<string>();
  for (const k of Object.keys(state)) if (state[k]) s.add(k);
  return s;
}

export function useRowSelection(): RowSelectionApi {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const onRowSelectionChange: OnChangeFn<RowSelectionState> = useCallback((updater) => {
    setRowSelection((prev) => resolve(updater, prev));
  }, []);

  const onSelectionChange = useCallback((ids: Set<string>) => {
    const next: RowSelectionState = {};
    for (const id of ids) next[id] = true;
    setRowSelection(next);
  }, []);

  const toggle = useCallback((id: string) => {
    setRowSelection((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }, []);

  const toggleAll = useCallback((ids: string[]) => {
    setRowSelection((prev) => {
      const allIn = ids.length > 0 && ids.every((id) => prev[id]);
      const next = { ...prev };
      if (allIn) {
        for (const id of ids) delete next[id];
      } else {
        for (const id of ids) next[id] = true;
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setRowSelection({}), []);

  const selectedIds = useMemo(() => toSet(rowSelection), [rowSelection]);
  const isSelected = useCallback((id: string) => Boolean(rowSelection[id]), [rowSelection]);

  return useMemo(
    () => ({
      rowSelection,
      onRowSelectionChange,
      selectedIds,
      onSelectionChange,
      toggle,
      toggleAll,
      clear,
      isSelected,
      selectedCount: selectedIds.size,
    }),
    [rowSelection, onRowSelectionChange, selectedIds, onSelectionChange, toggle, toggleAll, clear, isSelected],
  );
}
