import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ProfitEstadoResultados from "../ProfitEstadoResultados";
import { useEstadoResultados } from "@/features/profit/hooks/useEstadoResultados";
import { exportToCsv } from "@/generators/exportCsv";
import { usePdfExport } from "@/hooks/shared";
import { NotaCreditoSinDesgloseError } from "@/lib/financial/baseNotaCredito";
import { mapNotaCreditoRows } from "@/lib/mappers/estadoResultadosRows";
import { ingresosDeNotas, type VentasBucket } from "@/features/profit/services/estadoResultadosBuckets";
import { buildEstadoResultados } from "@/features/profit/domain/estadoResultados";

vi.mock("@/features/profit/hooks/useEstadoResultados", () => ({ useEstadoResultados: vi.fn() }));
vi.mock("@/features/profit/hooks/useFuenteEerr", () => ({ useFuenteEerr: () => ({ fuente: "facturas", setFuente: vi.fn() }) }));
vi.mock("@/features/catalogos/hooks", () => ({ useExchangeRates: () => ({ data: { esFallback: false } }) }));
vi.mock("@/features/catalogos/services", () => ({ fetchExchangeRates: vi.fn(), EXCHANGE_RATES_FALLBACK: { usdMxn: 20, eurMxn: 22 } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/shared", () => ({ usePdfExport: vi.fn() }));
vi.mock("@/generators/exportCsv", () => ({ exportToCsv: vi.fn() }));
vi.mock("@/pdf/render/descargarPdf", () => ({ descargarPdf: vi.fn() }));

const tc = { usd: 20, eur: 22 };
const mes = { key: "2026-10", label: "Octubre 2026", year: 2026, month: 10 };
const runPdfExport = vi.fn();

function datosConNc1() {
  const out: VentasBucket = { embarques: [], ventas: [] };
  ingresosDeNotas(mapNotaCreditoRows([{
    id: "42b98b51-9e87-4cdb-8b07-91a259b774ff", folio: "NC1", factura_id: "a3",
    monto: 58, moneda: "MXN", conceptos: [{ cantidad: 1, precio_unitario: 50, tasa_iva: 0.16, tipo_iva: "gravado_16" }],
  }]), out, tc);
  return buildEstadoResultados(
    [...out.embarques, { id: "facturas", modo: "Otros", tipo_cambio_usd: 20, tipo_cambio_eur: 22 }],
    [...out.ventas, { embarque_id: "facturas", descripcion: "Facturación", moneda: "MXN", total: 200.11 }],
    [{ embarque_id: "facturas", concepto: "Costos", moneda: "MXN", monto: 2000 }],
  );
}

function errorDelMes() {
  try {
    ingresosDeNotas(mapNotaCreditoRows([
      { id: "legacy-vacia", folio: "NC2", factura_id: "a3", monto: 58, conceptos: [] },
      { id: "legacy-incompleta", folio: "NC3", factura_id: "a3", monto: 116, conceptos: [{ cantidad: 1 }] },
    ]), { embarques: [], ventas: [] }, tc);
  } catch (error) {
    if (error instanceof NotaCreditoSinDesgloseError) return error;
    throw error;
  }
  throw new Error("La fixture debe rechazar ambas notas sin desglose");
}

function mostrar(error: NotaCreditoSinDesgloseError | null) {
  vi.mocked(useEstadoResultados).mockReturnValue({
    organizationId: "org-test", mesActual: mes, mesesDisponibles: [mes], setMesKey: vi.fn(), irMesAnterior: vi.fn(), irMesSiguiente: vi.fn(),
    puedeIrAtras: false, puedeIrAdelante: false, data: datosConNc1(), isLoading: false, isError: !!error, error,
    refetch: vi.fn(), fuente: "facturas", setFuente: vi.fn(),
  });
  return render(<MemoryRouter><ProfitEstadoResultados /></MemoryRouter>);
}

describe("AUD33: diagnóstico mensual de notas sin desglose en la pantalla real", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePdfExport).mockReturnValue({ isExporting: false, run: runPdfExport });
  });

  it("muestra todos los folios e IDs, oculta datos retenidos y bloquea CSV/PDF", () => {
    mostrar(errorDelMes());
    const alerta = within(screen.getByRole("alert"));
    expect(alerta.getByText(/NC2 \(ID: legacy-vacia\).*NC3 \(ID: legacy-incompleta\)/)).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    const csv = screen.getByRole("button", { name: "Exportar CSV" });
    const pdf = screen.getByRole("button", { name: "PDF" });
    expect(csv).toBeDisabled();
    expect(pdf).toBeDisabled();
    fireEvent.click(csv);
    fireEvent.click(pdf);
    expect(exportToCsv).not.toHaveBeenCalled();
    expect(runPdfExport).not.toHaveBeenCalled();
  });

  it("NC1 válida permite exportar ingresos150.11 y utilidad−1849.89 desde base50", () => {
    mostrar(null);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    const csv = screen.getByRole("button", { name: "Exportar CSV" });
    expect(csv).toBeEnabled();
    expect(screen.getByRole("button", { name: "PDF" })).toBeEnabled();
    fireEvent.click(csv);
    expect(exportToCsv).toHaveBeenCalledWith("estado-resultados-2026-10.csv", expect.any(Array), expect.arrayContaining([
      expect.objectContaining({ concepto: "TOTAL INGRESOS", total: "150.11" }),
      expect.objectContaining({ concepto: "UTILIDAD BRUTA", total: "-1849.89" }),
    ]));
  });
});
