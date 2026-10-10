import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SolicitudPricingCampos, type DatosSolicitud } from "../SolicitudPricingCampos";
import SeccionMercanciaMaritimaFCL from "@/features/cotizacion/components/SeccionMercanciaMaritimaFCL";
import { CosteoTarifasFiltros } from "@/features/costeo/components/CosteoTarifasFiltros";

vi.mock("@/features/crm/hooks/usePricingCrm", () => ({ useUsuariosOrgCrm: () => ({ data: [] }) }));
const form = vi.hoisted(() => ({ setValue: vi.fn(), container: "" }));
const catalog = [
  { id: "20gp", code: "20GP", name: "20 pies estándar" },
  { id: "40hc", code: "40HC", name: "40 pies high cube" },
  { id: "lcl", code: "LCL", name: "Carga consolidada LCL" },
];
vi.mock("@/features/catalogos/hooks", () => ({ usePuertos: () => ({ data: [] }), useTiposContenedor: () => ({ data: catalog }) }));
vi.mock("@/features/catalogos", () => ({
  etiquetaPuerto: () => "",
  PortIdSelect: ({ id, disabled }: { id: string; disabled?: boolean }) => <button id={id} role="combobox" disabled={disabled} />,
}));
vi.mock("react-hook-form", () => ({ useFormContext: () => ({ watch: (field: string) => field === "tipoContenedor" ? form.container : "", setValue: form.setValue }) }));
vi.mock("@/features/cotizacion/components/SeccionMercanciaWrapper", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
beforeEach(() => {
  form.container = "";
  form.setValue.mockClear();
  // jsdom lacks the layout API used when Radix focuses a listbox option.
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe("Etiquetas de campos compartidos de Pricing", () => {
  it("distingue países, puertos y tipo de contenedor en la solicitud", () => {
    render(<SolicitudPricingCampos datos={{} as DatosSolicitud} set={vi.fn()} />);
    for (const name of ["Modo de transporte", "Tipo de contenedor", "País de origen", "Puerto de origen", "País de destino", "Puerto de destino", "Incoterm"]) {
      expect(screen.getByRole("combobox", { name: new RegExp(`^${name}( \\*)?$`) })).toBeInTheDocument();
    }
    expect(screen.queryByText("Tipo de embarque")).not.toBeInTheDocument();
  });
  it("identifica el tipo de contenedor del wizard por su etiqueta accesible", () => {
    render(<SeccionMercanciaMaritimaFCL msdsFile={null} setMsdsFile={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Tipo de contenedor" })).toBeInTheDocument();
    expect(screen.queryByText("FCL")).not.toBeInTheDocument();
    expect(screen.queryByText("LCL")).not.toBeInTheDocument();
  });
  it("abre el catálogo FCL con tipos reales y conserva la selección por nombre", async () => {
    render(<SeccionMercanciaMaritimaFCL msdsFile={null} setMsdsFile={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Tipo de contenedor" }), { key: "ArrowDown" });
    expect(await screen.findByRole("option", { name: "20 pies estándar" })).toBeInTheDocument();
    const option = screen.getByRole("option", { name: "40 pies high cube" });
    expect(screen.queryByRole("option", { name: /LCL/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "FCL" })).not.toBeInTheDocument();
    fireEvent.click(option);
    expect(form.setValue).toHaveBeenCalledWith("tipoContenedor", "40 pies high cube");
  });
  it("conserva visible un tipo histórico que ya no está en catálogo", async () => {
    form.container = "Tipo legacy";
    render(<SeccionMercanciaMaritimaFCL msdsFile={null} setMsdsFile={vi.fn()} />);
    const selector = screen.getByRole("combobox", { name: "Tipo de contenedor" });
    expect(selector).toHaveTextContent("Tipo legacy");
    fireEvent.keyDown(selector, { key: "ArrowDown" });
    expect(await screen.findByRole("option", { name: "Tipo legacy" })).toHaveAttribute("aria-selected", "true");
    expect(form.setValue).not.toHaveBeenCalled();
  });
  it("el filtro identifica el tipo de contenedor y no inventa un Incoterm de tarifa", () => {
    render(<CosteoTarifasFiltros estado="todas" onEstadoChange={vi.fn()} aprobacion="todas" onAprobacionChange={vi.fn()}
      agenteId="todos" onAgenteChange={vi.fn()} tipoId="todos" onTipoChange={vi.fn()} busqueda="" onBusquedaChange={vi.fn()}
      agentes={[]} tipos={[]} counts={{ pendientes: 0, programadas: 0 }} onClearAll={vi.fn()} hasActiveFilters={false}
      total={0} viewMode="tabla" onViewModeChange={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Filtrar por tipo de contenedor" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /incoterm/i })).not.toBeInTheDocument();
  });
});
