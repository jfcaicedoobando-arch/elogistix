import React from "react";
import type { Table as TanstackTable } from "@tanstack/react-table";
import type { LucideIcon } from "lucide-react";
import { Table, TableFooter } from "@/components/ui/table";
import { DataTableHeaderRow } from "@/components/shared/dataTable/DataTableHeaderRow";
import { DataTableBody } from "@/components/shared/dataTable/DataTableBody";
import { useHorizontalScrollEdges } from "@/components/shared/dataTable/useHorizontalScrollEdges";
import { HorizontalScrollFades } from "@/components/shared/dataTable/HorizontalScrollFades";
import type { TableDensity } from "@/components/shared/dataTable/types";

interface DataTableContentProps<T> {
  table: TanstackTable<T>;
  tableClassName: string;
  striped: boolean;
  bordered: boolean;
  hoverable: boolean;
  stickyHeader: boolean;
  density: TableDensity;
  isLoading: boolean;
  skeletonRows: number;
  emptyMessage: string;
  emptyHint?: string;
  emptyIcon?: React.ReactNode | LucideIcon;
  emptyState?: React.ReactNode;
  rowClassName?: (item: T) => string;
  onRowClick?: (item: T) => void;
  onRowMouseEnter?: (item: T) => void;
  getRowHref?: (item: T) => string | null;
  getRowAriaLabel?: (item: T) => string;
  renderedFooter: React.ReactNode;
  showFooter: boolean;
}

export function DataTableContent<T>(props: DataTableContentProps<T>) {
  const {
    table, tableClassName, striped, bordered, hoverable, stickyHeader,
    density, isLoading, skeletonRows, emptyMessage, emptyHint, emptyIcon,
    emptyState, rowClassName, onRowClick, onRowMouseEnter, getRowHref,
    getRowAriaLabel, renderedFooter, showFooter,
  } = props;

  const { ref: scrollRef, atStart, atEnd, overflowing } = useHorizontalScrollEdges<HTMLDivElement>();

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        data-testid="datatable-scroll"
        className="relative w-full overflow-x-auto rounded-md [scrollbar-width:thin]"
      >
        <Table className={tableClassName}>
          <DataTableHeaderRow table={table} striped={striped} bordered={bordered} stickyHeader={stickyHeader} />
          <DataTableBody
            table={table}
            isLoading={isLoading}
            skeletonRows={skeletonRows}
            density={density}
            striped={striped}
            hoverable={hoverable}
            bordered={bordered}
            emptyMessage={emptyMessage}
            emptyHint={emptyHint}
            emptyIcon={emptyIcon}
            emptyState={emptyState}
            rowClassName={rowClassName}
            onRowClick={onRowClick}
            onRowMouseEnter={onRowMouseEnter}
            getRowHref={getRowHref}
            getRowAriaLabel={getRowAriaLabel}
          />
          {showFooter && <TableFooter>{renderedFooter}</TableFooter>}
        </Table>
      </div>
      <HorizontalScrollFades overflowing={overflowing} atStart={atStart} atEnd={atEnd} />
    </div>
  );
}
