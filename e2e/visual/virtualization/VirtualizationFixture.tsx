import { useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useVirtualTableState } from "@/components/shared/dataTable/useVirtualTableState";
import { VirtualRow } from "@/components/shared/VirtualRow";
import { VirtualTimeline } from "@/components/shared/bitacora/VirtualTimeline";
import type { EntradaBitacora } from "@/types/bitacora";

type SyntheticRow = { id: string; height: number };
const rows: SyntheticRow[] = Array.from({ length: 240 }, (_, index) => ({
  id: `table-${String(index).padStart(3, "0")}`,
  height: [40, 88, 144, 64][index % 4],
}));
const columns: ColumnDef<SyntheticRow, unknown>[] = [{
  id: "record", header: "Registro sintético",
  cell: ({ row }) => (
    <div data-row-id={row.original.id} style={{ height: row.original.height }}>
      {row.original.id}
    </div>
  ),
}];
const rowKey = (row: SyntheticRow) => row.id;
const activities: EntradaBitacora[] = rows.map((_, index) => ({
  id: `timeline-${String(index).padStart(3, "0")}`,
  usuario_id: "synthetic-user", usuario_email: "synthetic@example.invalid",
  accion: "crear", modulo: "embarques",
  entidad_id: `timeline-${String(index).padStart(3, "0")}`,
  entidad_nombre: `timeline-${String(index).padStart(3, "0")}`,
  // The real FilaEntrada wraps this context, producing actual variable heights.
  detalles: { cliente: "Carga sintética para prueba de altura. ".repeat([1, 3, 8, 2][index % 4]) },
  created_at: "2026-10-01T12:00:00Z",
}));

function TableFixture({ data }: { data: SyntheticRow[] }) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const { rows: model, virtualItems, virtualizer, gridTemplate } = useVirtualTableState({
    data, columns, rowKey, parentRef, estimateRowHeight: 85, overscan: 5,
  });
  return (
    <div ref={parentRef} data-testid="table-scroll" role="table"
      aria-label="Tabla virtual sintética" style={{ height: 360, overflow: "auto" }}>
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualItems.map(item => (
          <VirtualRow key={model[item.index].id} row={model[item.index]}
            index={item.index} start={item.start} cellPad="py-0"
            gridTemplate={gridTemplate} striped={false} hoverable={false}
            measureRef={virtualizer.measureElement} />
        ))}
      </div>
    </div>
  );
}

export function VirtualizationFixture() {
  const timeline = new URLSearchParams(window.location.search).get("case") === "timeline";
  const [filtered, setFiltered] = useState(false);
  const [generation, setGeneration] = useState(0);
  // Simulate a server returning a smaller, differently ordered result set.
  // No sorting implementation or virtualizer is replaced by the fixture.
  const visibleRows = filtered ? rows.filter((_, index) => index % 2 === 0).reverse() : rows;
  const visibleActivities = filtered
    ? activities.filter((_, index) => index % 2 === 0).reverse() : activities;
  return (
    <main className="p-4 space-y-4" style={{ width: 560 }}>
      <h1>Virtualización sintética: {timeline ? "bitácora" : "tabla"}</h1>
      <div className="flex gap-4">
        <button type="button" data-testid="filter" onClick={() => setFiltered(value => !value)}>
          Filtrar pares e invertir
        </button>
        <button type="button" data-testid="remount" onClick={() => setGeneration(value => value + 1)}>
          Remontar consumidor
        </button>
      </div>
      <output data-testid="mode">{filtered ? "filtered-reversed" : "all"}</output>
      <output data-testid="generation">{generation}</output>
      {timeline ? (
        <div data-testid="timeline-host">
          <VirtualTimeline key={generation} actividades={visibleActivities}
            mostrarUsuario={false} maxHeight={360} />
        </div>
      ) : <TableFixture key={generation} data={visibleRows} />}
    </main>
  );
}
