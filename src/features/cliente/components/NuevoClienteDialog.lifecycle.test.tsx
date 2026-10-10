import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NuevoClienteDialog from "./NuevoClienteDialog";

const mock = vi.hoisted(() => ({ parse: vi.fn(), create: vi.fn(), upload: vi.fn() }));
vi.mock("@/features/cliente/hooks", async () => {
  const { useNuevoClienteController } = await import("../hooks/useNuevoClienteController");
  return { useNuevoClienteController };
});
vi.mock("@/features/cliente/hooks/useClientes", () => ({ useCreateCliente: () => ({ mutateAsync: mock.create, isPending: false }) }));
vi.mock("@/features/cliente/services/csf", () => ({ parseCsf: mock.parse }));
vi.mock("@/features/cliente/services/clienteDocumentos", () => ({ subirDocumentoCliente: mock.upload }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
vi.mock("@/components/shared/FormDialogSection", () => ({ FormDialogSection: ({ children }: { children: ReactNode }) => <section>{children}</section> }));
// Fiscal selects are unrelated to the attachment flow; ordinary required fields remain real.
vi.mock("./NuevoClienteFormPieces", async importOriginal => ({
  ...await importOriginal<typeof import("./NuevoClienteFormPieces")>(),
  ClienteFiscalSelects: ({ onChange }: { onChange: (key: "regimen_fiscal", value: string) => void }) =>
    <button onClick={() => onChange("regimen_fiscal", "601")}>Use test fiscal regime</button>,
}));
function fill() {
  for (const [label, value] of [["RFC", "XAXX010101000"], ["Código Postal", "12345"], ["Nombre / Razón Social", "Synthetic"], ["Contacto", "Test"], ["Email", "test@example.com"], ["Teléfono", "5555555555"]]) {
    fireEvent.change(screen.getByLabelText(new RegExp(label)), { target: { value } });
  }
  fireEvent.click(screen.getByText("Use test fiscal regime"));
}
function selectOriginal(container: HTMLElement, file: File) {
  // Exercise the actual controller-bound input without synthesizing browser DataTransfer.
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("CSF input missing");
  fireEvent.change(input, { target: { files: [file] } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => { resolve = res; });
  return { promise, resolve };
}

describe("NuevoClienteDialog save dismissal", () => {
  beforeEach(() => { vi.resetAllMocks(); mock.parse.mockResolvedValue({ nombre: "Synthetic" }); });
  afterEach(cleanup);

  it("keeps the real dialog open on Escape and X through creation and upload", async () => {
    const client = { id: "synthetic-client", organization_id: "synthetic-org" };
    const create = deferred<typeof client>();
    const upload = deferred<unknown>();
    mock.create.mockReturnValue(create.promise);
    mock.upload.mockReturnValue(upload.promise);
    const onOpenChange = vi.fn();
    render(<NuevoClienteDialog open onOpenChange={onOpenChange} />);
    fill();
    await act(async () => selectOriginal(document.body, new File(["Synthetic PDF"], "synthetic.pdf", { type: "application/pdf" })));
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    fireEvent.click(screen.getByRole("button", { name: "Crear cliente" }));
    for (const phase of ["create", "upload"]) {
      expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
      expect(screen.getByRole("button", { name: /Guardando/ })).toBeDisabled();
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
      expect(screen.queryByText("¿Descartar el alta del cliente?")).not.toBeInTheDocument();
      expect(onOpenChange).not.toHaveBeenCalled();
      if (phase === "create") await act(async () => { create.resolve(client); await create.promise; });
    }
    await act(async () => { upload.resolve({}); await upload.promise; });
    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mock.create).toHaveBeenCalledOnce();
    expect(mock.upload).toHaveBeenCalledOnce();
  });
  it("allows confirmed discard after an upload failure has settled", async () => {
    mock.create.mockResolvedValue({ id: "synthetic-client", organization_id: "synthetic-org" });
    mock.upload.mockRejectedValue(new Error("Synthetic upload failure"));
    const onOpenChange = vi.fn();
    render(<NuevoClienteDialog open onOpenChange={onOpenChange} />);
    fill();
    await act(async () => selectOriginal(document.body, new File(["Synthetic PDF"], "synthetic.pdf", { type: "application/pdf" })));
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Crear cliente" })));
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("button", { name: "Reintentar constancia" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByText(/El cliente ya fue creado, pero su constancia sigue pendiente/)).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Descartar" })));
    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(mock.create).toHaveBeenCalledOnce();
  });

});
