import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test/utils/queryWrapper";
import { DOC_CSF, useNuevoClienteController } from "../useNuevoClienteController";

const mock = vi.hoisted(() => ({
  create: vi.fn(),
  upload: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/features/cliente/hooks/useClientes", () => ({
  useCreateCliente: () => ({ mutateAsync: mock.create, isPending: false }),
}));
vi.mock("@/features/cliente/services/clienteDocumentos", () => ({
  subirDocumentoCliente: mock.upload,
}));
vi.mock("@/features/cliente/services/csf", () => ({ parseCsf: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: mock.success,
  notifyError: mock.error,
}));

function prepararAlta() {
  const onClose = vi.fn();
  const hook = renderHook(() => useNuevoClienteController(onClose), { wrapper: createWrapper() });
  act(() => {
    hook.result.current.handleChange("nombre", "Cliente QA");
    hook.result.current.handleChange("rfc", "XAXX010101000");
    hook.result.current.handleChange("cp", "66350");
    hook.result.current.handleChange("regimen_fiscal", "601");
    hook.result.current.handleChange("email", "qa@example.com");
    hook.result.current.handleChange("telefono", "8180000199");
    hook.result.current.handleChange("contacto", "Contacto QA");
  });
  act(() => {
    hook.result.current.handleNext();
    hook.result.current.handleFileChange(
      DOC_CSF, new File(["QA MOCK CSF"], "qa-csf.pdf", { type: "application/pdf" }),
    );
  });
  return { ...hook, onClose };
}

describe("alta de cliente con CSF persistida", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.create.mockResolvedValue({ id: "cliente-1", nombre: "Cliente QA", organization_id: "org-1" });
    mock.upload.mockResolvedValue({ id: "doc-1" });
  });

  it("no anuncia éxito ni cierra hasta guardar la constancia en el expediente", async () => {
    const { result, onClose } = prepararAlta();
    await act(async () => { await result.current.handleSave(); });

    expect(mock.upload).toHaveBeenCalledWith(expect.objectContaining({
      clienteId: "cliente-1",
      organizationId: "org-1",
      tipo: "Constancia de situación fiscal",
      archivo: expect.objectContaining({ name: "qa-csf.pdf" }),
    }));
    expect(mock.success).toHaveBeenCalledWith(undefined, { title: "Cliente creado exitosamente" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("si falla la carga conserva el cliente y reintenta sin duplicar el alta", async () => {
    mock.upload.mockRejectedValueOnce(new Error("storage indisponible"));
    const { result, onClose } = prepararAlta();
    await act(async () => { await result.current.handleSave(); });

    expect(mock.create).toHaveBeenCalledOnce();
    expect(result.current.clienteCreado?.id).toBe("cliente-1");
    expect(onClose).not.toHaveBeenCalled();
    expect(mock.success).not.toHaveBeenCalled();

    await act(async () => { await result.current.handleSave(); });
    expect(mock.create).toHaveBeenCalledOnce();
    expect(mock.upload).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("no avanza ni guarda con RFC incompleto o CP inválido", async () => {
    const { result } = prepararAlta();
    act(() => {
      result.current.handleChange("rfc", "ABC240101AA");
      result.current.handleChange("cp", "6400");
    });
    expect(result.current.isStep1Valid).toBe(false);
    await act(async () => { await result.current.handleSave(); });
    expect(mock.create).not.toHaveBeenCalled();

    act(() => result.current.setStep(1));
    act(() => result.current.handleNext());
    expect(result.current.step).toBe(1);
  });
});
