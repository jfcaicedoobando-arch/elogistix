import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useNuevoClienteController, DOC_CSF } from "../useNuevoClienteController";
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

vi.mock("@/lib/ui/appFeedback", () => ({
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
      // B-024: email/teléfono/contacto son obligatorios en paso 1.
      result.current.handleChange("email", "test@example.com");
      result.current.handleChange("telefono", "5555555555");
      result.current.handleChange("contacto", "Juan Pérez");
    });
    
    act(() => {
      result.current.handleNext();
    });
    
    expect(result.current.step).toBe(2);
    expect(result.current.documentos).toHaveLength(11); // DOCS_OBLIGATORIOS length
  });

  it("P-08: sólo la CSF bloquea el alta; el resto del expediente es opcional", () => {
    const { result } = renderHook(() => useNuevoClienteController(vi.fn()), { wrapper: createWrapper() });

    act(() => {
      result.current.handleChange("nombre", "Cliente Test");
      result.current.handleChange("rfc", "TEST123456");
      result.current.handleChange("cp", "12345");
      result.current.handleChange("regimen_fiscal", "601");
      result.current.handleChange("email", "test@example.com");
      result.current.handleChange("telefono", "5555555555");
      result.current.handleChange("contacto", "Juan Pérez");
    });
    act(() => { result.current.handleNext(); });

    expect(result.current.docsRequeridosCompletos).toBe(false);

    act(() => {
      result.current.handleFileChange(
        DOC_CSF,
        new File(["x"], "csf.pdf", { type: "application/pdf" }),
      );
    });

    expect(result.current.docsRequeridosCompletos).toBe(true);
    expect(result.current.documentos.filter((d) => d.requerido).length).toBe(1);
  });

  it("handles CSF upload and extraction", async () => {
    const { result } = renderHook(() => useNuevoClienteController(vi.fn()), { wrapper: createWrapper() });
    
    const file = new File(["test"], "test.pdf", { type: "application/pdf" });
    const event = { target: { files: [file], value: "" } } as any;
    
    await act(async () => {
      await result.current.handleCsfUpload(event);
    });
    
    expect(result.current.form.nombre).toBe("PARSED ORG");
    expect(result.current.form.rfc).toBe("PARS123");
  });
});

describe("useNuevoClienteController — correo del paso 1 (auditoría v13.823.75)", () => {
  const llenarBase = (r: { handleChange: (k: never, v: never) => void }) => {
    const set = r.handleChange as unknown as (k: string, v: string) => void;
    set("nombre", "Cliente QA");
    set("rfc", "TEST123456");
    set("cp", "12345");
    set("regimen_fiscal", "601");
    set("telefono", "5555555555");
    set("contacto", "Juan Pérez");
  };

  it("un correo válido conserva su valor y permite avanzar", () => {
    const { result } = renderHook(() => useNuevoClienteController(vi.fn()), { wrapper: createWrapper() });
    act(() => {
      llenarBase(result.current as never);
      (result.current.handleChange as unknown as (k: string, v: string) => void)(
        "email",
        "qa.cliente@gmail.com",
      );
    });
    expect(result.current.form.email).toBe("qa.cliente@gmail.com");
    act(() => { result.current.handleNext(); });
    expect(result.current.step).toBe(2);
  });

  it("un correo con formato inválido bloquea 'Siguiente'", () => {
    const { result } = renderHook(() => useNuevoClienteController(vi.fn()), { wrapper: createWrapper() });
    act(() => {
      llenarBase(result.current as never);
      (result.current.handleChange as unknown as (k: string, v: string) => void)("email", "qa.cliente@");
    });
    act(() => { result.current.handleNext(); });
    expect(result.current.step).toBe(1);
  });
});
