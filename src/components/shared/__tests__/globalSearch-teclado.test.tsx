/**
 * Candado de navegación con teclado en los resultados del buscador global:
 * flechas ↑/↓ mueven la selección (con vuelta al inicio/fin) y Enter abre el
 * resultado seleccionado.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Command, CommandInput, CommandList } from "@/components/ui/command";
import { GlobalSearchGrupo } from "../GlobalSearch.partes";
import type { GlobalSearchResult } from "@/hooks/shared";

const items: GlobalSearchResult[] = [
  { id: "1", type: "embarque", label: "EXP-001", sublabel: "BL-111", url: "/embarques/1" },
  { id: "2", type: "embarque", label: "EXP-002", sublabel: "BL-222", url: "/embarques/2" },
  { id: "3", type: "embarque", label: "EXP-003", sublabel: "BL-333", url: "/embarques/3" },
];

function renderBuscador(onSelect: (url: string, title?: string) => void) {
  render(
    <Command shouldFilter={false} loop>
      <CommandInput placeholder="Buscar…" />
      <CommandList>
        <GlobalSearchGrupo type="embarque" items={items} termino="" onSelect={onSelect} />
      </CommandList>
    </Command>,
  );
  return screen.getByPlaceholderText("Buscar…");
}

const seleccionado = () =>
  document.querySelector('[cmdk-item][data-selected="true"]')?.textContent ?? "";

describe("GlobalSearch — navegación con teclado", () => {
  it("selecciona el primer resultado al abrir", () => {
    renderBuscador(vi.fn());
    expect(seleccionado()).toContain("EXP-001");
  });

  it("baja con la flecha abajo", () => {
    const input = renderBuscador(vi.fn());
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(seleccionado()).toContain("EXP-002");
  });

  it("sube con la flecha arriba", () => {
    const input = renderBuscador(vi.fn());
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(seleccionado()).toContain("EXP-002");
  });

  it("da la vuelta al final de la lista (loop)", () => {
    const input = renderBuscador(vi.fn());
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(seleccionado()).toContain("EXP-001");
  });

  it("abre el resultado seleccionado con Enter", () => {
    const onSelect = vi.fn();
    const input = renderBuscador(onSelect);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("/embarques/2", "EXP-002");
  });
});
