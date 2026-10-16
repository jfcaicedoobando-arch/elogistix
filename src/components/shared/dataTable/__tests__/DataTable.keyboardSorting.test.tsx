// @vitest-environment jsdom
import { useState, type FormEvent, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render as rtlRender, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { DataTable, defineColumns, type SortDir } from "@/components/shared/DataTable";
import { DataTableHeaderRow } from "../DataTableHeaderRow";
import { useTableInstance } from "../useTableInstance";

interface RecordRow {
  id: string;
  name: string;
}

const rows: RecordRow[] = [
  { id: "z", name: "Zoe" },
  { id: "a", name: "Ana" },
  { id: "l", name: "Luis" },
];

const columns = defineColumns<RecordRow>([
  { id: "name", header: "Nombre", accessorFn: (row) => row.name, enableSorting: true },
  { id: "disabled", header: "Deshabilitado", accessorFn: (row) => row.id, enableSorting: false },
  { id: "static", header: "Detalle", cell: ({ row }) => row.original.id },
]);

const render = (ui: ReactElement) => rtlRender(ui, {
  wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter>,
});

type Activation = "Enter" | "Space" | "click";

/**
 * jsdom dispatches key events but does not run the browser's default button
 * activation. Model that native action explicitly: Enter clicks on keydown,
 * Space clicks on keyup. A custom key handler or bubbling th handler would
 * therefore cause the cycle/count assertions below to fail with two toggles.
 */
function activate(button: HTMLElement, activation: Activation) {
  expect(button).toBeInstanceOf(HTMLButtonElement);
  expect(button).toHaveAttribute("type", "button");
  button.focus();
  expect(button).toHaveFocus();

  if (activation === "click") {
    fireEvent.click(button);
  } else {
    const key = activation === "Space" ? " " : "Enter";
    const code = activation === "Space" ? "Space" : "Enter";
    const downAllowed = fireEvent.keyDown(button, { key, code });
    if (activation === "Enter" && downAllowed) fireEvent.click(button, { detail: 0 });
    const upAllowed = fireEvent.keyUp(button, { key, code });
    if (activation === "Space" && downAllowed && upAllowed) fireEvent.click(button, { detail: 0 });
  }

  expect(button).toHaveFocus();
}

function rowOrder() {
  return screen.getAllByRole("row").slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent);
}

function ServerTable({
  data = rows,
  onSortChange,
}: {
  data?: RecordRow[];
  onSortChange: (key: string | null, dir: SortDir) => void;
}) {
  const [sort, setSort] = useState<{ key: string | null; dir: SortDir }>({ key: null, dir: "asc" });
  return <DataTable columns={columns} data={data} rowKey={(row) => row.id}
    sortMode="server" controlledSort={sort} onSortChange={(key, dir) => {
      onSortChange(key, dir);
      setSort({ key, dir });
    }} />;
}

