/**
 * VirtualRowsContainer — contenedor absoluto que mapea las filas visibles
 * del virtualizer a componentes `VirtualRow`. Sin lógica propia: layout puro
 * extraído de `VirtualDataTable.tsx`.
 *
 * Renderizado defensivo: filtramos `virtualItems` quedándonos sólo con los
 * índices cuyo `rows[index]` existe. Esto cubre la ventana entre
 * `virtualizer.getVirtualItems()` (snapshot tomado con el `count` previo) y
 * el render cuando `data` se reduce por un filtro aplicado durante un scroll
 * rápido — sin este guard React revienta con `Cannot read properties of
 * undefined (reading 'id')`. El contenedor NUNCA muta filtros desde el
 * scroll: sólo consume el snapshot inmutable de `rows`.
 */
import { useMemo } from "react";
import type { Row } from "@tanstack/react-table";
import type { Virtualizer, VirtualItem } from "@tanstack/react-virtual";
import { VirtualRow } from "@/components/shared/VirtualRow";

interface VirtualRowsContainerProps<T> {
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualItems: VirtualItem[];
  rows: Row<T>[];
  gridTemplate: string;
  cellPad: string;
  striped: boolean;
  hoverable: boolean;
  onRowClick?: (item: T) => void;
  rowClassName?: (item: T) => string;
}

export function VirtualRowsContainer<T>({
  virtualizer,
  virtualItems,
  rows,
  gridTemplate,
  cellPad,
  striped,
  hoverable,
  onRowClick,
  rowClassName,
}: VirtualRowsContainerProps<T>) {
  // Snapshot inmutable de items renderizables. Si `data` se redujo entre el
  // snapshot del virtualizer y este render, descartamos los índices huérfanos
  // en vez de dejar que React acceda a `rows[vi.index].id` sobre undefined.
  const renderableItems = useMemo(
    () => virtualItems.filter((vi) => rows[vi.index] !== undefined),
    [virtualItems, rows],
  );

  return (
    <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
      {renderableItems.map((vi) => (
        <VirtualRow
          key={rows[vi.index].id}
          row={rows[vi.index]}
          index={vi.index}
          start={vi.start}
          cellPad={cellPad}
          gridTemplate={gridTemplate}
          striped={striped}
          hoverable={hoverable}
          onRowClick={onRowClick}
          rowClassName={rowClassName}
          measureRef={virtualizer.measureElement}
        />
      ))}
    </div>
  );
}
