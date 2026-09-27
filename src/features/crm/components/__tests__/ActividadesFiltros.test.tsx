import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ActividadesFiltros } from "../actividades/ActividadesFiltros";

const filters = { tipo: "todos", estado: "pendientes", responsable: "todos" };

describe("etiquetas de filtros de la agenda", () => {
  it("tiene nombres accesibles y distingue todos los tipos de todos los responsables", () => {
    render(<ActividadesFiltros filters={filters} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Tipo" })).toHaveTextContent("Todos los tipos");
    expect(screen.getByRole("combobox", { name: "Estado" })).toHaveTextContent("Pendientes");
    expect(screen.getByRole("combobox", { name: "Responsable" })).toHaveTextContent("Todos los responsables");
  });

  it("cambia el filtro correcto con teclado", async () => {
    const onChange = vi.fn();
    render(<ActividadesFiltros filters={filters} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Responsable" }), { key: "ArrowDown" });
    fireEvent.keyDown(await screen.findByRole("option", { name: "Mis actividades" }), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("responsable", "mias");
  });

  it("no duplica IDs aunque se rendericen dos instancias", () => {
    render(<><ActividadesFiltros filters={filters} onChange={vi.fn()} /><ActividadesFiltros filters={filters} onChange={vi.fn()} /></>);
    const campos = screen.getAllByRole("combobox");
    expect(new Set(campos.map(c => c.id)).size).toBe(6);
    for (const nombre of ["Tipo", "Estado", "Responsable"]) expect(screen.getAllByRole("combobox", { name: nombre })).toHaveLength(2);
  });
});