describe("DataTable - activación semántica del orden", () => {
  it.each<Activation>(["Enter", "Space", "click"])(
    "client: %s avanza una sola vez y conserva el foco durante asc/desc/none",
    (activation) => {
      render(<DataTable columns={columns} data={rows} rowKey={(row) => row.id} />);
      const header = screen.getByRole("columnheader", { name: "Nombre" });
      const button = within(header).getByRole("button", { name: "Nombre" });
      expect(header).toHaveAttribute("scope", "col");
      expect(header).toHaveAttribute("aria-sort", "none");
      expect(button).toHaveClass("focus-visible:ring-2", "focus-visible:ring-ring");
      expect(rowOrder()).toEqual(["Zoe", "Ana", "Luis"]);

      activate(button, activation);
      expect(header).toHaveAttribute("aria-sort", "ascending");
      expect(rowOrder()).toEqual(["Ana", "Luis", "Zoe"]);
      activate(button, activation);
      expect(header).toHaveAttribute("aria-sort", "descending");
      expect(rowOrder()).toEqual(["Zoe", "Luis", "Ana"]);
      activate(button, activation);
      expect(header).toHaveAttribute("aria-sort", "none");
      expect(rowOrder()).toEqual(["Zoe", "Ana", "Luis"]);
    },
  );

  it.each<Activation>(["Enter", "Space", "click"])(
    "server: %s emite un único callback por activación sin reordenar la página recibida",
    (activation) => {
      const onSortChange = vi.fn();
      const { rerender } = render(<ServerTable onSortChange={onSortChange} />);
      const header = screen.getByRole("columnheader", { name: "Nombre" });
      const button = within(header).getByRole("button", { name: "Nombre" });

      activate(button, activation);
      expect(onSortChange).toHaveBeenCalledTimes(1);
      expect(onSortChange).toHaveBeenLastCalledWith("name", "asc");
      expect(header).toHaveAttribute("aria-sort", "ascending");
      expect(rowOrder()).toEqual(["Zoe", "Ana", "Luis"]);
      activate(button, activation);
      expect(onSortChange).toHaveBeenCalledTimes(2);
      expect(onSortChange).toHaveBeenLastCalledWith("name", "desc");
      expect(header).toHaveAttribute("aria-sort", "descending");
      expect(rowOrder()).toEqual(["Zoe", "Ana", "Luis"]);
      activate(button, activation);
      expect(onSortChange).toHaveBeenCalledTimes(3);
      expect(onSortChange).toHaveBeenLastCalledWith(null, "asc");
      expect(header).toHaveAttribute("aria-sort", "none");

      rerender(<ServerTable data={[rows[2], rows[0], rows[1]]} onSortChange={onSortChange} />);
      expect(rowOrder()).toEqual(["Luis", "Zoe", "Ana"]);
      expect(button).toHaveFocus();
      expect(onSortChange).toHaveBeenCalledTimes(3);
    },
  );

  it.each(["client", "server"] as const)(
    "%s: headers no ordenables y teclas ajenas no cambian el orden",
    (sortMode) => {
      const onSortChange = vi.fn();
      render(sortMode === "server" ? <ServerTable onSortChange={onSortChange} />
        : <DataTable columns={columns} data={rows} rowKey={(row) => row.id} />);

      for (const name of ["Deshabilitado", "Detalle"]) {
        const header = screen.getByRole("columnheader", { name });
        expect(within(header).queryByRole("button")).not.toBeInTheDocument();
        expect(header).not.toHaveAttribute("aria-sort");
        fireEvent.keyDown(header, { key: "Enter" });
        fireEvent.keyUp(header, { key: "Enter" });
        fireEvent.keyDown(header, { key: " " });
        fireEvent.keyUp(header, { key: " " });
        fireEvent.click(header);
      }

      const header = screen.getByRole("columnheader", { name: "Nombre" });
      const button = within(header).getByRole("button", { name: "Nombre" });
      button.focus();
      for (const key of ["Escape", "ArrowDown", "a"]) {
        fireEvent.keyDown(button, { key });
        fireEvent.keyUp(button, { key });
      }
      // The th itself has no sort handler; only its native button activates it.
      fireEvent.click(header);
      expect(header).toHaveAttribute("aria-sort", "none");
      expect(rowOrder()).toEqual(["Zoe", "Ana", "Luis"]);
      expect(onSortChange).not.toHaveBeenCalled();
    },
  );

  it("no crea controles de orden cuando la tabla deshabilita sorting", () => {
    const onSortChange = vi.fn();
    function DisabledTable() {
      const table = useTableInstance({
        data: rows, columns, sortMode: "server", enableSorting: false,
        controlledSort: { key: null, dir: "asc" }, onSortChange,
      });
      return <table><DataTableHeaderRow table={table} striped={false} bordered={false} /></table>;
    }
    render(<DisabledTable />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    for (const header of screen.getAllByRole("columnheader")) {
      expect(header).not.toHaveAttribute("aria-sort");
      fireEvent.click(header);
      fireEvent.keyDown(header, { key: "Enter" });
      fireEvent.keyUp(header, { key: "Enter" });
    }
    expect(onSortChange).not.toHaveBeenCalled();
  });

  it("el botón de ordenación no envía un formulario contenedor", () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    render(<form onSubmit={onSubmit}>
      <DataTable columns={columns} data={rows} rowKey={(row) => row.id} />
    </form>);
    activate(screen.getByRole("button", { name: "Nombre" }), "Enter");
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("columnheader", { name: "Nombre" })).toHaveAttribute("aria-sort", "ascending");
  });
});
