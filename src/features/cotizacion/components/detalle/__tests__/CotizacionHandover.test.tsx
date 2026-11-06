import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CotizacionRow } from "@/features/cotizacion/types";
const mocks = vi.hoisted(() => ({
  proveedores: { data: null as null | { agente: string; naviera: string }, isError: false, refetch: vi.fn() },
  visible: true,
  query: { isLoading: false, isError: false, data: null as null | { created_at: string }, refetch: vi.fn() },
}));
vi.mock("@/features/cotizacion/hooks/useCotizacionHandover", () => ({ useCotizacionHandover: () => mocks }));
vi.mock("@/features/catalogos/hooks", () => ({ useTiposContenedor: () => ({ data: [] }) }));
vi.mock("@/features/cotizacion/hooks/useHandoverProveedores", () => ({ useHandoverProveedores: () => mocks.proveedores }));
import { CotizacionHandover } from "../CotizacionHandover";
const cotizacion = {
  id: "c1", cliente_nombre: "Cliente QA", modo: "Marítimo", incoterm: "FOB",
  origen: "Origen QA", destino: "Destino QA", descripcion_mercancia: "Carga QA",
  num_contenedores: 2, peso_kg: 100, volumen_m3: 5, seguro: true,
} as CotizacionRow;
beforeEach(() => {
  mocks.proveedores.data = null;
  mocks.proveedores.isError = false;
  mocks.proveedores.refetch.mockReset();
  mocks.visible = true;
  mocks.query.isLoading = false;
  mocks.query.isError = false;
  mocks.query.data = null;
  mocks.query.refetch.mockReset();
});
describe("CotizacionHandover", () => {
  it("no muestra datos sin acceso aunque queden datos en caché", () => {
    mocks.visible = false;
    mocks.query.data = { created_at: "2026-11-06T12:00:00Z" };
    const { container } = render(<CotizacionHandover cotizacion={cotizacion} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("no inventa una ficha cuando no existe", () => {
    const { container } = render(<CotizacionHandover cotizacion={cotizacion} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("muestra carga sin datos operativos", () => {
    mocks.query.isLoading = true;
    const { container } = render(<CotizacionHandover cotizacion={cotizacion} />);
    expect(container.firstChild).not.toBeNull();
    expect(screen.queryByText("Cliente QA")).not.toBeInTheDocument();
  });
  it("permite reintentar el error de lectura", () => {
    mocks.query.isError = true;
    render(<CotizacionHandover cotizacion={cotizacion} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar el handover");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(mocks.query.refetch).toHaveBeenCalledOnce();
  });
  it("muestra agente y naviera cuando se resuelven", () => {
    mocks.query.data = { created_at: "2026-11-06T12:00:00Z" };
    mocks.proveedores.data = { agente: "Agente QA", naviera: "Naviera QA" };
    render(<CotizacionHandover cotizacion={cotizacion} />);
    expect(screen.getByText("Agente QA")).toBeInTheDocument();
    expect(screen.getByText("Naviera QA")).toBeInTheDocument();
  });
  it("expone error de proveedores y permite reintentar", () => {
    mocks.query.data = { created_at: "2026-11-06T12:00:00Z" };
    mocks.proveedores.isError = true;
    render(<CotizacionHandover cotizacion={cotizacion} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar el agente y la naviera");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar proveedores" }));
    expect(mocks.proveedores.refetch).toHaveBeenCalledOnce();
  });
  it("muestra los datos de cotización sólo para un handover existente y sin acciones de escritura", () => {
    mocks.query.data = { created_at: "2026-11-06T12:00:00Z" };
    render(<CotizacionHandover cotizacion={cotizacion} />);
    expect(screen.getByRole("region", { name: "Ficha de handover" })).toBeInTheDocument();
    for (const value of ["Cliente QA", "Origen QA", "Destino QA", "Carga QA", "Marítimo / FOB", "100 kg", "5 m³", "Sí"])
      expect(screen.getByText(value)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
