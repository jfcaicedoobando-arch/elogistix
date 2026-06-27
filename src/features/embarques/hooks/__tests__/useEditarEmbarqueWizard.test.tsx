import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { useEditarEmbarqueWizard } from "../useEditarEmbarqueWizard";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "test@example.com" } }),
}));

vi.mock("../useEmbarques", () => ({
  useEmbarque: (id: string) => ({ data: id ? { id, expediente: "EXP-001", cliente_id: "cli-1" } : null, isLoading: false }),
  useEmbarqueConceptosVenta: () => ({ data: [], isLoading: false }),
  useEmbarqueConceptosCosto: () => ({ data: [], isLoading: false }),
  useProveedoresForSelect: () => ({ data: [] }),
  useUpdateEmbarque: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("../useContenedoresEmbarque", () => ({
  useContenedoresEmbarque: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/features/cliente/hooks/useClientes", () => ({
  useClientesForSelect: () => ({ data: [{ id: "cli-1", nombre: "Cliente 1" }] }),
  useContactosCliente: () => ({ data: [] }),
}));

vi.mock("@/hooks/shared", () => ({
  useToast: () => ({ toast: vi.fn() }),
  useRegistrarActividad: () => ({ mutate: vi.fn() }),
  useDebounce: (v: any) => v,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const QueryWrapper = createWrapper();
  return (
    <MemoryRouter>
      <QueryWrapper>{children}</QueryWrapper>
    </MemoryRouter>
  );
};

describe("useEditarEmbarqueWizard", () => {
  it("carga datos del embarque e inicializa formulario", async () => {
    const { result } = renderHook(() => useEditarEmbarqueWizard("emb-1"), { wrapper });

    expect(result.current.embarque?.expediente).toBe("EXP-001");
    // v13.137.24: el `useEffect` de inicialización corre tras el primer render;
    // sin `waitFor` el assert era un falso positivo/negativo dependiendo del scheduler.
    await waitFor(() =>
      expect(result.current.methods.getValues("clienteId")).toBe("cli-1"),
    );
  });

  it("permite cambiar de paso", () => {
    const { result } = renderHook(() => useEditarEmbarqueWizard("emb-1"), { wrapper });
    
    act(() => {
      result.current.setCurrentStep(2);
    });
    
    expect(result.current.currentStep).toBe(2);
  });
});
