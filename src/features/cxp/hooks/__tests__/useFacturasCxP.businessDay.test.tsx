/** @vitest-environment jsdom */
import { act, render, renderHook, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FacturaCxP, FetchCxPFiltros } from "../../services/proveedorFacturas";

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));
vi.mock("@/features/cxp/services", async () => ({
  fetchFacturasCxP: fetchMock,
  ...await vi.importActual("@/features/cxp/services/cxpKpis"),
}));
vi.mock("@/components/shared/KpiCard", () => ({
  KpiCard: ({ label, sublabel }: { label: string; sublabel: string }) => <div data-testid={label}>{sublabel}</div>,
}));

import { useFacturasCxP } from "../useFacturasCxP";
import { CxpKpiCards } from "../../components/CxpKpiCards";

function factura(dia: string): FacturaCxP {
  return {
    id: "f1", moneda: "USD", saldo: 95, fecha_vencimiento: "2026-10-03", fecha_programada_pago: null,
    dias_vencido: dia === "2026-10-03" ? 0 : 1,
    estatus: dia === "2026-10-03" ? "Por vencer" : "Vencida",
  } as FacturaCxP;
}

function wrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function Pagina() {
  const { data = [], kpis } = useFacturasCxP();
  return <>
    <span data-testid="fila">{data[0]?.estatus}:{data[0]?.dias_vencido}</span>
    <span data-testid="importe">{kpis.vencido_usd}</span>
    <CxpKpiCards data={data} kpis={kpis} />
  </>;
}

const resolverConsulta = () => act(async () => { await vi.advanceTimersByTimeAsync(1); });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(new Date("2026-10-04T05:59:59Z"));
  fetchMock.mockReset();
  fetchMock.mockImplementation((_filtros: FetchCxPFiltros, dia: string) => Promise.resolve([factura(dia)]));
});
afterEach(() => vi.useRealTimers());

describe("AUD50: snapshot diario de CxP", () => {
  it("la página montada cambia juntas filas, importes y conteos a medianoche", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const view = render(<Pagina />, { wrapper: wrapper(qc) });
    await resolverConsulta();
    expect(screen.getByTestId("fila")).toHaveTextContent("Por vencer:0");
    expect(screen.getByTestId("importe")).toHaveTextContent("0");
    expect(screen.getByTestId("Por vencer 7d")).toHaveTextContent("1 fact.");
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(fetchMock).toHaveBeenLastCalledWith({}, "2026-10-04");
    expect(screen.getByTestId("fila")).toHaveTextContent("Vencida:1");
    expect(screen.getByTestId("importe")).toHaveTextContent("95");
    expect(screen.getByTestId("Vencido")).toHaveTextContent("1 fact.");
    expect(screen.getByTestId("Por vencer 7d")).toHaveTextContent("0 fact.");
    view.unmount();
    qc.clear();
  });

  it("reutiliza caché en el mismo día, pero no el snapshot anterior al reabrir", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const primero = renderHook(() => useFacturasCxP(), { wrapper: wrapper(qc) });
    await resolverConsulta();
    primero.unmount();
    const mismoDia = renderHook(() => useFacturasCxP(), { wrapper: wrapper(qc) });
    await resolverConsulta();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    mismoDia.unmount();

    vi.setSystemTime(new Date("2026-10-04T06:00:01Z"));
    const nuevoDia = renderHook(() => useFacturasCxP(), { wrapper: wrapper(qc) });
    await resolverConsulta();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(nuevoDia.result.current.data?.[0].estatus).toBe("Vencida");
    expect(nuevoDia.result.current.kpis.vencido_usd).toBe(95);
    nuevoDia.unmount();
    qc.clear();
  });

  it("una respuesta iniciada ayer no reemplaza el snapshot de hoy", async () => {
    let resolverAyer: (rows: FacturaCxP[]) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise<FacturaCxP[]>((resolve) => { resolverAyer = resolve; }));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const { result, unmount } = renderHook(() => useFacturasCxP(), { wrapper: wrapper(qc) });
    await act(async () => { await vi.advanceTimersByTimeAsync(1001); });
    expect(result.current.data?.[0].estatus).toBe("Vencida");
    await act(async () => { resolverAyer([factura("2026-10-03")]); });
    await resolverConsulta();
    expect(result.current.data?.[0].estatus).toBe("Vencida");
    expect(result.current.kpis.vencido_usd).toBe(95);
    unmount();
    qc.clear();
  });
});
