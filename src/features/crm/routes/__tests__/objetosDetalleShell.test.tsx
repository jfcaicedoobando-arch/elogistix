import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@/features/crm/hooks/useObjetosCrm", () => ({
  useEmpresaCrm: query, useContactoCrm: query,
  usePasarAProspecto: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/shared", () => ({ useDocumentTitle: vi.fn(), usePermissions: () => ({ canEditCrm: false }) }));
vi.mock("@/features/crm/components/objetos/PropiedadesCard", () => ({ PropiedadesCard: () => <div>Propiedades</div> }));
vi.mock("@/features/crm/components/objetos/VinculosCard", () => ({ VinculosCard: () => <div>Vínculos</div> }));
vi.mock("@/features/crm/components/scoring/DesglosePuntajeCard", () => ({ DesglosePuntajeCard: () => <div>Puntaje</div> }));

import Empresa from "../EmpresaDetalle";
import Contacto from "../ContactoDetalle";

beforeEach(() => vi.clearAllMocks());
describe.each([
  { nombre: "Empresa", Component: Empresa, lista: "/crm/empresas", error: "No se pudo cargar la empresa" },
  { nombre: "Contacto", Component: Contacto, lista: "/crm/contactos", error: "No se pudo cargar el contacto" },
])("Ficha $nombre", ({ nombre, Component, lista, error }) => {
  it("mantiene título y regreso durante la carga, sin montar consultas dependientes", () => {
    query.mockReturnValue({ isLoading: true, isError: false, data: undefined, refetch: vi.fn() });
    render(<MemoryRouter><Component /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1, name: nombre })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver" })).toHaveAttribute("href", lista);
    expect(screen.queryByText("Propiedades")).not.toBeInTheDocument();
  });
  it("mantiene navegación y ofrece reintento cuando falla la consulta", () => {
    const refetch = vi.fn();
    query.mockReturnValue({ isLoading: false, isError: true, data: undefined, refetch });
    render(<MemoryRouter><Component /></MemoryRouter>);
    expect(screen.getByRole("heading", { level: 1, name: nombre })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver" })).toHaveAttribute("href", lista);
    expect(screen.getByText(error)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledOnce();
  });
  it("distingue registro ausente de carga fallida", () => {
    query.mockReturnValue({ isLoading: false, isError: false, data: null, refetch: vi.fn() });
    render(<MemoryRouter><Component /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Volver" })).toHaveAttribute("href", lista);
    expect(screen.queryByRole("button", { name: /reintentar/i })).not.toBeInTheDocument();
    expect(screen.queryByText(error)).not.toBeInTheDocument();
  });
});
