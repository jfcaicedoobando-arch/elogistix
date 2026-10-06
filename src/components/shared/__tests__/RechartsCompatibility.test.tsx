import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuditoriaTendenciaChart } from "@/features/auditoria/components/AuditoriaTendenciaChart";
import DesempenoOperadoresChart from "@/features/operaciones/components/DesempenoOperadoresChart";
import { GraficaReporte } from "@/features/crm/components/reportes/GraficaReporte";
import ReportesTopChart from "@/features/reportes/components/ReportesTopChart";
import { CHART } from "@/lib/chartTokens";
import { GraficoEERR12m } from "@/features/dashboardEjecutivo/components/GraficoEERR12m";
import { ForecastMultiMesChart } from "@/features/dashboardEjecutivo/components/ForecastMultiMesChart";
import AdminDashboardActivityChart from "@/features/admin/components/AdminDashboardActivityChart";
import CrmForecastMensualChart from "@/features/crm/components/analitica/CrmForecastMensualChart";
import { ProveedorTendenciaChart } from "@/features/proveedor/components/ProveedorTendenciaChart";

// En jsdom se fijan el tamaño y el final de las animaciones: ejes, cuadrícula,
// geometría, leyenda y tooltips usan la implementación real de Recharts.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: (props: import("recharts").ResponsiveContainerProps) => (
      <actual.ResponsiveContainer {...props} width={600} height={320} />
    ),
    Bar: (props: import("react").ComponentProps<typeof actual.Bar>) => (
      <actual.Bar {...props} isAnimationActive={false} />
    ),
    Pie: (props: import("react").ComponentProps<typeof actual.Pie>) => (
      <actual.Pie {...props} isAnimationActive={false} />
    ),
  };
});

vi.mock("@/features/auditoria/hooks", () => ({
  useAuditoriaSnapshots: () => ({
    isLoading: false,
    data: [
      { fecha: "2026-10-01", score: 80, criticos: 4, total_pendientes: 12 },
      { fecha: "2026-10-02", score: 90, criticos: 2, total_pendientes: 8 },
    ],
  }),
}));

vi.mock("@/features/operaciones/hooks", async () =>
  import("@/features/operaciones/domain/desempenoChart"),
);

const historial = [
  { periodo: "2026-06", ingresos: 540000, costos: 440000, utilidad: 100000 },
  { periodo: "2026-07", ingresos: 590000, costos: 470000, utilidad: 120000 },
  { periodo: "2026-08", ingresos: 560000, costos: 580000, utilidad: -20000 },
];

describe("Compatibilidad con Recharts 3 real", () => {
  afterEach(async () => {
    cleanup();
    // RTK agrupa notificaciones en RAF con un timeout de respaldo. Dejar que
    // termine el frame tras desmontar cancela ese timeout antes de que el
    // teardown global cierre jsdom y elimine cancelAnimationFrame.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });

  it("mantiene la cuadrícula y ambas escalas en la tendencia de auditoría", async () => {
    const { container } = render(<AuditoriaTendenciaChart />);
    await waitFor(() => {
      expect(container.querySelectorAll(".recharts-cartesian-grid-horizontal line").length).toBeGreaterThan(1);
      expect(container.querySelectorAll(".recharts-cartesian-grid-vertical line").length).toBeGreaterThan(1);
      expect(container.querySelectorAll(".recharts-yAxis")).toHaveLength(2);
      expect(container.querySelectorAll(".recharts-line-curve")).toHaveLength(3);
    }, { timeout: 3000 });
    expect(screen.getByRole("application")).toHaveAttribute("tabindex", "0");
  });

  it("conserva el orden operativo de la leyenda apilada, no el alfabético", async () => {
    const { container } = render(<DesempenoOperadoresChart data={[
      { nombre: "Valeria Zamora", Confirmado: 4, "En Tránsito": 6, Llegada: 2, "En Proceso": 3, Cerrado: 5 },
    ]} />);
    await waitFor(() => {
      expect(Array.from(container.querySelectorAll(".recharts-legend-item-text"), (item) => item.textContent))
        .toEqual(["Confirmado", "En Tránsito", "Llegada", "En Proceso", "Finalizado"]);
    }, { timeout: 3000 });
  });

  it.each([
    {
      nombre: "EERR",
      chart: <GraficoEERR12m data={historial} />,
      labels: ["Ingresos", "Costos", "Utilidad"],
    },
    {
      nombre: "forecast ejecutivo",
      chart: <ForecastMultiMesChart historico={historial} />,
      labels: ["Banda +15%", "Banda -15%", "Ingresos reales", "Proyección"],
    },
    {
      nombre: "administración",
      chart: <AdminDashboardActivityChart data={[{ nombre: "Forwarder MTY", embarques: 20, cotizaciones: 35 }]} />,
      labels: ["Embarques", "Cotizaciones"],
    },
    {
      nombre: "CRM",
      chart: <CrmForecastMensualChart porMes={[
        { key: "2026-10|USD", label: "Oct 2026", moneda: "USD", pipeline: 12000, ponderado: 7000, ganado: 4000, count: 5 },
      ]} />,
      labels: ["Oportunidades abiertas", "Valor ponderado", "Ganado"],
    },
    {
      nombre: "proveedor",
      chart: <ProveedorTendenciaChart tendencia={historial.map((p) => ({ mes: p.periodo, comprometido: p.costos + 20000, facturado: p.costos, pagado: p.costos - 10000 }))} />,
      labels: ["Comprometido", "Facturado", "Pagado"],
    },
  ])("mantiene la leyenda de $nombre alineada con sus series", async ({ chart, labels }) => {
    const { container } = render(chart);
    await waitFor(() => {
      expect(Array.from(container.querySelectorAll(".recharts-legend-item-text"), (item) => item.textContent))
        .toEqual(labels);
    });
  });

  it("representa pérdidas y ganancias a ambos lados del eje cero", async () => {
    const { container } = render(<ReportesTopChart isLoading={false} data={[
      { name: "Aceros del Norte", profit: -800 },
      { name: "Autopartes Apodaca", profit: 1200 },
    ]} />);
    await waitFor(() => {
      expect(container.querySelectorAll(".recharts-bar-rectangle path")).toHaveLength(2);
    }, { timeout: 3000 });
    const bars = container.querySelectorAll(".recharts-bar-rectangle path");
    expect(bars[0]).toHaveAttribute("fill", CHART.destructive);
    expect(container.querySelector(".recharts-reference-line line")).toBeInTheDocument();
    expect(screen.getByText("USD -800")).toBeInTheDocument();
  });

  it("entrega valores de la gráfica al tooltip compartido mediante teclado", async () => {
    render(<GraficaReporte tipo="barras" medida="conteo" datos={[
      { etiqueta: "Shanghai → Manzanillo", valor: 12 },
      { etiqueta: "Ningbo → Lázaro Cárdenas", valor: 8 },
    ]} />);
    const chart = screen.getByRole("application");
    fireEvent.focus(chart);
    fireEvent.keyDown(chart, { key: "ArrowRight" });
    await waitFor(() => {
      expect(screen.getByText("Valor")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("conserva etiquetas y sectores del reporte de pastel", async () => {
    const { container } = render(<GraficaReporte tipo="pastel" medida="conteo" datos={[
      { etiqueta: "Marítimo", valor: 12 },
      { etiqueta: "Aéreo", valor: 8 },
    ]} />);
    await waitFor(() => {
      expect(container.querySelectorAll(".recharts-pie-sector")).toHaveLength(2);
      expect(screen.getByText("Marítimo")).toBeInTheDocument();
      expect(screen.getByText("Aéreo")).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
