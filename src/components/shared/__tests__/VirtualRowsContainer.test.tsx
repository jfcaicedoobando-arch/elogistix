/**
 * Regression: bajo scroll rápido el virtualizer puede entregar
 * `virtualItems` con índices fuera de rango cuando `data` se reduce por un
 * filtro recién aplicado. El contenedor debe descartarlos defensivamente.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { Row } from "@tanstack/react-table";
import type { Virtualizer, VirtualItem } from "@tanstack/react-virtual";
import { VirtualRowsContainer } from "@/components/shared/VirtualRowsContainer";

vi.mock("@/components/shared/VirtualRow", () => ({
  VirtualRow: ({ row }: { row: { id: string } }) => (
    <div data-testid="vrow" data-rowid={row.id} />
  ),
}));

afterEach(() => cleanup());

function fakeRow(id: string): Row<{ id: string }> {
  return { id } as unknown as Row<{ id: string }>;
}

function fakeVirtualizer(): Virtualizer<HTMLDivElement, HTMLElement> {
  return {
    getTotalSize: () => 1000,
    measureElement: () => 0,
  } as unknown as Virtualizer<HTMLDivElement, HTMLElement>;
}

function vi_(index: number): VirtualItem {
  return { index, start: index * 40, size: 40, key: index, end: 0, lane: 0 } as unknown as VirtualItem;
}

describe("VirtualRowsContainer — renderizado defensivo", () => {
  it("descarta virtualItems con índice fuera de rango sin lanzar", () => {
    const rows = [fakeRow("a"), fakeRow("b")];
    // Snapshot stale: virtualizer pidió índices 0..4 pero rows ahora sólo tiene 2.
    const items = [vi_(0), vi_(1), vi_(2), vi_(3), vi_(4)];

    const { getAllByTestId } = render(
      <VirtualRowsContainer
        virtualizer={fakeVirtualizer()}
        virtualItems={items}
        rows={rows}
        gridTemplate="1fr"
        cellPad="px-2"
        striped
        hoverable
      />,
    );

    const rendered = getAllByTestId("vrow");
    expect(rendered).toHaveLength(2);
    expect(rendered.map((el) => el.getAttribute("data-rowid"))).toEqual(["a", "b"]);
  });

  it("renderiza cero filas sin romper si todos los índices son inválidos", () => {
    const { queryAllByTestId } = render(
      <VirtualRowsContainer
        virtualizer={fakeVirtualizer()}
        virtualItems={[vi_(5), vi_(6)]}
        rows={[]}
        gridTemplate="1fr"
        cellPad="px-2"
        striped
        hoverable
      />,
    );
    expect(queryAllByTestId("vrow")).toHaveLength(0);
  });
});
