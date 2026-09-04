/**
 * Regresión v13.823.77 — al vaciar el buscador de un listado el filtro debe
 * desaparecer (chip, estado y parámetro `q`), no sólo con "Quitar búsqueda".
 */
import { describe, it, expect } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";

const PLACEHOLDER = "Buscar por empresa, contacto o email…";

function Harness() {
  const [search, setSearch] = useState("QA Visual");
  return (
    <>
      <UnifiedFiltersBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={PLACEHOLDER}
        chips={[]}
        activeCount={search ? 1 : 0}
        onClearAll={() => setSearch("")}
      />
      <div data-testid="estado">{`q=${search}|activos=${search ? 1 : 0}`}</div>
    </>
  );
}

function renderConBusqueda() {
  render(<Harness />);
  expect(screen.getByText("Búsqueda: QA Visual")).toBeInTheDocument();
  return screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
}

function esperarSinBusqueda(input: HTMLInputElement) {
  expect(input.value).toBe("");
  expect(screen.queryByText(/^Búsqueda:/)).not.toBeInTheDocument();
  expect(screen.getByTestId("estado").textContent).toBe("q=|activos=0");
}

describe("UnifiedFiltersBar · limpiar búsqueda", () => {
  it("limpia el filtro cuando el texto se borra (change)", async () => {
    const input = renderConBusqueda();
    await act(async () => { fireEvent.change(input, { target: { value: "" } }); });
    esperarSinBusqueda(input);
  });

  it("limpia el filtro con el evento nativo input (borrado programático)", async () => {
    const input = renderConBusqueda();
    await act(async () => {
      input.value = "";
      fireEvent.input(input);
    });
    esperarSinBusqueda(input);
  });

});
