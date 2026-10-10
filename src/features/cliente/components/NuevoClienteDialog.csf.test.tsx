import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NuevoClienteDialog from "./NuevoClienteDialog";
import { CsfDropZone } from "./NuevoClienteFormPieces";

const mock = vi.hoisted(() => ({ parse: vi.fn(), create: vi.fn(), upload: vi.fn() }));
vi.mock("@/features/cliente/hooks", async () => {
  const { useNuevoClienteController } = await import("../hooks/useNuevoClienteController");
  return { useNuevoClienteController };
});
vi.mock("@/features/cliente/hooks/useClientes", () => ({ useCreateCliente: () => ({ mutateAsync: mock.create, isPending: false }) }));
vi.mock("@/features/cliente/services/csf", () => ({ parseCsf: mock.parse }));
vi.mock("@/features/cliente/services/clienteDocumentos", () => ({ subirDocumentoCliente: mock.upload }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
vi.mock("@/components/shared/FormDialogShell", () => ({
  FormDialogShell: ({ children, footer, description }: { children: ReactNode; footer: ReactNode; description: string }) =>
    <div><p>{description}</p>{children}{footer}</div>,
}));
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

describe("NuevoClienteDialog CSF presentation", () => {
  beforeEach(() => { vi.resetAllMocks(); mock.parse.mockResolvedValue({ nombre: "Synthetic" }); });
  afterEach(cleanup);

  it("shows the original file and reuse confirmation in step 2 after a single selection", async () => {
    const { container } = render(<NuevoClienteDialog open onOpenChange={vi.fn()} />);
    fill();
    const file = new File(["%PDF-1.4 synthetic"], "synthetic-csf.pdf", { type: "application/pdf" });
    await act(async () => selectOriginal(container, file));
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(screen.getByText(file.name)).toBeInTheDocument();
    expect(screen.getByText(/Tu CSF ya está adjunta/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cambiar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adjuntar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear cliente" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Atrás/ }));
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(screen.getByText(file.name)).toBeInTheDocument();
    expect(mock.parse).toHaveBeenCalledOnce();
  });

  it("does not request another upload when extraction failed", async () => {
    mock.parse.mockRejectedValue(new Error("Synthetic extraction failure"));
    const { container } = render(<NuevoClienteDialog open onOpenChange={vi.fn()} />);
    fill();
    await act(async () => selectOriginal(container, new File(["%PDF synthetic"], "retained.pdf", { type: "application/pdf" })));
    expect(screen.queryByText("Prellenado desde CSF")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(screen.getByText("retained.pdf")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear cliente" })).toBeEnabled();
  });

  it("manual entry still requests the required PDF and disables save", () => {
    render(<NuevoClienteDialog open onOpenChange={vi.fn()} />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(screen.getByRole("button", { name: "Adjuntar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear cliente" })).toBeDisabled();
  });

  it("drop zone clears its input so the same file can be selected again", () => {
    const onFile = vi.fn();
    const { container } = render(<CsfDropZone parsingCsf={false} onFile={onFile} />);
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["%PDF synthetic"], "repeat.pdf", { type: "application/pdf" });
    // jsdom cannot open a native picker; the writable sentinel verifies the reset.
    Object.defineProperty(input, "value", { writable: true, value: "selected" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledTimes(2);
    expect(onFile).toHaveBeenLastCalledWith(file);
  });
});
