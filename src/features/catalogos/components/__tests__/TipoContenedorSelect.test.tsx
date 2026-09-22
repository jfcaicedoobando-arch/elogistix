/**
 * P1 — el selector debe permanecer controlado (value siempre string) y mostrar
 * el nombre canónico incluso cuando el ID guardado es un duplicado legacy.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

const LEGACY_HC = "99999999-9999-9999-9999-999999999999";
const TIPO_HC = {
  id: "33333333-3333-3333-3333-333333333333",
  name: "40' High Cube",
  code: "40HC",
  idsEquivalentes: ["33333333-3333-3333-3333-333333333333", LEGACY_HC],
};
const TIPO_DRY = {
  id: "44444444-4444-4444-4444-444444444444",
  name: "20' Dry",
  code: "20DV",
  idsEquivalentes: ["44444444-4444-4444-4444-444444444444"],
};

vi.mock("@/features/catalogos/hooks", () => ({
  useTiposContenedor: () => ({ data: [TIPO_DRY, TIPO_HC] }),
}));

import { TipoContenedorSelect } from "../TipoContenedorSelect";

const onChange = vi.fn();
beforeEach(() => onChange.mockReset());

describe("TipoContenedorSelect", () => {
  it("muestra el placeholder cuando el valor es vacío", () => {
    render(<TipoContenedorSelect id="t" value="" onChange={onChange} />);
    expect(screen.getByLabelText("t")).toHaveTextContent("Selecciona");
  });

  it("muestra el nombre canónico cuando el valor es un duplicado legacy", () => {
    render(<TipoContenedorSelect id="t" value={LEGACY_HC} onChange={onChange} />);
    expect(screen.getByLabelText("t")).toHaveTextContent("40' High Cube");
  });

  it("selecciona con mouse y emite el ID canónico", async () => {
    render(<TipoContenedorSelect id="t" value="" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("t"));
    const lista = within(await screen.findByRole("listbox"));
    fireEvent.click(lista.getByText("40' High Cube"));
    expect(onChange).toHaveBeenCalledWith(TIPO_HC.id);
  });

  it("selecciona con teclado y emite el ID canónico", async () => {
    render(<TipoContenedorSelect id="t" value="" onChange={onChange} />);
    const trigger = screen.getByLabelText("t");
    fireEvent.keyDown(trigger, { key: "Enter" });
    const listbox = await screen.findByRole("listbox");
    const opciones = within(listbox).getAllByRole("option");
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(opciones[1], { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(TIPO_HC.id);
  });
});
