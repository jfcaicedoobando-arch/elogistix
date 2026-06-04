import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { useNuevoEmbarqueCotVinculada } from "../useNuevoEmbarqueCotVinculada";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/services/cotizacion", () => ({
  fetchCotizacionCostosForEmbarque: vi.fn().mockResolvedValue([]),
}));

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
});
