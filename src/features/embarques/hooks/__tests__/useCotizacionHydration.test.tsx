import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { useCotizacionHydration } from "../useCotizacionHydration";
import { MemoryRouter } from "react-router-dom";

const mockCot = { id: "cot-1", folio: "COT-001" };

vi.mock("@/hooks/cotizacion", () => ({
  useCotizacion: (id: string) => ({
    data: id === "cot-1" ? mockCot : null,
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const QueryWrapper = createWrapper();
  return (
    <MemoryRouter initialEntries={[{ state: { cotizacionPrevinculadaId: "cot-1" } }]}>
      <QueryWrapper>{children}</QueryWrapper>
    </MemoryRouter>
  );
};

describe("useCotizacionHydration", () => {
  it("llama a onPrevincular cuando detecta id en state", () => {
    const onPrevincular = vi.fn();
    renderHook(() => useCotizacionHydration({ onPrevincular }), { wrapper });
    
    expect(onPrevincular).toHaveBeenCalledWith(mockCot);
  });

  it("no hace nada si no hay id en el state", () => {
    const onPrevincular = vi.fn();
    const emptyWrapper = ({ children }: { children: React.ReactNode }) => {
      const QueryWrapper = createWrapper();
      return (
        <MemoryRouter initialEntries={[{ state: {} }]}>
          <QueryWrapper>{children}</QueryWrapper>
        </MemoryRouter>
      );
    };
    
    renderHook(() => useCotizacionHydration({ onPrevincular }), { wrapper: emptyWrapper });
    expect(onPrevincular).not.toHaveBeenCalled();
  });
});
