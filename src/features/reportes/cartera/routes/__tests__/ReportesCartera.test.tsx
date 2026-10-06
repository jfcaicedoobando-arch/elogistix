import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { construirFilasCartera, totalCartera, totalesPorBucket } from "../../domain/agingCartera";
import ReportesCartera from "../ReportesCartera";

const mocks = vi.hoisted(() => ({ hook: vi.fn(), pdf: vi.fn(), csv: vi.fn() }));
vi.mock("../../hooks/useCarteraAging", () => ({ useCarteraAging: mocks.hook }));
vi.mock("../../services/carteraDescargas", () => ({ descargarCarteraPdf: mocks.pdf, descargarCarteraCsv: mocks.csv }));
vi.mock("@/lib/date/today", () => ({ todayLocalISO: () => "2026-09-30" }));

const filas = construirFilasCartera([{
  id: "fp-7", folio: "FP-000007", contraparte: "Agente marítimo Monterrey", expediente: "ELIMP00010",
  moneda: "USD", saldo: 700, tipoCambio: 17.5, fechaEmision: "2026-09-26", fechaVencimiento: "2026-09-27",
}], "2026-09-30", null);
const bloque = { titulo: "Cuentas por pagar", filas, buckets: totalesPorBucket(filas), total: totalCartera(filas) };
const vacio = { titulo: "Cuentas por cobrar", filas: [], buckets: totalesPorBucket([]), total: totalCartera([]) };
const listo = { tc: null, tcLoading: false, tcError: false, cxc: vacio, cxp: bloque, isLoading: false, isError: false, refetch: vi.fn() };

function montar() {
  return render(<MemoryRouter><TooltipProvider><ReportesCartera /></TooltipProvider></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hook.mockReturnValue(listo);
  mocks.pdf.mockResolvedValue(undefined);
});

describe("Cartera — exportaciones completas y estados", () => {
  it("bloquea ambos archivos y oculta valuación provisional mientras carga el TC", () => {
    mocks.hook.mockReturnValue({ ...listo, tcLoading: true, isLoading: true });
    montar();
    expect(screen.getByText(/Consultando TC DOF/)).toBeInTheDocument();
    expect(screen.queryByText(/Sin TC DOF disponible/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeDisabled();
    expect(screen.queryByText(/12,250\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText("FP-000007")).not.toBeInTheDocument();
  });

  it("no exporta datos parciales ni muestra totales tras un error", () => {
    mocks.hook.mockReturnValue({ ...listo, tcError: true, isError: true });
    montar();
    expect(screen.getByText(/No se pudo consultar el TC DOF/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeDisabled();
    expect(screen.queryByText(/12,250\.00/)).not.toBeInTheDocument();
  });

  it("pasa el filtro a ambas descargas cuando el reporte está resuelto", async () => {
    montar();
    fireEvent.change(screen.getByRole("textbox", { name: "Cliente, proveedor, folio o expediente" }), { target: { value: "FP-000007" } });
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    expect(mocks.csv).toHaveBeenCalledWith("2026-09-30", [vacio, bloque], "FP-000007");
    fireEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(mocks.pdf).toHaveBeenCalledWith("2026-09-30", expect.stringContaining("Sin TC DOF disponible"), [vacio, bloque], "FP-000007"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeEnabled());
  });

  it("bloquea las descargas si falla una fuente de facturas aunque haya datos en caché", () => {
    mocks.hook.mockReturnValue({ ...listo, isError: true });
    montar();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeDisabled();
    expect(screen.queryByText("FP-000007")).not.toBeInTheDocument();
  });

  it("un resultado vacío resuelto no habilita descargas", () => {
    mocks.hook.mockReturnValue({ ...listo, cxp: { ...vacio, titulo: "Cuentas por pagar" } });
    montar();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeDisabled();
  });
});
