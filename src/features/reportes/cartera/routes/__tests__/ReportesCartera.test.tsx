import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { construirFilasCartera, totalCartera, totalesPorBucket, type TcCorte } from "../../domain/agingCartera";
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
const dataScope = { userId: "user-a", organizationId: "org-a", role: "admin", generation: 1 };
const listo = { dataScope, tc: null, tcLoading: false, tcError: false, cxc: vacio, cxp: bloque, isLoading: false, isError: false, refetch: vi.fn() };

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
    expect(mocks.csv).toHaveBeenCalledWith("2026-09-30", [vacio, bloque], dataScope, "FP-000007");
    fireEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(mocks.pdf).toHaveBeenCalledWith("2026-09-30", expect.stringContaining("Sin TC DOF disponible"), [vacio, bloque], dataScope, "FP-000007"));
    await waitFor(() => expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeEnabled());
  });

  it("bloquea las descargas si falla una fuente de facturas aunque haya datos en caché", () => {
    mocks.hook.mockReturnValue({ ...listo, isError: true });
    montar();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeDisabled();
    expect(screen.queryByText("FP-000007")).not.toBeInTheDocument();
  });

  it("bloquea ambos archivos cuando las filas no tienen ámbito acreditado", () => {
    mocks.hook.mockReturnValue({ ...listo, dataScope: undefined });
    montar();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeDisabled();
  });

  it("un resultado vacío resuelto no habilita descargas", () => {
    mocks.hook.mockReturnValue({ ...listo, cxp: { ...vacio, titulo: "Cuentas por pagar" } });
    montar();
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Exportar PDF" })).toBeDisabled();
  });
});

describe("Cartera: copy EUR coherente con la valuación disponible", () => {
  const tcEur: TcCorte = { usdMxn: 20, eurMxn: 22, fecha: "2026-09-30", exacto: true };

  function montarEur(tipoCambio: number, tc: TcCorte | null, fuente: "cxc" | "cxp" = "cxp") {
    const filasEur = construirFilasCartera([{
      ...filas[0], id: "eur", folio: "FACTURA-EUR", moneda: "EUR", saldo: 100, tipoCambio,
    }], "2026-09-30", tc);
    const eur = { titulo: fuente === "cxc" ? "Cuentas por cobrar" : "Cuentas por pagar", filas: filasEur, buckets: totalesPorBucket(filasEur), total: totalCartera(filasEur) };
    mocks.hook.mockReturnValue({ ...listo, tc, cxc: vacio, cxp: { ...vacio, titulo: "Cuentas por pagar" }, [fuente]: eur });
    montar();
    return eur;
  }

  it("explica la valuación EUR disponible y la limitación del histórico CxP en este reporte", async () => {
    const eur = montarEur(0, tcEur);
    const aviso = screen.getByText(/EUR se valúa al TC EUR\/MXN/);
    expect(aviso).toHaveTextContent("del corte si está disponible");
    expect(aviso).toHaveTextContent("Este reporte no utiliza TC histórico para CxP en EUR");
    expect(aviso).toHaveTextContent("cuando existe TC al corte, ambas columnas MXN usan ese valor y la diferencia es cero");
    expect(screen.queryByText(/EUR aún no se revalúan/)).not.toBeInTheDocument();
    const fila = within(screen.getByRole("row", { name: /FACTURA-EUR/ }));
    expect(fila.getAllByText(/2,200\.00/)).toHaveLength(2);
    expect(eur.filas[0]).toMatchObject({ saldo: 100, mxnHistorico: 2200, mxnCorte: 2200, diferencia: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Exportar PDF" }));
    await waitFor(() => expect(mocks.pdf).toHaveBeenCalledWith("2026-09-30", expect.any(String), [vacio, eur], dataScope, ""));
  });

  it("muestra la revaluación EUR cuando CxC tiene histórico y TC del corte", () => {
    const eur = montarEur(20, tcEur, "cxc");
    expect(screen.getByText(/EUR se valúa/)).toHaveTextContent("del corte si está disponible");
    const fila = within(screen.getByRole("row", { name: /FACTURA-EUR/ }));
    expect(fila.getByText("MXN 2,000.00")).toBeVisible();
    expect(fila.getByText("MXN 2,200.00")).toBeVisible();
    expect(eur.filas[0]).toMatchObject({ mxnHistorico: 2000, mxnCorte: 2200, diferencia: 200 });
  });

  it("conserva el histórico disponible cuando no hay TC EUR al corte", () => {
    const eur = montarEur(20, { ...tcEur, eurMxn: null }, "cxc");
    expect(screen.getByText(/EUR se valúa/)).toHaveTextContent("Sin TC al corte se conserva el histórico disponible");
    const fila = within(screen.getByRole("row", { name: /FACTURA-EUR/ }));
    expect(fila.getAllByText(/2,000\.00/)).toHaveLength(2);
    expect(eur.filas[0]).toMatchObject({ mxnHistorico: 2000, mxnCorte: 2000, diferencia: 0 });
  });

  it.each([null, { ...tcEur, eurMxn: null }])("advierte que cero MXN no es saldo cero si falta todo TC EUR (%j)", (tc) => {
    const eur = montarEur(0, tc);
    expect(screen.getByText(/EUR se valúa/)).toHaveTextContent("sin ninguno, los ceros en MXN no significan que el saldo sea cero");
    expect(eur.filas[0]).toMatchObject({ moneda: "EUR", saldo: 100, mxnHistorico: 0, mxnCorte: 0, diferencia: 0 });
    const fila = within(screen.getByRole("row", { name: /FACTURA-EUR/ }));
    expect(fila.getByText(/100\.00/)).toBeVisible();
    expect(fila.getAllByText("MXN 0.00")).toHaveLength(3);
  });
});

