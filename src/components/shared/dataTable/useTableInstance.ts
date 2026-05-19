/**
 * useTableInstance — wrapper de `useReactTable` que centraliza:
 *   - Sort controlado vs. interno, sin `useState` ni `useMemo` paralelos.
 *   - Modo server (`manualSorting: true`) cuando el caller pasa
 *     `controlledSort` + `onSortChange` (la fuente de verdad vive en
 *     `useEmbarquesPageState`, `useCotizacionesPageState`, etc., y a su vez
 *     en los RPC de Supabase). En modo client, TanStack ordena con
 *     `getSortedRowModel`.
 *
 * Regla del proyecto: TanStack es la única fuente de verdad del orden.
 * No reintroducir `useMemo` que ordene `data` ni `useEffect` que rehidrate
 * el estado de sort desde fuera del page-state.
 */
import { useMemo } from "react";
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
  type Updater,
} from "@tanstack/react-table";
import type { SortDir } from "./types";

export interface ControlledSort {
  key: string | null;
  dir: SortDir;
}

interface Args<T> {
  data: T[];
  columns: ReadonlyArray<ColumnDef<T, unknown>>;
  sortMode: "client" | "server";
  controlledSort?: ControlledSort;
  onSortChange?: (key: string | null, dir: SortDir) => void;
  /** Identificador estable para que TanStack no recree filas en cada render. */
  getRowId?: (row: T, index: number) => string;
  /** Si false, omite `getSortedRowModel` (útil para tablas virtualizadas que
   *  no necesitan sort interno). */
  enableSorting?: boolean;
}

function fromControlled(sort: ControlledSort | undefined): SortingState {
  if (!sort?.key) return [];
  return [{ id: sort.key, desc: sort.dir === "desc" }];
}

function resolveUpdater(updater: Updater<SortingState>, prev: SortingState): SortingState {
  return typeof updater === "function" ? updater(prev) : updater;
}

export function useTableInstance<T>({
  data,
  columns,
  sortMode,
  controlledSort,
  onSortChange,
  getRowId,
  enableSorting = true,
}: Args<T>) {
  const isServer = sortMode === "server";

  // Estabilizar identidad — los callers definen el arreglo a nivel de módulo
  // o lo memorizan; este useMemo es defensivo para evitar recrear el motor
  // si el caller redefine el arreglo por render.
  const columnDefs = useMemo(() => columns as ColumnDef<T, unknown>[], [columns]);

  const sortingState = useMemo(
    () => (isServer ? fromControlled(controlledSort) : undefined),
    [isServer, controlledSort],
  );

  const handleSortingChange: OnChangeFn<SortingState> | undefined = isServer
    ? (updater) => {
        const prev = fromControlled(controlledSort);
        const next = resolveUpdater(updater, prev);
        if (next.length === 0) onSortChange?.(null, "asc");
        else onSortChange?.(next[0].id, next[0].desc ? "desc" : "asc");
      }
    : undefined;

  return useReactTable<T>({
    data,
    columns: columnDefs,
    getRowId,
    enableSorting,
    manualSorting: isServer,
    state: isServer ? { sorting: sortingState } : undefined,
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting && !isServer ? getSortedRowModel() : undefined,
  });
}
