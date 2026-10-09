import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SeguroEmbarque } from "@/features/embarques/services/seguros";

const { create, update, selector } = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), selector: vi.fn() }));
vi.mock("@/features/embarques/hooks/useSegurosEmbarque", () => ({
  useCreateSeguro: () => ({ mutateAsync: create, isPending: false }),
  useUpdateSeguro: () => ({ mutateAsync: update, isPending: false }),
}));
vi.mock("@/components/shared/FormDialogShell", () => ({
  FormDialogShell: ({ children, footer, open }: { children: ReactNode; footer: ReactNode; open: boolean }) => open ? <div>{children}{footer}</div> : null,
}));
vi.mock("../SeguroFormCamposPrincipales", () => ({ SeguroFormCamposPrincipales: () => null }));
vi.mock("../SeguroFormCamposAdicionales", () => ({
  SeguroFormCamposAdicionales: ({ form, setField }: { form: { notas: string | null }; setField: (key: "notas", value: string) => void }) => (
    <input aria-label="Notas conservadas" value={form.notas ?? ""} onChange={(e) => setField("notas", e.target.value)} />
  ),
}));
vi.mock("../SeguroFacturaProveedorSelect", () => ({
  SeguroFacturaProveedorSelect: (props: { value: string | null }) => {
    selector(props);
    return <div data-testid="invoice-link">{props.value}</div>;
  },
}));
import { DialogSeguroForm } from "../DialogSeguroForm";

const policy: SeguroEmbarque = {
  id: "policy", embarque_id: "shipment", organization_id: "org", aseguradora: "Insurance",
  numero_poliza: "POL-1", certificado_url: null, cobertura_descripcion: null, suma_asegurada: 1000,
  deducible: 0, prima: 100, moneda: "MXN", vigencia_desde: "2026-01-01", vigencia_hasta: "2026-12-31",
  contacto: null, notas: "Original", proveedor_factura_id: "invoice", created_at: "", updated_at: "",
};
beforeEach(() => { create.mockReset(); update.mockReset(); selector.mockReset(); });

describe("DialogSeguroForm full coverage save boundary", () => {
  it("keeps the dialog, edited notes and existing invoice after coverage rejection", async () => {
    update.mockRejectedValue(new Error("LC_SEGURO_COBERTURA_INCOMPLETA"));
    const close = vi.fn();
    render(<DialogSeguroForm open onOpenChange={close} embarqueId="shipment" seguro={policy} />);
    fireEvent.change(screen.getByLabelText("Notas conservadas"), { target: { value: "Keep my draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Notas conservadas")).toHaveValue("Keep my draft");
    expect(screen.getByTestId("invoice-link")).toHaveTextContent("invoice");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ patch: expect.objectContaining({ prima: 100, moneda: "MXN", proveedor_factura_id: "invoice" }) }));
  });

  it("can retry after rejection and only closes after a confirmed successful write", async () => {
    update.mockRejectedValueOnce(new Error("LC_CONFLICTO_CONCURRENCIA")).mockResolvedValueOnce(undefined);
    const close = vi.fn();
    render(<DialogSeguroForm open onOpenChange={close} embarqueId="shipment" seguro={policy} />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(close).toHaveBeenCalledExactlyOnceWith(false));
    expect(update).toHaveBeenCalledTimes(2);
  });

  it("Cancel after failure dismisses without a second write", async () => {
    update.mockRejectedValue(new Error("LC_SEGURO_COBERTURA_INCOMPLETA"));
    const close = vi.fn();
    render(<DialogSeguroForm open onOpenChange={close} embarqueId="shipment" seguro={policy} />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(update).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(close).toHaveBeenCalledExactlyOnceWith(false);
    expect(update).toHaveBeenCalledOnce();
  });
});


it("passes premium, currency, current policy and frozen FX without gating notes-only edits on candidates", async () => {
  update.mockResolvedValue(undefined);
  const close = vi.fn();
  render(<DialogSeguroForm open onOpenChange={close} embarqueId="shipment" seguro={policy} tipoCambioUsd={20} tipoCambioEur={22} />);
  expect(selector).toHaveBeenLastCalledWith(expect.objectContaining({
    embarqueId: "shipment", prima: 100, moneda: "MXN", seguroId: "policy", tipoCambioUsd: 20, tipoCambioEur: 22,
    savedValue: "invoice", value: "invoice", open: true,
  }));
  fireEvent.change(screen.getByLabelText("Notas conservadas"), { target: { value: "Notes only" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(close).toHaveBeenCalledWith(false));
  expect(update).toHaveBeenCalledWith({ id: "policy", patch: expect.objectContaining({ notas: "Notes only", proveedor_factura_id: "invoice", prima: 100 }) });
});

it("Cancel/reopen resets the rejected draft to saved values without dropping the historical link", async () => {
  update.mockRejectedValue(new Error("LC_SEGURO_COBERTURA_INCOMPLETA"));
  const close = vi.fn();
  const { rerender } = render(<DialogSeguroForm open onOpenChange={close} embarqueId="shipment" seguro={policy} />);
  fireEvent.change(screen.getByLabelText("Notas conservadas"), { target: { value: "Uncommitted" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() => expect(update).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  rerender(<DialogSeguroForm open={false} onOpenChange={close} embarqueId="shipment" seguro={policy} />);
  expect(screen.queryByLabelText("Notas conservadas")).not.toBeInTheDocument();
  rerender(<DialogSeguroForm open onOpenChange={close} embarqueId="shipment" seguro={policy} />);
  expect(screen.getByLabelText("Notas conservadas")).toHaveValue("Original");
  expect(screen.getByTestId("invoice-link")).toHaveTextContent("invoice");
  expect(update).toHaveBeenCalledOnce();
});
