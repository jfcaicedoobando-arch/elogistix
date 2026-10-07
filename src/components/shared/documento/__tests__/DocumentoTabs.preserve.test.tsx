/** @vitest-environment jsdom */
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, it, expect } from "vitest";
import { DocumentoTabs } from "../DocumentoTabs";

function Editor() {
  const [value, setValue] = useState("inicial");
  return <input aria-label="Captura" value={value} onChange={(e) => setValue(e.target.value)} />;
}
const tab = (name: string) => fireEvent.keyDown(screen.getByRole("tab", { name }), { key: "Enter" });
function setup(keepMounted = false, url = "/") {
  render(<MemoryRouter initialEntries={[url]}><DocumentoTabs tabs={[
    { id: "editar", label: "Editar", keepMounted, content: <Editor /> },
    { id: "otro", label: "Otro", content: <span>Lectura</span> },
  ]} /></MemoryRouter>);
}
describe("DocumentoTabs keepMounted opt-in", () => {
  it("por defecto sigue desmontando y sólo hay un panel visible", () => {
    setup(); fireEvent.change(screen.getByRole("textbox"), { target: { value: "edición" } });
    tab("Otro"); expect(screen.queryByRole("textbox", { hidden: true })).not.toBeInTheDocument();
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    tab("Editar"); expect(screen.getByRole("textbox")).toHaveValue("inicial");
  });
  it("conserva la captura visitada, oculta el panel y lo excluye de accesibilidad/foco", () => {
    setup(true); fireEvent.change(screen.getByRole("textbox"), { target: { value: "edición" } });
    tab("Otro"); expect(screen.getByRole("textbox", { hidden: true })).not.toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    tab("Editar"); expect(screen.getByRole("textbox")).toHaveValue("edición");
  });
  it("no monta el editor opt-in si la URL abre otra pestaña", () => {
    setup(true, "/?tab=otro"); expect(screen.queryByRole("textbox", { hidden: true })).not.toBeInTheDocument();
    tab("Editar"); expect(screen.getByRole("textbox")).toHaveValue("inicial");
  });
});
