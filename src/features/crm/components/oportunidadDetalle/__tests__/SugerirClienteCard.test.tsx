import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

let mockRole: string | null = null;
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ effectiveRole: mockRole }),
}));

import { SugerirClienteCard } from "../SugerirClienteCard";

const r = (tipo: string, cliente: string | null) =>
  render(<MemoryRouter><SugerirClienteCard etapaTipo={tipo} clienteId={cliente} /></MemoryRouter>);

describe("SugerirClienteCard", () => {
  it("sugiere crear cliente si está ganada y sin cliente", () => {
    mockRole = "contador";
    r("ganada", null);
    expect(screen.getByRole("link", { name: "Crear cliente" })).toHaveAttribute("href", "/clientes?nuevo=1");
  });
  it("el botón sólo se muestra al rol de contador", () => {
    mockRole = "ejecutivo_cobranza";
    r("ganada", null);
    expect(screen.getByText(/Da de alta la empresa como cliente/)).toBeDefined();
    expect(screen.queryByRole("link", { name: "Crear cliente" })).toBeNull();
  });
  it("no aparece si ya tiene cliente o sigue abierta", () => {
    mockRole = "contador";
    const { container } = r("ganada", "c1");
    expect(container).toBeEmptyDOMElement();
    r("abierta", null);
    expect(screen.queryByText("Crear cliente")).toBeNull();
  });
});
