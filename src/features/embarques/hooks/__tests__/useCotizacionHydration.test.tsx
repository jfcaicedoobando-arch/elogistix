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

// v13.137.36: `createWrapper()` se invoca una vez por test (no dentro del cuerpo
// del componente wrapper). Antes cada re-render creaba un QueryClient nuevo y
// sobrescribía `globalThis.__TEST_QUERY_CLIENT__` → leak + context churn.
const makeWrapper = (initialState: unknown) => {
  const QueryWrapper = createWrapper();
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[{ state: initialState }]}>
      <QueryWrapper>{children}</QueryWrapper>
    </MemoryRouter>
  );
};

describe("useCotizacionHydration", () => {
  it("llama a onPrevincular cuando detecta id en state", async () => {
    const onPrevincular = vi.fn();
    renderHook(() => useCotizacionHydration({ onPrevincular }), {
      wrapper: makeWrapper({ cotizacionPrevinculadaId: "cot-1" }),
    });

    await waitFor(() => {
      expect(onPrevincular).toHaveBeenCalledWith(mockCot);
    });
    expect(onPrevincular).toHaveBeenCalledTimes(1);
  });

  it("no hace nada si no hay id en el state", () => {
    const onPrevincular = vi.fn();
    renderHook(() => useCotizacionHydration({ onPrevincular }), {
      wrapper: makeWrapper({}),
    });
    expect(onPrevincular).not.toHaveBeenCalled();
  });
});
