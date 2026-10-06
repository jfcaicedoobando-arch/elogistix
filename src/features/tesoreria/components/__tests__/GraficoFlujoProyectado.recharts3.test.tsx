import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import GraficoFlujoProyectado from "../GraficoFlujoProyectado";
import type { SemanaFlujo } from "@/features/tesoreria/domain";

// La gráfica no forma parte del barrel público de tesorería. Este contrato
// vive junto al componente, sin exponer Recharts a importadores eager.
vi.mock("@/hooks/shared", () => ({ useIsMobile: () => false }));
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
  };
});

const semanas: SemanaFlujo[] = [
  { semana_iso: "2026-W40", inicio: "2026-09-28", fin: "2026-10-04", entradas_mxn: 160000, salidas_mxn: 130000, flujo_neto_mxn: 30000, saldo_proyectado_mxn: 120000, detalle_entradas: [], detalle_salidas: [] },
  { semana_iso: "2026-W41", inicio: "2026-10-05", fin: "2026-10-11", entradas_mxn: 90000, salidas_mxn: 220000, flujo_neto_mxn: -130000, saldo_proyectado_mxn: -10000, detalle_entradas: [], detalle_salidas: [] },
];

it("mantiene la leyenda en el orden de sus series, con y sin saldo disponible", async () => {
  const { container, rerender } = render(<GraficoFlujoProyectado semanas={semanas} />);
  const labels = () => Array.from(container.querySelectorAll(".recharts-legend-item-text"), (item) => item.textContent);
  await waitFor(() => expect(labels()).toEqual(["Entradas", "Salidas", "Saldo"]));
  rerender(<GraficoFlujoProyectado semanas={semanas} saldoDisponible={false} />);
  await waitFor(() => expect(labels()).toEqual(["Entradas", "Salidas"]));
});

it("conserva el signo del saldo negativo y muestra las salidas como importe positivo", async () => {
  const { container } = render(<GraficoFlujoProyectado semanas={semanas} />);
  const chart = screen.getByRole("application");
  fireEvent.focus(chart);
  await waitFor(() => {
    const tooltip = container.querySelector(".recharts-tooltip-wrapper");
    expect(tooltip).not.toBeNull();
    expect(within(tooltip as HTMLElement).getByText("MXN 120,000.00")).toBeInTheDocument();
  });

  fireEvent.keyDown(chart, { key: "ArrowRight" });
  await waitFor(() => {
    const tooltip = container.querySelector(".recharts-tooltip-wrapper") as HTMLElement;
    expect(within(tooltip).getByText("MXN -10,000.00")).toBeInTheDocument();
    expect(within(tooltip).getByText("MXN 220,000.00")).toBeInTheDocument();
    expect(within(tooltip).getByText("MXN 90,000.00")).toBeInTheDocument();
  });
});

it("no inventa un saldo cuando no hay saldo disponible", async () => {
  const { container } = render(<GraficoFlujoProyectado semanas={semanas} saldoDisponible={false} />);
  const chart = screen.getByRole("application");
  fireEvent.focus(chart);
  await waitFor(() => {
    const tooltip = container.querySelector(".recharts-tooltip-wrapper") as HTMLElement;
    expect(within(tooltip).getByText("MXN 130,000.00")).toBeInTheDocument();
    expect(within(tooltip).queryByText("Saldo")).not.toBeInTheDocument();
  });
});

it("muestra saldo cero sin cambiarlo por un importe ausente", async () => {
  const { container } = render(<GraficoFlujoProyectado semanas={semanas.map((s) => ({ ...s, saldo_proyectado_mxn: 0 }))} />);
  fireEvent.focus(screen.getByRole("application"));
  await waitFor(() => {
    const tooltip = container.querySelector(".recharts-tooltip-wrapper") as HTMLElement;
    expect(within(tooltip).getByText("Saldo")).toBeInTheDocument();
    expect(within(tooltip).getByText("MXN 0.00")).toBeInTheDocument();
  });
});
