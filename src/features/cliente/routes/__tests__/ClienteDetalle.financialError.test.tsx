import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({ controller: vi.fn(), retry: vi.fn() }));
vi.mock("@/features/cliente/hooks", () => ({ useClienteDetalleController: mocks.controller }));
vi.mock("react-router", () => ({ useParams: () => ({ id: "cliente" }) }));
vi.mock("@/lib/contexts/BreadcrumbContext", () => ({ useRegisterBreadcrumbLabel: vi.fn() }));
vi.mock("@/components/shared/PageContainer", () => ({ PageContainer: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/features/cliente/components/detalle/ClienteDetalleDialogs", () => ({ ClienteDetalleDialogs: () => null }));
vi.mock("@/features/cliente/components/detalle/ClienteDetalleHeader", () => ({
  ClienteDetalleHeader: () => <h1>Cliente sintético</h1>,
  ClienteLoadingState: () => <p>Cargando cliente</p>,
  ClienteNotFoundState: () => <p>Cliente no encontrado</p>,
}));
vi.mock("../_sections/ClienteDetalleTabs", () => ({ ClienteDetalleTabs: () => <p>Datos del cliente</p> }));
vi.mock("@/components/shared/KpiCard", () => ({
  KpiCard: ({ label, value }: { label: string; value: string }) => <section aria-label={label}>{value}</section>,
}));
import ClienteDetalle from "../ClienteDetalle";

const FINANCIALS = { facturadoMXN: 116, pendienteMXN: 58, profitMXN: 20, facturasSinTc: 0, embarquesSinTc: 0 };
function controller() {
  return {
    cliente: { id: "cliente", nombre: "Cliente sintético", contacto: "Contacto" },
    loadingCliente: false, contactos: [{}], embarquesCliente: [{}, {}], cotizacionesCliente: [{}],
    financials: undefined, errorFinancials: null, fetchingFinancials: false, refetchFinancials: mocks.retry,
  };
}
const card = (label: string) => within(screen.getByRole("region", { name: label }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.controller.mockReturnValue(controller());
});

describe("ClienteDetalle: fallo de saldos financieros", () => {
  it("muestra un error reintentable y —, nunca deuda cero, sin ocultar conteos conocidos", () => {
    mocks.controller.mockReturnValue({ ...controller(), errorFinancials: new Error("Falta el tipo de cambio histórico de la NC") });
    render(<ClienteDetalle />);
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar los datos financieros");
    expect(screen.getByRole("alert")).toHaveTextContent("Falta el tipo de cambio histórico");
    for (const label of ["Facturado", "Por cobrar", "Utilidad"]) expect(card(label).getByText("—")).toBeVisible();
    expect(card("Por cobrar").queryByText(/MXN 0/)).not.toBeInTheDocument();
    expect(card("Embarques").getByText("2")).toBeVisible();
    expect(card("Contactos").getByText("2")).toBeVisible();
    expect(screen.getByText("Datos del cliente")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(mocks.retry).toHaveBeenCalledOnce();
  });

  it("mantiene — si el reintento sin caché limpia el error mientras vuelve a consultar", () => {
    mocks.controller.mockReturnValue({ ...controller(), errorFinancials: new Error("Falta TC histórico") });
    const { rerender } = render(<ClienteDetalle />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    mocks.controller.mockReturnValue({ ...controller(), fetchingFinancials: true });
    rerender(<ClienteDetalle />);
    for (const label of ["Facturado", "Por cobrar", "Utilidad"]) expect(card(label).getByText("—")).toBeVisible();
    expect(card("Por cobrar").queryByText(/MXN 0/)).not.toBeInTheDocument();
    expect(card("Embarques").getByText("2")).toBeVisible();
  });

  it("conserva los importes conocidos y advierte que la actualización falló", () => {
    mocks.controller.mockReturnValue({ ...controller(), financials: FINANCIALS, errorFinancials: new Error("Consulta fallida") });
    render(<ClienteDetalle />);
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos actualizar los datos financieros");
    expect(screen.getByRole("alert")).toHaveTextContent("Se muestran los últimos importes disponibles");
    expect(card("Por cobrar").getByText("MXN 58")).toBeVisible();
    expect(card("Facturado").getByText("MXN 116")).toBeVisible();
  });

  it("deshabilita reintentos repetidos mientras conserva la advertencia y los importes", () => {
    mocks.controller.mockReturnValue({ ...controller(), financials: FINANCIALS, errorFinancials: new Error("Consulta fallida"), fetchingFinancials: true });
    render(<ClienteDetalle />);
    expect(screen.getByRole("button", { name: "Reintentando…" })).toBeDisabled();
    expect(card("Por cobrar").getByText("MXN 58")).toBeVisible();
  });

  it("retira el error al recuperar los saldos y permite un cero real", () => {
    mocks.controller.mockReturnValue({ ...controller(), errorFinancials: new Error("Consulta fallida") });
    const { rerender } = render(<ClienteDetalle />);
    mocks.controller.mockReturnValue({ ...controller(), financials: { ...FINANCIALS, pendienteMXN: 0 } });
    rerender(<ClienteDetalle />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(card("Por cobrar").getByText("MXN 0")).toBeVisible();
  });

  it("preserva la carga inicial de la ficha sin mostrar un error financiero", () => {
    mocks.controller.mockReturnValue({ ...controller(), loadingCliente: true });
    render(<ClienteDetalle />);
    expect(screen.getByText("Cargando cliente")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("no borra importes durante una actualización en curso sin error", () => {
    mocks.controller.mockReturnValue({ ...controller(), financials: FINANCIALS, fetchingFinancials: true });
    render(<ClienteDetalle />);
    expect(card("Por cobrar").getByText("MXN 58")).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("ClienteDetalle: título de navegación", () => {
  it.each(["CRM", "Cotizaciones", "Facturación"])("no hereda el título de %s", (origen) => {
    document.title = `${origen} · Libre Carga`;
    const { rerender } = render(<ClienteDetalle />);
    expect(document.title).toBe("Cliente: Cliente Sintético · Libre Carga");
    rerender(<ClienteDetalle />);
    expect(document.title).toBe("Cliente: Cliente Sintético · Libre Carga");
  });

  it("usa un título neutro al cargar y lo actualiza al obtener el cliente", () => {
    mocks.controller.mockReturnValue({ ...controller(), cliente: null, loadingCliente: true });
    const { rerender } = render(<ClienteDetalle />);
    expect(document.title).toBe("Cliente · Libre Carga");
    mocks.controller.mockReturnValue(controller());
    rerender(<ClienteDetalle />);
    expect(document.title).toBe("Cliente: Cliente Sintético · Libre Carga");
  });

  it.each(["error", "ausente"])("no identifica otro cliente ante estado %s", (estado) => {
    mocks.controller.mockReturnValue({ ...controller(), cliente: null, errorCliente: estado === "error" ? new Error("Sin acceso") : null });
    render(<ClienteDetalle />);
    expect(document.title).toBe("Cliente · Libre Carga");
  });
});
