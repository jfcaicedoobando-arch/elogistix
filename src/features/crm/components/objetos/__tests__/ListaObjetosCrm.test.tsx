import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";

const { query, scoring } = vi.hoisted(() => ({ query: vi.fn(), scoring: vi.fn() }));
vi.mock("@/features/crm/hooks/useObjetosCrm", () => ({ useListaObjetosCrm: query }));
vi.mock("@/features/crm/hooks/useScoringCrm", () => ({ usePuntajes: scoring }));
vi.mock("@/hooks/shared", () => ({ useDebounce: (v: string) => v }));
import { ListaObjetosCrm } from "../ListaObjetosCrm";

beforeEach(() => {
  vi.clearAllMocks();
  scoring.mockReturnValue({ data: new Map() });
});
function LocationProbe() { return <output aria-label="Ruta actual">{useLocation().pathname}</output>; }
const show = (objeto: "contacto" | "empresa" = "contacto", searchParams = "") => render(<NuqsTestingAdapter searchParams={searchParams}><MemoryRouter>
  <LocationProbe />
  <ListaObjetosCrm<{ id: string; nombre: string }> objeto={objeto} rutaBase={`/crm/${objeto === "empresa" ? "empresas" : "contactos"}`}
    placeholder="Buscar contacto" columnas={[{ titulo: "Nombre", celda: (f) => f.nombre }]} />
</MemoryRouter></NuqsTestingAdapter>);

describe("ListaObjetosCrm · tabla canónica", () => {
  it("conserva filas y navegación accesible, pagina en servidor sin ordenar una página aislada", () => {
    query.mockReturnValue({ isLoading: false, isError: false, data: { filas: [{ id: "ana", nombre: "Ana Garza" }], total: 60 } });
    show();
    expect(screen.getByRole("columnheader", { name: "Nombre" })).toBeInTheDocument();
    expect(screen.getByText("Ana Garza")).toBeInTheDocument();
    const fila = screen.getByRole("link");
    expect(fila).toHaveAttribute("tabindex", "0");
    fireEvent.keyDown(fila, { key: "Enter" });
    expect(screen.getByLabelText("Ruta actual")).toHaveTextContent("/crm/contactos/ana");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(query).toHaveBeenLastCalledWith("contacto", "", 1, "todas", "todos");
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar contacto" }), { target: { value: "Ana" } });
    expect(query).toHaveBeenLastCalledWith("contacto", "Ana", 0, "todas", "todos");
    expect(screen.queryByRole("button", { name: "Nombre" })).not.toBeInTheDocument();
  });
  it("un error permite reintentar y no presenta un vacío falso", () => {
    const refetch = vi.fn();
    query.mockReturnValue({ isLoading: false, isError: true, refetch });
    show();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(screen.queryByText("Sin resultados.")).not.toBeInTheDocument();
  });
  it("una consulta exitosa sin filas sí presenta el estado vacío", () => {
    query.mockReturnValue({ isLoading: false, isError: false, data: { filas: [], total: 0 } });
    show();
    expect(screen.getByText("Sin resultados.")).toBeInTheDocument();
  });
  it("pasa el estado compartido en la URL a la consulta de empresas", () => {
    query.mockReturnValue({ isLoading: false, isError: false, data: { filas: [], total: 0 } });
    show("empresa", "?estado=Prospecto");
    expect(query).toHaveBeenLastCalledWith("empresa", "", 0, "todas", "Prospecto");
    expect(screen.getByRole("combobox", { name: "Filtrar por estado" })).toHaveTextContent("Prospecto");
  });
  it("no aplica el filtro de empresas al listado de contactos", () => {
    query.mockReturnValue({ isLoading: false, isError: false, data: { filas: [], total: 0 } });
    show("contacto", "?estado=Prospecto");
    expect(query).toHaveBeenLastCalledWith("contacto", "", 0, "todas", "todos");
    expect(screen.queryByRole("combobox", { name: "Filtrar por estado" })).not.toBeInTheDocument();
  });
});
