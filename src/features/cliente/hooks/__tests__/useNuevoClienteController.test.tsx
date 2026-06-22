import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useNuevoClienteController } from "../useNuevoClienteController";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/features/cliente/hooks/useClientes", () => ({
  useCreateCliente: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({ id: "1", nombre: "Test" }),
    isPending: false,
  })),
}));

vi.mock("@/hooks/shared", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
  useRegistrarActividad: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock("@/features/cliente/services/csf", () => ({
  parseCsf: vi.fn().mockResolvedValue({ nombre: "Parsed Org", rfc: "PARS123", cp: "12345" }),
}));

vi.mock("@/components/shared/utils/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

describe("useNuevoClienteController", () => {
  it("transitions to step 2 when step 1 is valid", () => {
    const { result } = renderHook(() => useNuevoClienteController(vi.fn()), { wrapper: createWrapper() });
    
    act(() => {
      result.current.handleChange("nombre", "Cliente Test");
      result.current.handleChange("rfc", "TEST123456");
      result.current.handleChange("cp", "12345");
      result.current.handleChange("regimen_fiscal", "601");
    });
    
    act(() => {
      result.current.handleNext();
    });
    
    expect(result.current.step).toBe(2);
    expect(result.current.documentos).toHaveLength(11); // DOCS_OBLIGATORIOS length
  });

  it("handles CSF upload and extraction", async () => {
    const { result } = renderHook(() => useNuevoClienteController(vi.fn()), { wrapper: createWrapper() });
    
    const file = new File(["test"], "test.pdf", { type: "application/pdf" });
    const event = { target: { files: [file], value: "" } } as any;
    
    await act(async () => {
      await result.current.handleCsfUpload(event);
    });
    
    expect(result.current.form.nombre).toBe("Parsed Org");
    expect(result.current.form.rfc).toBe("PARS123");
  });
});
