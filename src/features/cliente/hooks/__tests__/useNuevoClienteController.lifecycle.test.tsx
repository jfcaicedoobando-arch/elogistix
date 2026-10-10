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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const client = { id: "synthetic-client", organization_id: "synthetic-org" };

describe("client save lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.create.mockResolvedValue(client);
    mock.upload.mockResolvedValue({ id: "synthetic-document" });
  });

  it("locks creation synchronously against repeat save and discard, then closes once", async () => {
    const create = deferred<typeof client>();
    const upload = deferred<unknown>();
    mock.create.mockReturnValue(create.promise);
    mock.upload.mockReturnValue(upload.promise);
    const { result, onClose } = prepararAlta();
    let saving!: Promise<void>;
    act(() => {
      saving = result.current.handleSave();
      void result.current.handleSave();
      result.current.resetAndClose();
    });
    expect(mock.create).toHaveBeenCalledOnce();
    expect(result.current.isSaving).toBe(true);
    expect(result.current.step).toBe(2);
    expect(result.current.csfFile?.name).toBe("qa-csf.pdf");
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { create.resolve(client); await create.promise; });
    expect(mock.upload).toHaveBeenCalledOnce();
    expect(result.current.isSaving).toBe(true);
    act(() => { result.current.resetAndClose(); void result.current.handleSave(); });
    expect(onClose).not.toHaveBeenCalled();
    expect(mock.upload).toHaveBeenCalledOnce();
    await act(async () => { upload.resolve({}); await saving; });
    expect(result.current.isSaving).toBe(false);
    expect(result.current.step).toBe(1);
    expect(result.current.csfFile).toBeNull();
    expect(onClose).toHaveBeenCalledOnce();
    act(() => result.current.handleChange("nombre", "Fresh synthetic draft"));
    expect(result.current.form.nombre).toBe("FRESH SYNTHETIC DRAFT");
  });

  it("unlocks after a creation failure and allows a fresh attempt", async () => {
    mock.create.mockRejectedValueOnce(new Error("Synthetic creation failure"));
    const { result, onClose } = prepararAlta();
    await act(async () => { await result.current.handleSave(); });
    expect(result.current.isSaving).toBe(false);
    expect(result.current.clienteCreado).toBeNull();
    expect(mock.upload).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { await result.current.handleSave(); });
    expect(mock.create).toHaveBeenCalledTimes(2);
    expect(mock.upload).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("unlocks a failed upload and locks the retry without creating another client", async () => {
    mock.upload.mockRejectedValueOnce(new Error("Synthetic upload failure"));
    const { result, onClose } = prepararAlta();
    await act(async () => { await result.current.handleSave(); });
    expect(result.current.isSaving).toBe(false);
    expect(result.current.clienteCreado?.id).toBe(client.id);
    const upload = deferred<unknown>();
    mock.upload.mockReturnValueOnce(upload.promise);
    let retry!: Promise<void>;
    act(() => { retry = result.current.handleSave(); void result.current.handleSave(); result.current.resetAndClose(); });
    expect(result.current.isSaving).toBe(true);
    expect(mock.create).toHaveBeenCalledOnce();
    expect(mock.upload).toHaveBeenCalledTimes(2);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { upload.resolve({}); await retry; });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("allows deliberate discard after upload failure without pretending to cancel the created client", async () => {
    mock.upload.mockRejectedValueOnce(new Error("Synthetic upload failure"));
    const { result, onClose } = prepararAlta();
    await act(async () => { await result.current.handleSave(); });
    act(() => result.current.resetAndClose());
    expect(result.current.clienteCreado).toBeNull();
    expect(result.current.csfFile).toBeNull();
    expect(onClose).toHaveBeenCalledOnce();
    expect(mock.create).toHaveBeenCalledOnce();
  });

  it.each(["resolve", "reject"] as const)("does not close or notify a replacement dialog after unmount and upload %s", async settlement => {
    const upload = deferred<unknown>();
    mock.upload.mockReturnValue(upload.promise);
    const { result, unmount, onClose } = prepararAlta();
    let saving!: Promise<void>;
    await act(async () => { saving = result.current.handleSave(); await Promise.resolve(); });
    unmount();
    const fresh = prepararAlta();
    act(() => fresh.result.current.handleChange("nombre", "Fresh synthetic draft"));
    await act(async () => {
      if (settlement === "resolve") upload.resolve({});
      else upload.reject(new Error("Synthetic late failure"));
      await saving;
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(fresh.onClose).not.toHaveBeenCalled();
    expect(mock.success).not.toHaveBeenCalled();
    expect(mock.error).not.toHaveBeenCalled();
    expect(fresh.result.current.form.nombre).toBe("FRESH SYNTHETIC DRAFT");
  });
  it.each(["resolve", "reject"] as const)("handles unmount during creation followed by %s without stale UI effects", async settlement => {
    const create = deferred<typeof client>();
    mock.create.mockReturnValueOnce(create.promise);
    const { result, unmount, onClose } = prepararAlta();
    let saving!: Promise<void>;
    act(() => { saving = result.current.handleSave(); });
    unmount();
    await act(async () => {
      if (settlement === "resolve") create.resolve(client);
      else create.reject(new Error("Synthetic late creation failure"));
      await saving;
    });
    expect(mock.upload).toHaveBeenCalledTimes(settlement === "resolve" ? 1 : 0);
    expect(onClose).not.toHaveBeenCalled();
    expect(mock.success).not.toHaveBeenCalled();
    expect(mock.error).not.toHaveBeenCalled();
  });

});
