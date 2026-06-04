/**
 * VirtualRowsContainer — contenedor absoluto que mapea las filas visibles
 * del virtualizer a componentes `VirtualRow`. Sin lógica propia: layout puro
 * extraído de `VirtualDataTable.tsx`.
 */
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
  return (
    <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
      {virtualItems.map((vi) => (
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
