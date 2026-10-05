import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeForecast } from "@/features/crm/domain/forecast";

const mocks = vi.hoisted(() => ({ forecast: vi.fn() }));
vi.mock("@/features/crm/hooks", () => ({
  useForecast: mocks.forecast,
  useReportesCRM: () => ({ data: { embudo: [], porFuente: [], motivosPerdida: [] }, isLoading: false, isError: false }),
}));
vi.mock("@/hooks/shared", () => ({ usePermissions: () => ({ canEdit: false }), useDocumentTitle: vi.fn() }));
vi.mock("@/features/crm/components/CrmSubheader", () => ({ CrmSubheader: () => null }));
vi.mock("@/features/crm/components/LeaderboardVendedores", () => ({ default: () => null }));
vi.mock("@/features/crm/components/analitica/CrmEmbudoChart", () => ({ default: () => null }));
vi.mock("@/features/crm/components/analitica/CrmForecastMensualChart", () => ({ default: () => null }));
import Analitica from "../Analitica";

beforeEach(() => vi.clearAllMocks());

describe("Analítica: contexto de todos los periodos sin modificar el cálculo", () => {
  it("identifica fechas estimadas y conteo de todos los estados, preservando monedas y meses", () => {
    const datos = computeForecast([
      { monto_estimado: 100, probabilidad: 50, fecha_estimada_cierre: "2026-09-15", vendedor_email: "vendedor", etapa_id: "abierta", moneda: "USD" },
      { monto_estimado: 200, probabilidad: 50, fecha_estimada_cierre: "2026-10-15", vendedor_email: "vendedor", etapa_id: "abierta", moneda: "USD" },
      { monto_estimado: 70, probabilidad: 0, fecha_estimada_cierre: "2026-10-15", vendedor_email: "vendedor", etapa_id: "perdida", moneda: "USD" },
      { monto_estimado: 80, probabilidad: 100, fecha_estimada_cierre: null, vendedor_email: "vendedor", etapa_id: "ganada", moneda: "MXN" },
    ], new Map([["abierta", "abierta"], ["perdida", "perdida"], ["ganada", "ganada"]]));
    mocks.forecast.mockReturnValue({ data: datos, isLoading: false, isError: false });
    render(<Analitica />);
    expect(mocks.forecast.mock.calls.every((args) => args.length === 0)).toBe(true);
    expect(screen.getByText("Todas las fechas de cierre estimado.")).toBeVisible();
    expect(screen.getByText(/Incluye fechas anteriores.*sin fecha/)).toHaveTextContent("ganadas, perdidas y sin etapa clasificada");
    expect(screen.getByText("Oportunidades abiertas (USD)")).toBeVisible();
    expect(screen.getByText("Valor ponderado (USD)")).toBeVisible();
    expect(screen.getAllByRole("columnheader", { name: /^Oportunidades$/ })).toHaveLength(2);
    const tablaMes = screen.getAllByRole("table")[0];
    expect(within(tablaMes).getByText("Sep 2026")).toBeVisible();
    expect(within(tablaMes).getByText("Oct 2026").closest("tr")).toHaveTextContent("2");
    expect(within(tablaMes).getByText("Sin fecha")).toBeVisible();
    expect(screen.queryByText("Pipeline")).not.toBeInTheDocument();
    expect(datos.totalesPorMoneda.find((t) => t.moneda === "USD")?.totalPipeline).toBe(300);
  });
});
