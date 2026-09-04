/**
 * Regresión (v13.823.75): el buscador global no aclaraba su alcance ni que
 * existe una paleta aparte (Ctrl/Cmd+P) para leads, oportunidades y actividades.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GlobalSearchVacio } from "../GlobalSearch.partes";
import { atajoCrmPalette, esMac } from "@/lib/ui/atajoTeclado";

describe("GlobalSearch · alcance y pista al CRM", () => {
  it("aclara que el buscador cubre embarques, clientes, proveedores y facturas", () => {
    render(<GlobalSearchVacio busquedaFallo={false} />);
    expect(screen.getByText(/No se encontraron resultados/)).toBeInTheDocument();
    expect(
      screen.getByText("Este buscador encuentra embarques, clientes, proveedores y facturas."),
    ).toBeInTheDocument();
  });

  it("muestra la pista de Ctrl/Cmd+P cuando se está dentro del CRM", () => {
    render(<GlobalSearchVacio busquedaFallo={false} enCrm atajoCrm={atajoCrmPalette()} />);
    const hint = screen.getByTestId("global-search-crm-hint");
    expect(hint).toHaveTextContent("Para leads, oportunidades y actividades");
    expect(hint).toHaveTextContent(atajoCrmPalette());
  });

  it("no muestra la pista del CRM cuando no está en una ruta CRM", () => {
    render(<GlobalSearchVacio busquedaFallo={false} enCrm={false} atajoCrm={atajoCrmPalette()} />);
    expect(screen.queryByTestId("global-search-crm-hint")).not.toBeInTheDocument();
  });

  it("atajoCrmPalette refleja la plataforma", () => {
    expect(atajoCrmPalette({ platform: "MacIntel", userAgent: "" })).toBe("⌘P");
    expect(atajoCrmPalette({ platform: "Win32", userAgent: "" })).toBe("Ctrl+P");
    expect(atajoCrmPalette({ platform: "Linux x86_64", userAgent: "" })).toBe("Ctrl+P");
  });
});
