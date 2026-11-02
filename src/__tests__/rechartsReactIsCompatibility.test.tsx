import { createRequire } from "node:module";
import * as React from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Cell, Pie, PieChart } from "recharts";
import { MemoryRouter } from "react-router";
import CrmEmbudoChart from "@/features/crm/components/analitica/CrmEmbudoChart";
import { GraficaReporte } from "@/features/crm/components/reportes/GraficaReporte";
import { ComprasAgingChart } from "@/features/cxp/routes/_sections/ComprasAgingChart";
import { RentabilidadSection } from "@/features/dashboard/direccion/components/RentabilidadSection";
import ReportesTopChart from "@/features/reportes/components/ReportesTopChart";
import { CHART, CHART_SERIES } from "@/lib/chartTokens";

vi.unmock("recharts");

const network = vi.hoisted(() => {
  const requests: string[] = [];
  const rejectFetch: typeof globalThis.fetch = async (input) => {
    requests.push(String(input));
    throw new Error("Network is forbidden in chart compatibility tests");
  };
  vi.stubGlobal("fetch", rejectFetch);
  return { requests, rejectFetch };
});

const require = createRequire(import.meta.url);
const rechartsRequire = createRequire(require.resolve("recharts"));
const CELL_COLORS = ["#e11d48", "#2563eb"];
const PIE_PATHS = ".recharts-pie-sector path.recharts-sector";

function CellDiscoveryChart({ fragment }: { fragment: boolean }) {
  // Colors belong only to Cells: data.fill would bypass the child lookup.
  const data = [{ name: "Alfa", value: 40 }, { name: "Beta", value: 60 }];
  const cells = data.map((entry, index) => <Cell key={entry.name} fill={CELL_COLORS[index]} />);
  return (
    <PieChart width={300} height={300}>
      <Pie data={data} dataKey="value" nameKey="name" cx={150} cy={150}
        outerRadius={80} fill="#94a3b8" isAnimationActive={false} label={false} labelLine={false}>
        {fragment ? <React.Fragment>{cells}</React.Fragment> : cells}
      </Pie>
    </PieChart>
  );
}

async function expectSvgColors(container: HTMLElement, selector: string, colors: readonly string[]) {
  await waitFor(() => {
    const paths = Array.from(container.querySelectorAll<SVGPathElement>(selector));
    expect(paths).toHaveLength(colors.length);
    expect(paths.map((path) => path.getAttribute("fill"))).toEqual(colors);
    for (const path of paths) {
      expect(path.getAttribute("d")).toMatch(/^M/);
      expect(path.getAttribute("d")).not.toMatch(/NaN|Infinity/);
    }
  }, { timeout: 3000 });
}

beforeEach(() => {
  vi.stubGlobal("fetch", network.rejectFetch);
  // jsdom has no layout. Preserve the real ResponsiveContainer and its effect.
  const originalRect = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains("recharts-responsive-container") || this.classList.contains("recharts-wrapper")) {
      return new DOMRect(0, 0, 640, 320);
    }
    return originalRect.call(this);
  });
  // Exercise Recharts' real reduced-motion path instead of replacing Bar/Pie.
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query === "(prefers-reduced-motion: reduce)", media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
  }));
});

afterEach(async () => {
  cleanup();
  // Recharts batches store notifications in RAF with a timeout fallback.
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  expect(network.requests).toEqual([]);
  vi.restoreAllMocks();
});

describe("React-is compatibility through real Recharts SVG", () => {
  it("resolves Recharts' actual react-is peer to the current React version", () => {
    expect(rechartsRequire.resolve("react-is")).toBe(require.resolve("react-is"));
    const peer = rechartsRequire("react-is/package.json") as { version: string };
    expect(peer.version).toBe(React.version);
  });

  it("preserves colors on Cells supplied directly by map", async () => {
    expect.hasAssertions();
    const { container } = render(<CellDiscoveryChart fragment={false} />);
    await expectSvgColors(container, PIE_PATHS, CELL_COLORS);
  });

  it("preserves the same Cell colors inside a React Fragment", async () => {
    expect.hasAssertions();
    const { container } = render(<CellDiscoveryChart fragment />);
    await expectSvgColors(container, PIE_PATHS, CELL_COLORS);
  });

  it("keeps the CRM funnel's stage colors with its real responsive BarChart", async () => {
    expect.hasAssertions();
    const { container } = render(<CrmEmbudoChart embudo={[
      { etapa: "Primera", cantidad: 40 }, { etapa: "Segunda", cantidad: 25 }, { etapa: "Tercera", cantidad: 10 },
    ]} />);
    await expectSvgColors(container, ".recharts-bar-rectangle path", CHART_SERIES.slice(0, 3));
  });

  it("keeps dynamic CRM report slice colors with its real responsive PieChart", async () => {
    expect.hasAssertions();
    const { container } = render(<GraficaReporte tipo="pastel" medida="conteo" datos={[
      { etiqueta: "Primera", valor: 40 }, { etiqueta: "Segunda", valor: 60 },
    ]} />);
    await expectSvgColors(container, PIE_PATHS, CHART_SERIES.slice(0, 2));
  });

  it("keeps all five purchase aging tones with only router context", async () => {
    expect.hasAssertions();
    const { container } = render(<MemoryRouter><ComprasAgingChart totales={{
      vigente: 100, d_1_30: 80, d_31_60: 60, d_61_90: 40, mas_90: 20, total: 300,
    }} /></MemoryRouter>);
    await expectSvgColors(container, ".recharts-bar-rectangle path", [
      CHART.neutral, CHART.info, CHART.warning, CHART.destructiveSoft, CHART.destructive,
    ]);
  });

  it("keeps the latest profitability month highlighted", async () => {
    expect.hasAssertions();
    const { container } = render(<RentabilidadSection margen6m={[
      { mes: "2026-08", margen_pct: 12, utilidad_mxn: 120 },
      { mes: "2026-09", margen_pct: 18, utilidad_mxn: 180 },
      { mes: "2026-10", margen_pct: 24, utilidad_mxn: 240 },
    ]} porModo={[]} />);
    await expectSvgColors(container, ".recharts-bar-rectangle path", [
      "hsl(var(--muted-foreground) / 0.3)", "hsl(var(--muted-foreground) / 0.3)", CHART.primary,
    ]);
  });

  it("keeps losses destructive and preserves the other top-report colors", async () => {
    expect.hasAssertions();
    const { container } = render(<ReportesTopChart isLoading={false} data={[
      { name: "Pérdida", profit: -40 }, { name: "Primera", profit: 100 }, { name: "Segunda", profit: 60 },
    ]} />);
    await expectSvgColors(container, ".recharts-bar-rectangle path", [CHART.destructive, CHART_SERIES[1], CHART_SERIES[2]]);
  });
});
