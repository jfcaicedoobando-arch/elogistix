import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { formatCurrency } from "@/lib/formatters";
import ReportesTopChart from "../ReportesTopChart";

const captured = vi.hoisted(() => ({ mobile: true, axisWidth: 0, ticks: 0, margin: { left: 0, right: 0 }, data: [] as { name: string; profit: number }[] }));
vi.mock("@/hooks/shared/useIsMobile", () => ({ useIsMobile: () => captured.mobile }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: PropsWithChildren) => <div>{children}</div>,
  BarChart: ({ children, data, margin }: PropsWithChildren<{ data: typeof captured.data; margin: typeof captured.margin }>) => { captured.data = data; captured.margin = margin; return <div>{children}</div>; },
  Bar: ({ children }: PropsWithChildren) => <div>{children}</div>,
  XAxis: ({ tickCount }: { tickCount: number }) => { captured.ticks = tickCount; return null; },
  YAxis: ({ width }: { width: number }) => { captured.axisWidth = width; return null; },
  Tooltip: () => null,
  Cell: () => null,
  ReferenceLine: () => null,
}));

beforeEach(() => { captured.mobile = true; });
const data = Array.from({ length: 8 }, (_, i) => ({ name: `Cliente con nombre completo ${i + 1}`, profit: i === 0 ? -350.5 : (i + 1) * 500.25 }));

describe("Top 8 por utilidad en móvil", () => {
  it("deja al menos la mitad del ancho de gráfica de 270px para las barras y conserva importes", () => {
    const { rerender } = render(<ReportesTopChart data={data} isLoading={false} />);
    const plotWidth = 270 - captured.axisWidth - captured.margin.left - captured.margin.right;
    expect(plotWidth).toBeGreaterThanOrEqual(135);
    expect(captured.ticks).toBeLessThanOrEqual(3);
    expect(captured.data).toEqual(data);
    const summary = screen.getByText("Ver nombres e importes");
    const details = summary.closest("details");
    fireEvent.click(summary);
    expect(details).toHaveAttribute("open");
    for (const row of data) {
      expect(screen.getByText(row.name)).toBeInTheDocument();
      expect(screen.getByText(formatCurrency(row.profit, "USD"))).toBeInTheDocument();
    }
    captured.mobile = false;
    rerender(<ReportesTopChart data={data} isLoading={false} />);
    expect(captured.axisWidth).toBe(210);
    expect(screen.queryByText("Ver nombres e importes")).not.toBeInTheDocument();
  });

  it("mantiene los 210px de etiquetas y cinco ticks de escritorio", () => {
    captured.mobile = false;
    render(<ReportesTopChart data={data} isLoading={false} />);
    expect(captured.axisWidth).toBe(210);
    expect(captured.ticks).toBe(5);
    expect(captured.margin).toMatchObject({ left: 10, right: 24 });
    expect(captured.data).toEqual(data);
  });
});
