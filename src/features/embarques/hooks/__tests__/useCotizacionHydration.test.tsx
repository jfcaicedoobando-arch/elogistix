import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { useCotizacionHydration } from "../useCotizacionHydration";
import { MemoryRouter } from "react-router-dom";

const mockCot = { id: "cot-1", folio: "COT-001" };

vi.mock("@/features/cotizacion/hooks", () => ({
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
  it("llama a onPrevincular cuando detecta id en state", async () => {
    const onPrevincular = vi.fn();
    renderHook(() => useCotizacionHydration({ onPrevincular }), { wrapper });

    await waitFor(() => {
      expect(onPrevincular).toHaveBeenCalledWith(mockCot);
    });
    expect(onPrevincular).toHaveBeenCalledTimes(1);
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
