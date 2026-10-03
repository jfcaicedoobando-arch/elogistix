import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CHART } from "@/lib/chartTokens";
import ReportesTopChart from "../ReportesTopChart";

const captured = vi.hoisted(() => ({ domain: undefined as undefined | ((limits: [number, number]) => number[]), colors: [] as string[], zero: undefined as number | undefined }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: PropsWithChildren) => <div>{children}</div>,
  BarChart: ({ children }: PropsWithChildren) => <div>{children}</div>,
  Bar: ({ children }: PropsWithChildren) => <div>{children}</div>,
  XAxis: ({ domain }: { domain: typeof captured.domain }) => { captured.domain = domain; return null; },
  YAxis: () => null,
  Tooltip: () => null,
  Cell: ({ fill }: { fill: string }) => { captured.colors.push(fill); return null; },
  ReferenceLine: ({ x }: { x: number }) => { captured.zero = x; return null; },
}));

beforeEach(() => { captured.domain = undefined; captured.colors = []; captured.zero = undefined; });

describe("Rentabilidad - categorías con pérdidas", () => {
  it.each([
    { profits: [-800, -200], limits: [-800, -200], expected: [-800, 0] },
    { profits: [-800, 200], limits: [-800, 200], expected: [-800, 200] },
    { profits: [0, 200], limits: [0, 200], expected: [0, 200] },
    { profits: [200, 200], limits: [200, 200], expected: [0, 200] },
  ])("incluye cero y todos los valores de $profits", ({ profits, limits, expected }) => {
    render(<ReportesTopChart data={profits.map((profit, i) => ({ name: `Cliente ${i}`, profit }))} isLoading={false} />);
    expect(captured.domain?.(limits as [number, number])).toEqual(expected);
    expect(captured.zero).toBe(0);
    expect(captured.colors).toHaveLength(profits.length);
    profits.forEach((profit, i) => { if (profit < 0) expect(captured.colors[i]).toBe(CHART.destructive); });
  });

  it("muestra una pérdida individual y conserva el estado sin utilidad para todos los ceros", () => {
    const { rerender } = render(<ReportesTopChart data={[{ name: "Cliente A", profit: -7233.75 }]} isLoading={false} />);
    expect(screen.getByText("USD -7,233.75")).toHaveClass("text-destructive");
    rerender(<ReportesTopChart data={[{ name: "Cliente A", profit: 0 }, { name: "Cliente B", profit: 0 }]} isLoading={false} />);
    expect(screen.getByText("Sin utilidad registrada en el periodo seleccionado")).toBeInTheDocument();
  });
});
