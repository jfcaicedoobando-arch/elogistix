/**
 * useVirtualTableState — hook headless para `VirtualDataTable`.
 *
 * Encapsula la maquinaria que antes vivía inline en `VirtualDataTable.tsx`:
 *   - Instancia de TanStack (vía `useTableInstance`, sort desactivado por
 *     default — las virtualizadas vienen pre-ordenadas del servidor).
 *   - Cálculo memoizado de `gridTemplate` a partir de `meta.width` de las
 *     columnas hoja, con `widthsKey` como clave estable.
 *   - Configuración del virtualizer (`useVirtualizer`) con `estimateSize` y
 *     `measureElement` de identidad estable (necesario para que
 *     `React.memo(VirtualRow)` ahorre re-renders y para no disparar churn de
 *     ResizeObserver). Firefox se exenta de `measureElement` por bug conocido
 *     con sub-pixel sizes.
 *
 * NOTA: este hook NO maneja page/search/pageSize — ese estado vive en
 * `useListPageState` (URL-synced con nuqs) y en los page-state controllers
 * por página. TanStack sigue siendo la única fuente de verdad del orden.
 */
import { useCallback, useMemo, type RefObject } from "react";
import { useVirtualizer, type Virtualizer } from "@tanstack/react-virtual";
import type { ColumnDef, Row, Table } from "@tanstack/react-table";
import { useTableInstance } from "@/components/shared/dataTable/useTableInstance";
import { FLEX_COL, gridTemplateFromWidths } from "@/components/shared/dataTable/gridTemplate";

const isFirefox =
  typeof navigator !== "undefined" && navigator.userAgent.indexOf("Firefox") !== -1;

function measureByBoundingRect(el: HTMLElement): number {
  return el?.getBoundingClientRect().height ?? 0;
}

interface Args<T> {
  data: T[];
  columns: ReadonlyArray<ColumnDef<T, unknown>>;
  rowKey: (item: T) => string;
  parentRef: RefObject<HTMLDivElement | null>;
  estimateRowHeight: number;
  overscan: number;
}

export interface VirtualTableState<T> {
  table: Table<T>;
  rows: Row<T>[];
  virtualizer: Virtualizer<HTMLDivElement, HTMLElement>;
  virtualItems: ReturnType<Virtualizer<HTMLDivElement, HTMLElement>["getVirtualItems"]>;
  gridTemplate: string;
}

export function useVirtualTableState<T>({
  data,
  columns,
  rowKey,
  parentRef,
  estimateRowHeight,
  overscan,
}: Args<T>): VirtualTableState<T> {
  // getRowId estable: si `rowKey` cambia de identidad por render, TanStack
  // no recrea filas porque el id resultante es el mismo, pero estabilizamos
  // la función para evitar trabajo extra en useReactTable.
  const getRowId = useCallback(
    (row: T, index: number) => rowKey(row) ?? String(index),
    [rowKey],
  );

  const table = useTableInstance<T>({
    data,
    columns,
    sortMode: "client",
    enableSorting: false,
    getRowId,
  });

  const rows = table.getRowModel().rows;

  // `widthsKey` resume cada width (o el sentinel default) en un string
  // estable; calculamos `gridTemplate` desde él para evitar capturar la
  // referencia inestable de `leafColumns` dentro del memo.
  const leafColumns = table.getAllLeafColumns();
  const widthsKey = leafColumns
    .map((c) => c.columnDef.meta?.width ?? FLEX_COL)
    .join("\u0001");
  // `meta.width` viene en clases Tailwind (`w-[104px]`, `w-24`), que no son
  // longitudes CSS: hay que traducirlas o el grid se apila en una columna.
  const gridTemplate = useMemo(
    () => gridTemplateFromWidths(widthsKey.split("\u0001")),
    [widthsKey],
  );

  // `measureElement` debe tener identidad estable: `useVirtualizer` la lee
  // en cada opción y una función nueva por render dispara trabajo de
  // re-medición (ResizeObserver churn).
  const measureElement = useMemo(
    () => (isFirefox ? undefined : measureByBoundingRect),
    [],
  );

  const estimateSize = useCallback(() => estimateRowHeight, [estimateRowHeight]);

  // `getItemKey` estable basado en el id de la fila: el virtualizer preserva
  // la identidad del item bajo reordenamientos/filtrados, evitando reciclar
  // alturas medidas de filas equivocadas durante scroll rápido. Cae a
  // `index` defensivamente si `rows[index]` aún no está poblado.
  const getItemKey = useCallback(
    (index: number) => rows[index]?.id ?? index,
    [rows],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
    measureElement,
    getItemKey,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return { table, rows, virtualizer, virtualItems, gridTemplate };
}
