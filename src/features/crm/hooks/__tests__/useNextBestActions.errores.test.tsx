/**
 * Auditoría CRM — Mi día no puede confundir error con "Todo al día":
 *  - useNextBestActions propaga isError de signals/cotizaciones/vencidas y
 *    refetch reintenta las tres;
 *  - NextBestActionsCard y CotizacionesSinRespuestaCard muestran el estado de
 *    error con reintento y NO el empty-state de éxito.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, renderHook } from "@testing-library/react";

const useQueryMock = vi.fn();
const cotsSinRespuesta = vi.fn();
const vencidasList = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: unknown) => useQueryMock(opts),
}));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1", email: "v@x.com" } }),
}));
vi.mock("@/features/crm/hooks/useCotizacionesSinRespuesta", () => ({
  useCotizacionesSinRespuesta: (...a: unknown[]) => cotsSinRespuesta(...a),
}));
vi.mock("@/features/crm/hooks/useCrmDashboard", () => ({
  useActividadesVencidasList: (...a: unknown[]) => vencidasList(...a),
}));
vi.mock("@/components/shared/dataTable/DrilldownRow", () => ({
  DrilldownRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { useNextBestActions } from "../useNextBestActions";
import { NextBestActionsCard } from "@/features/crm/components/crmDashboard/NextBestActionsCard";
import { CotizacionesSinRespuestaCard } from "@/features/crm/components/crmDashboard/CotizacionesSinRespuestaCard";

interface Q { data?: unknown; isLoading?: boolean; isError?: boolean; refetch: () => void }
const ok = (data: unknown): Q => ({ data, isLoading: false, isError: false, refetch: vi.fn() });

beforeEach(() => {
  useQueryMock.mockReset();
  cotsSinRespuesta.mockReset();
  vencidasList.mockReset();
  useQueryMock.mockReturnValue(ok({
    leadsSinContactar: [], oportunidadesAbiertas: [],
  }));
  cotsSinRespuesta.mockReturnValue(ok([]));
  vencidasList.mockReturnValue(ok([]));
});

describe("useNextBestActions — propagación de errores", () => {
  it("fallo de signals → isError y sin items fingidos", () => {
    useQueryMock.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    const { result } = renderHook(() => useNextBestActions(5));
    expect(result.current.isError).toBe(true);
    expect(result.current.items).toEqual([]);
  });

  it("fallo de cotizaciones → isError", () => {
    cotsSinRespuesta.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    const { result } = renderHook(() => useNextBestActions(5));
    expect(result.current.isError).toBe(true);
  });

  it("fallo de vencidas → isError; refetch reintenta las tres consultas", () => {
    const r1 = vi.fn(); const r2 = vi.fn(); const r3 = vi.fn();
    useQueryMock.mockReturnValue({ ...ok({ leadsSinContactar: [], oportunidadesAbiertas: [] }), refetch: r1 });
    cotsSinRespuesta.mockReturnValue({ ...ok([]), refetch: r2 });
    vencidasList.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: r3 });
    const { result } = renderHook(() => useNextBestActions(5));
    expect(result.current.isError).toBe(true);
    result.current.refetch();
    expect(r1).toHaveBeenCalledTimes(1);
    expect(r2).toHaveBeenCalledTimes(1);
    expect(r3).toHaveBeenCalledTimes(1);
  });

  it("sin errores y sin pendientes conserva lista vacía (éxito real)", () => {
    const { result } = renderHook(() => useNextBestActions(5));
    expect(result.current.isError).toBe(false);
    expect(result.current.items).toEqual([]);
  });
});

describe("Tarjetas de Mi día — error vs vacío", () => {
  it("NextBestActionsCard con error muestra reintento y NO 'Todo al día'", () => {
    const onRetry = vi.fn();
    render(<NextBestActionsCard items={[]} isLoading={false} isError onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/Todo al día/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("NextBestActionsCard sin error y vacía sí muestra 'Todo al día'", () => {
    render(<NextBestActionsCard items={[]} isLoading={false} />);
    expect(screen.getByText(/Todo al día/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("CotizacionesSinRespuestaCard con error muestra reintento y NO el empty de éxito", () => {
    const onRetry = vi.fn();
    render(<CotizacionesSinRespuestaCard items={[]} isError onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/Todas las cotizaciones/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("CotizacionesSinRespuestaCard sin error y vacía sí muestra su empty", () => {
    render(<CotizacionesSinRespuestaCard items={[]} />);
    expect(screen.getByText(/Todas las cotizaciones/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
