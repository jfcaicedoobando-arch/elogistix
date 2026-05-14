import { useMemo, useState } from "react";
import type { DataTableColumn, SortDir } from "./types";

interface Args<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  sortMode: "client" | "server";
  controlledSort?: { key: string | null; dir: SortDir };
  onSortChange?: (key: string | null, dir: SortDir) => void;
}

export function useDataTableSort<T>({
  data,
  columns,
  sortMode,
  controlledSort,
  onSortChange,
}: Args<T>) {
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
  const [internalSortDir, setInternalSortDir] = useState<SortDir>("asc");

  const isServer = sortMode === "server";
  const sortKey = isServer ? (controlledSort?.key ?? null) : internalSortKey;
  const sortDir = isServer ? (controlledSort?.dir ?? "asc") : internalSortDir;

  const handleSort = (key: string) => {
    let nextKey: string | null;
    let nextDir: SortDir;
    if (sortKey === key) {
      if (sortDir === "asc") {
        nextKey = key;
        nextDir = "desc";
      } else {
        nextKey = null;
        nextDir = "asc";
      }
    } else {
      nextKey = key;
      nextDir = "asc";
    }
    if (isServer) {
      onSortChange?.(nextKey, nextDir);
    } else {
      setInternalSortKey(nextKey);
      setInternalSortDir(nextDir);
    }
  };

  const sortedData = useMemo(() => {
    if (isServer) return data;
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortable) return data;

    const extract = col.sortValue;
    if (!extract) return data;

    const sorted = [...data].sort((a, b) => {
      const va = extract(a);
      const vb = extract(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb), "es-MX", { sensitivity: "base" });
    });

    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [data, sortKey, sortDir, columns, isServer]);

  return { sortKey, sortDir, handleSort, sortedData };
}
