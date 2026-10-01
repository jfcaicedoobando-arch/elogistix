import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SugerirClienteCard } from "../SugerirClienteCard";

const r = (tipo: string, cliente: string | null) =>
  render(<MemoryRouter><SugerirClienteCard etapaTipo={tipo} clienteId={cliente} /></MemoryRouter>);

describe("SugerirClienteCard", () => {
  it("sugiere crear cliente si está ganada y sin cliente", () => {
    r("ganada", null);
    expect(screen.getByRole("link", { name: "Crear cliente" })).toHaveAttribute("href", "/clientes?nuevo=1");
  });
  it("no aparece si ya tiene cliente o sigue abierta", () => {
    const { container } = r("ganada", "c1");
    expect(container).toBeEmptyDOMElement();
    r("abierta", null);
    expect(screen.queryByText("Crear cliente")).toBeNull();
  });
});
