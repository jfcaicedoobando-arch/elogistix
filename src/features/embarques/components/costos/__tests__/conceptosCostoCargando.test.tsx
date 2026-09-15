/**
 * EMB-NEW-05 — mientras la conciliación está cargando, la tarjeta de costos NO
 * debe afirmar "Sin costos directos del embarque".
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ConceptosCostoCard } from "../ConceptosCostoCard";

describe("ConceptosCostoCard · estado de carga", () => {
  it("muestra 'Cargando costos…' y no el vacío mientras carga", () => {
    render(<MemoryRouter><ConceptosCostoCard filas={[]} conceptosCosto={[]} isLoading /></MemoryRouter>);
    expect(screen.getByTestId("costos-cargando")).toBeInTheDocument();
    expect(screen.queryByText(/Sin costos directos del embarque/i)).toBeNull();
  });

  it("muestra el vacío sólo cuando la carga terminó", () => {
    render(<MemoryRouter><ConceptosCostoCard filas={[]} conceptosCosto={[]} /></MemoryRouter>);
    expect(screen.queryByTestId("costos-cargando")).toBeNull();
    expect(screen.getByText(/Sin costos directos del embarque/i)).toBeInTheDocument();
  });
});
