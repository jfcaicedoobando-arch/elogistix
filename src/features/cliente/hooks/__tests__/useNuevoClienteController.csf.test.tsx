import type { ChangeEvent } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DOC_CSF, useNuevoClienteController } from "../useNuevoClienteController";

const mock = vi.hoisted(() => ({ parse: vi.fn(), create: vi.fn(), upload: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/features/cliente/hooks/useClientes", () => ({ useCreateCliente: () => ({ mutateAsync: mock.create, isPending: false }) }));
vi.mock("@/features/cliente/services/csf", () => ({ parseCsf: mock.parse }));
vi.mock("@/features/cliente/services/clienteDocumentos", () => ({ subirDocumentoCliente: mock.upload }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: mock.success, notifyError: mock.error }));

const pdf = (name = "synthetic.pdf") => new File(["%PDF-1.4\n% synthetic test fixture\n%%EOF"], name, { type: "application/pdf" });
function event(file?: File) {
  return { target: { files: file ? [file] : [], value: "" } } as ChangeEvent<HTMLInputElement>;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function setup() {
  const close = vi.fn();
  const hook = renderHook(() => useNuevoClienteController(close));
  act(() => {
    hook.result.current.handleChange("nombre", "Synthetic client");
    hook.result.current.handleChange("rfc", "XAXX010101000");
    hook.result.current.handleChange("cp", "12345");
    hook.result.current.handleChange("regimen_fiscal", "601");
    hook.result.current.handleChange("email", "test@example.com");
    hook.result.current.handleChange("telefono", "5555555555");
    hook.result.current.handleChange("contacto", "Test");
  });
  return { ...hook, close };
}

describe("single CSF selection across client wizard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mock.parse.mockResolvedValue({ nombre: "Extracted synthetic client" });
    mock.create.mockResolvedValue({ id: "synthetic-client", organization_id: "synthetic-org" });
    mock.upload.mockResolvedValue({ id: "synthetic-doc" });
  });

  it("retains the exact PDF through extraction, back/next and final persistence", async () => {
    const { result, close } = setup();
    const file = pdf();
    await act(async () => { await result.current.handleCsfUpload(event(file)); });
    act(() => result.current.handleNext());
    expect(result.current.documentos.find(d => d.nombre === DOC_CSF)).toMatchObject({ adjuntado: true, archivo: file.name });
    expect(result.current.csfParsed).toBe(true);
    act(() => result.current.setStep(1));
    act(() => result.current.handleNext());
    expect(result.current.csfFile).toBe(file);
    await act(async () => { await result.current.handleSave(); });
    expect(mock.parse).toHaveBeenCalledOnce();
    expect(mock.upload.mock.calls[0][0].archivo).toBe(file);
    expect(close).toHaveBeenCalledOnce();
    expect(result.current.csfFile).toBeNull();
  });

  it("keeps the PDF when extraction fails so manual entry does not require reattachment", async () => {
    mock.parse.mockRejectedValue(new Error("Synthetic extraction failure"));
    const { result } = setup();
    const file = pdf();
    await act(async () => { await result.current.handleCsfUpload(event(file)); });
    act(() => result.current.handleNext());
    expect(result.current.docsRequeridosCompletos).toBe(true);
    expect(result.current.csfParsed).toBe(false);
    expect(result.current.csfFile).toBe(file);
    expect(result.current.form.nombre).toBe("SYNTHETIC CLIENT");
    await act(async () => { await result.current.handleSave(); });
    expect(mock.upload.mock.calls[0][0].archivo).toBe(file);
  });

  it("blocks Next while extraction is pending and retains its file immediately", async () => {
    const pending = deferred<{ nombre: string }>();
    mock.parse.mockReturnValue(pending.promise);
    const { result } = setup();
    const file = pdf();
    let upload!: Promise<void>;
    act(() => { upload = result.current.handleCsfUpload(event(file)); });
    expect(result.current.csfFile).toBe(file);
    act(() => result.current.handleNext());
    expect(result.current.step).toBe(1);
    await act(async () => { pending.resolve({ nombre: "Synthetic parsed" }); await upload; });
    act(() => result.current.handleNext());
    expect(result.current.docsRequeridosCompletos).toBe(true);
  });

  it("replacement and removal stay consistent across Back/Next", async () => {
    const { result } = setup();
    await act(async () => { await result.current.handleCsfUpload(event(pdf())); });
    act(() => result.current.handleNext());
    const replacement = pdf("replacement.pdf");
    act(() => result.current.handleFileChange(DOC_CSF, replacement));
    act(() => result.current.setStep(1));
    act(() => result.current.handleNext());
    expect(result.current.documentos[0].archivo).toBe(replacement.name);
    expect(result.current.csfParsed).toBe(false);
    act(() => result.current.handleFileChange(DOC_CSF, undefined));
    expect(result.current.docsRequeridosCompletos).toBe(false);
    expect(result.current.csfFile).toBeNull();
    act(() => result.current.setStep(1));
    act(() => result.current.handleNext());
    expect(result.current.documentos[0].adjuntado).toBe(false);
    await act(async () => { await result.current.handleSave(); });
    expect(mock.create).not.toHaveBeenCalled();
  });

  it("retries persistence of the same original PDF without creating a duplicate customer", async () => {
    mock.upload.mockRejectedValueOnce(new Error("Synthetic storage failure"));
    const { result } = setup();
    const file = pdf();
    await act(async () => { await result.current.handleCsfUpload(event(file)); });
    act(() => result.current.handleNext());
    await act(async () => { await result.current.handleSave(); });
    expect(result.current.csfFile).toBe(file);
    await act(async () => { await result.current.handleSave(); });
    expect(mock.create).toHaveBeenCalledOnce();
    expect(mock.upload).toHaveBeenCalledTimes(2);
    expect(mock.upload.mock.calls.every(([arg]) => arg.archivo === file)).toBe(true);
  });

  it.each(["resolve", "reject"] as const)("discard isolates a new customer from late parse %s", async settlement => {
    const pending = deferred<{ nombre: string }>();
    mock.parse.mockReturnValueOnce(pending.promise);
    const { result } = setup();
    let upload!: Promise<void>;
    act(() => { upload = result.current.handleCsfUpload(event(pdf("discarded.pdf"))); });
    act(() => result.current.resetAndClose());
    const fresh = pdf("fresh.pdf");
    await act(async () => { await result.current.handleCsfUpload(event(fresh)); });
    mock.success.mockClear();
    mock.error.mockClear();
    await act(async () => {
      if (settlement === "resolve") pending.resolve({ nombre: "STALE" });
      else pending.reject(new Error("STALE"));
      await upload;
    });
    expect(result.current.form.nombre).toBe("EXTRACTED SYNTHETIC CLIENT");
    expect(result.current.csfFile).toBe(fresh);
    expect(result.current.parsingCsf).toBe(false);
    expect(mock.success).not.toHaveBeenCalled();
    expect(mock.error).not.toHaveBeenCalled();
  });

  it("latest selection wins out-of-order extraction", async () => {
    const first = deferred<{ nombre: string }>();
    const second = deferred<{ nombre: string }>();
    mock.parse.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = setup();
    let old!: Promise<void>;
    let latest!: Promise<void>;
    act(() => { old = result.current.handleCsfUpload(event(pdf("old.pdf"))); });
    const file = pdf("new.pdf");
    act(() => { latest = result.current.handleCsfUpload(event(file)); });
    await act(async () => { first.resolve({ nombre: "OLD" }); await old; });
    expect(result.current.parsingCsf).toBe(true);
    expect(result.current.form.nombre).toBe("SYNTHETIC CLIENT");
    await act(async () => { second.resolve({ nombre: "NEW" }); await latest; });
    expect(result.current.form.nombre).toBe("NEW");
    expect(result.current.csfFile).toBe(file);
  });

  it("allows the same PDF to be retried after extraction failure", async () => {
    mock.parse.mockRejectedValueOnce(new Error("Synthetic first attempt"));
    const { result } = setup();
    const file = pdf();
    const inputEvent = event(file);
    inputEvent.target.value = "selected";
    await act(async () => { await result.current.handleCsfUpload(inputEvent); });
    expect(inputEvent.target.value).toBe("");
    await act(async () => { await result.current.handleCsfUpload(event(file)); });
    expect(mock.parse).toHaveBeenCalledTimes(2);
    expect(result.current.csfFile).toBe(file);
    expect(result.current.csfParsed).toBe(true);
  });

  it("does not adopt an oversized PDF that the document checklist would reject", async () => {
    const { result } = setup();
    const file = pdf();
    Object.defineProperty(file, "size", { value: 15 * 1024 * 1024 + 1 });
    await act(async () => { await result.current.handleCsfUpload(event(file)); });
    expect(result.current.csfFile).toBeNull();
    expect(mock.parse).not.toHaveBeenCalled();
  });

  it("ignores extraction after the dialog unmounts", async () => {
    const pending = deferred<{ nombre: string }>();
    mock.parse.mockReturnValueOnce(pending.promise);
    const { result, unmount } = setup();
    let upload!: Promise<void>;
    act(() => { upload = result.current.handleCsfUpload(event(pdf())); });
    unmount();
    await act(async () => { pending.resolve({ nombre: "STALE" }); await upload; });
    expect(mock.success).not.toHaveBeenCalled();
    expect(mock.error).not.toHaveBeenCalled();
  });

  it("cancelled or invalid selection does not replace an attached PDF", async () => {
    const { result } = setup();
    const file = pdf();
    await act(async () => { await result.current.handleCsfUpload(event(file)); });
    await act(async () => { await result.current.handleCsfUpload(event()); });
    await act(async () => { await result.current.handleCsfUpload(event(new File(["invalid"], "invalid.txt", { type: "text/plain" }))); });
    expect(result.current.csfFile).toBe(file);
    expect(mock.parse).toHaveBeenCalledOnce();
  });
});
