import { cloneElement, type ReactElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChartTooltipProps } from "@/components/shared/ChartTooltip";
import ComprasReportes from "../ComprasReportes";

const mocks = vi.hoisted(() => ({ controller: vi.fn() }));
vi.mock("@/features/compras/hooks/useComprasReportesController", () => ({
  useComprasReportesController: mocks.controller,
}));
vi.mock("@/components/shared/TipoCambioFallbackBanner", () => ({ TipoCambioFallbackBanner: () => null }));
vi.mock("../_sections/TopProveedoresCard", () => ({
  TopProveedoresCard: () => <p>Resumen de proveedores</p>,
}));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null, XAxis: () => null, YAxis: () => null, Legend: () => null,
  Bar: ({ name, fill }: { name: string; fill: string }) => <span data-testid={`serie-${name}`} data-fill={fill} />,
  Tooltip: ({ content }: { content: ReactElement<ChartTooltipProps> }) => cloneElement(content, {
    active: true, label: "2026-09",
    payload: [{ name: "MXN", value: 5885.5 }, { name: "USD", value: 700 }, { name: "EUR", value: 10 }],
  }),
}));

beforeEach(() => {
  mocks.controller.mockReturnValue({
    desde: "2026-01-01", hasta: "2026-09-30", setDesde: vi.fn(), setHasta: vi.fn(),
    errorRango: null, isLoading: false, isError: false, refetch: vi.fn(),
    numFacturas: 7, totalMxn: 5885.5, totalUsd: 700, totalEur: 10,
    topProveedores: [{ nombre: "Agente" }], evolucion: [{ mes: "2026-09" }], handleExport: vi.fn(),
  });
});

describe("Compras reportes — presentación", () => {
  it("respeta las monedas del tooltip y usa colores distintos por serie", () => {
    const { container } = render(<ComprasReportes />);
    const tooltip = screen.getByText("2026-09").parentElement;
    expect(tooltip).toHaveClass("bg-popover", "text-popover-foreground");
    expect(tooltip).toHaveTextContent("MXN 5,885.50");
    expect(tooltip).toHaveTextContent("USD 700.00");
    expect(tooltip).toHaveTextContent("EUR 10.00");
    const colores = ["MXN", "USD", "EUR"].map((m) => screen.getByTestId(`serie-${m}`).getAttribute("data-fill"));
    expect(new Set(colores).size).toBe(3);
    expect(container.querySelector(".xl\\:grid-cols-4")).toHaveClass("sm:grid-cols-2");
  });

  it("el rango inválido se explica en el campo y no presenta ceros como resultado", () => {
    mocks.controller.mockReturnValue({ ...mocks.controller(), errorRango: "La fecha Desde no puede ser posterior a Hasta." });
    render(<ComprasReportes />);
    expect(screen.getByText("La fecha Desde no puede ser posterior a Hasta.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Hasta" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Exportar CSV" })).toBeDisabled();
    expect(screen.queryByText("Facturas en el período")).not.toBeInTheDocument();
    expect(screen.queryByText("Resumen de proveedores")).not.toBeInTheDocument();
    expect(screen.queryByText("Sin datos para graficar.")).not.toBeInTheDocument();
  });
});
