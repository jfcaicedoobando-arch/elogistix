import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { useNuevoEmbarqueCotVinculada } from "../useNuevoEmbarqueCotVinculada";
import { MemoryRouter } from "react-router-dom";

const fetchCostos = vi.hoisted(() => vi.fn());
vi.mock("@/features/cotizacion/services", () => ({ fetchCotizacionCostosForEmbarque: fetchCostos }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn() }));

vi.mock("../useCotizacionHydration", () => ({
  useCotizacionHydration: vi.fn(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const QueryWrapper = createWrapper();
  return (
    <MemoryRouter>
      <QueryWrapper>{children}</QueryWrapper>
    </MemoryRouter>
  );
};

describe("useNuevoEmbarqueCotVinculada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchCostos.mockResolvedValue([]);
  });
  it("gestiona la vinculación de cotización", async () => {
    const mockForm = {
      vincularCotizacion: vi.fn(),
      desvincularCotizacion: vi.fn(),
    };
    const { result } = renderHook(() => useNuevoEmbarqueCotVinculada({
      form: mockForm as any,
      setConceptosVenta: vi.fn(),
      setConceptosCosto: vi.fn(),
      proveedoresDb: [],
      onClearExpediente: vi.fn(),
    }), { wrapper });

    const mockCot = { id: "cot-1", folio: "COT-001" };
    
    await act(async () => {
      result.current.handleVincularCotizacion(mockCot as any);
    });

    expect(result.current.cotizacionVinculada).toEqual(mockCot);
    expect(mockForm.vincularCotizacion).toHaveBeenCalledWith(mockCot);
  });

  it("expone rechazo y permite reintentar", async () => {
    fetchCostos.mockRejectedValueOnce(new Error("sin conexión")).mockResolvedValueOnce([]);
    const props = {
      form: { vincularCotizacion: vi.fn(), desvincularCotizacion: vi.fn() },
      setConceptosVenta: vi.fn(), setConceptosCosto: vi.fn(), proveedoresDb: [], onClearExpediente: vi.fn(),
    };
    const { result } = renderHook(() => useNuevoEmbarqueCotVinculada(props), { wrapper });
    await act(async () => { result.current.handleVincularCotizacion({ id: "cot-1" } as never); });
    expect(result.current.errorCostosVinculados).toBe(true);
    await act(async () => { result.current.reintentarCostosVinculados(); });
    expect(result.current.errorCostosVinculados).toBe(false);
  });

  it("una respuesta vacía limpia costos de la cotización anterior", async () => {
    const setCosto = vi.fn();
    const props = {
      form: { vincularCotizacion: vi.fn(), desvincularCotizacion: vi.fn() },
      setConceptosVenta: vi.fn(), setConceptosCosto: setCosto, proveedoresDb: [], onClearExpediente: vi.fn(),
    };
    const { result } = renderHook(() => useNuevoEmbarqueCotVinculada(props), { wrapper });
    await act(async () => { result.current.handleVincularCotizacion({ id: "cot-vacia" } as never); });
    expect(setCosto).toHaveBeenLastCalledWith([]);
  });

  it("no pisa cambios locales cuando una respuesta llega tarde", async () => {
    let resolver: (value: unknown[]) => void = () => undefined;
    fetchCostos.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
    const setCosto = vi.fn();
    const props = {
      form: { vincularCotizacion: vi.fn(), desvincularCotizacion: vi.fn() },
      setConceptosVenta: vi.fn(), setConceptosCosto: setCosto, proveedoresDb: [], onClearExpediente: vi.fn(),
    };
    const { result } = renderHook(() => useNuevoEmbarqueCotVinculada(props), { wrapper });
    act(() => { result.current.handleVincularCotizacion({ id: "cot-lenta" } as never); });
    act(() => { result.current.marcarCostosEditados(); });
    await act(async () => { resolver([{ concepto: "Flete", costo_unitario: 1, cantidad: 1, costo_total: 1, moneda: "USD", proveedor: null }]); });
    expect(setCosto).toHaveBeenCalledTimes(1);
    expect(setCosto).toHaveBeenLastCalledWith([]);
  });

  it("desvincular y restaurar invalidan una respuesta en vuelo", async () => {
    let resolver: (value: unknown[]) => void = () => undefined;
    fetchCostos.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
    const setCosto = vi.fn();
    const props = {
      form: { vincularCotizacion: vi.fn(), desvincularCotizacion: vi.fn() },
      setConceptosVenta: vi.fn(), setConceptosCosto: setCosto, proveedoresDb: [], onClearExpediente: vi.fn(),
    };
    const { result } = renderHook(() => useNuevoEmbarqueCotVinculada(props), { wrapper });
    act(() => { result.current.handleVincularCotizacion({ id: "cot-a" } as never); });
    act(() => { result.current.restaurarVinculacion({ id: "cot-draft" } as never); });
    await act(async () => { resolver([{ concepto: "Flete", costo_unitario: 1, cantidad: 1, costo_total: 1, moneda: "USD", proveedor: null }]); });
    expect(setCosto).toHaveBeenCalledTimes(1);
  });

  // R201-COT-06 (remate)
  it("el reintento de costos no repone las ventas capturadas", async () => {
    fetchCostos.mockRejectedValueOnce(new Error("sin conexión")).mockResolvedValueOnce([]);
    const setVenta = vi.fn();
    const props = {
      form: { vincularCotizacion: vi.fn(), desvincularCotizacion: vi.fn() },
      setConceptosVenta: setVenta, setConceptosCosto: vi.fn(), proveedoresDb: [], onClearExpediente: vi.fn(),
    };
    const { result } = renderHook(() => useNuevoEmbarqueCotVinculada(props), { wrapper });
    await act(async () => { result.current.handleVincularCotizacion({ id: "cot-1" } as never); });
    expect(setVenta).toHaveBeenCalledTimes(1);
    await act(async () => { result.current.reintentarCostosVinculados(); });
    expect(setVenta).toHaveBeenCalledTimes(1);
    expect(result.current.errorCostosVinculados).toBe(false);
  });

  it("un reintento fallido tampoco repone las ventas", async () => {
    fetchCostos.mockRejectedValue(new Error("sin conexión"));
    const setVenta = vi.fn();
    const props = {
      form: { vincularCotizacion: vi.fn(), desvincularCotizacion: vi.fn() },
      setConceptosVenta: setVenta, setConceptosCosto: vi.fn(), proveedoresDb: [], onClearExpediente: vi.fn(),
    };
    const { result } = renderHook(() => useNuevoEmbarqueCotVinculada(props), { wrapper });
    await act(async () => { result.current.handleVincularCotizacion({ id: "cot-1" } as never); });
    await act(async () => { result.current.reintentarCostosVinculados(); });
    expect(setVenta).toHaveBeenCalledTimes(1);
    expect(result.current.errorCostosVinculados).toBe(true);
  });

  it("bloquea la edición de costos mientras la importación no se resuelve", async () => {
    let resolver: (value: unknown[]) => void = () => undefined;
    fetchCostos.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
    const props = {
      form: { vincularCotizacion: vi.fn(), desvincularCotizacion: vi.fn() },
      setConceptosVenta: vi.fn(), setConceptosCosto: vi.fn(), proveedoresDb: [], onClearExpediente: vi.fn(),
    };
    const { result } = renderHook(() => useNuevoEmbarqueCotVinculada(props), { wrapper });
    act(() => { result.current.handleVincularCotizacion({ id: "cot-lenta" } as never); });
    expect(result.current.costosBloqueados).toBe(true);
    await act(async () => { resolver([]); });
    expect(result.current.costosBloqueados).toBe(false);
  });

  it("si descarta la importación por captura local, no la declara completa", async () => {
    let resolver: (value: unknown[]) => void = () => undefined;
    fetchCostos.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
    const props = {
      form: { vincularCotizacion: vi.fn(), desvincularCotizacion: vi.fn() },
      setConceptosVenta: vi.fn(), setConceptosCosto: vi.fn(), proveedoresDb: [], onClearExpediente: vi.fn(),
    };
    const { result } = renderHook(() => useNuevoEmbarqueCotVinculada(props), { wrapper });
    act(() => { result.current.handleVincularCotizacion({ id: "cot-lenta" } as never); });
    act(() => { result.current.marcarCostosEditados(); });
    await act(async () => { resolver([{ concepto: "Flete", costo_unitario: 1, cantidad: 1, costo_total: 1, moneda: "USD", proveedor: null }]); });
    expect(result.current.errorCostosVinculados).toBe(true);
  });
});

