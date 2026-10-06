import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "@/components/shared/DataTable";
import { useGarantiasColumns, type GarantiaRow } from "../useGarantiasColumns";
import { useGarantiasContenedor } from "../useGarantiasContenedor";
import type { UpdateGarantiaInput } from "../../services/garantias";

const api = vi.hoisted(() => ({ fetch: vi.fn(), update: vi.fn(), catalog: vi.fn() }));
vi.mock("../../services/garantias", () => ({
  fetchGarantiasEmbarque: api.fetch,
  updateGarantia: api.update,
  refrescarGarantiasDesdeTarifa: vi.fn(),
}));
vi.mock("@/features/catalogos/hooks", () => ({ useTiposContenedor: api.catalog }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn(), notifyInfo: vi.fn() }));

const initialRow: GarantiaRow = {
  id: "guarantee-1", embarque_id: "shipment-1", embarque_contenedor_id: "container-1",
  naviera_id: null, monto_deposito_usd: 0, tiene_carta_garantia: false, estado: "pendiente",
  fecha_deposito: null, fecha_liberacion: null, fecha_limite_devolucion: null,
  referencia_deposito: null, notas: null, numero_contenedor: "TEST000001", tipo_contenedor: "40HC",
};
let stored: GarantiaRow[];

function GarantiasTable({ canEdit = true, fechaLlegadaReal }: { canEdit?: boolean; fechaLlegadaReal?: string }) {
  const { data = [] } = useGarantiasContenedor("shipment-1");
  const { columns } = useGarantiasColumns({ embarqueId: "shipment-1", canEdit, fechaLlegadaReal });
  const rows = data.map(row => ({ ...row, numero_contenedor: "TEST000001", tipo_contenedor: "40HC" }));
  return <DataTable columns={columns} data={rows} rowKey={row => row.id} />;
}

function mount(canEdit = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(<QueryClientProvider client={client}><GarantiasTable canEdit={canEdit} /></QueryClientProvider>);
  return { ...view, refresh: () => view.rerender(
    <QueryClientProvider client={client}><GarantiasTable canEdit={canEdit} fechaLlegadaReal="2026-10-06" /></QueryClientProvider>,
  ) };
}

beforeEach(() => {
  stored = [{ ...initialRow }];
  api.catalog.mockReturnValue({ data: undefined });
  api.fetch.mockImplementation(async () => stored.map(row => ({ ...row })));
  api.update.mockImplementation(async (input: UpdateGarantiaInput) => {
    stored = stored.map(row => row.id === input.id ? { ...row, ...input } : row);
  });
});

describe("guarantee inputs through the real DataTable and mutation hook", () => {
  it("keeps the amount input mounted and focused while replacing zero, then saves on blur and reloads", async () => {
    const view = mount();
    const input = await screen.findByRole("spinbutton", { name: "Monto de depósito en USD" });
    act(() => input.focus());
    expect(screen.getByRole("spinbutton")).toBe(input);
    expect(input).toHaveFocus();
    for (const value of ["", "1", "12", "12.34"]) {
      fireEvent.change(input, { target: { value } });
      expect(screen.getByRole("spinbutton")).toBe(input);
      expect(input).toHaveFocus();
    }
    expect(api.update).not.toHaveBeenCalled();
    act(() => screen.getByRole("textbox").focus());
    await waitFor(() => expect(api.update).toHaveBeenCalledExactlyOnceWith({ id: "guarantee-1", monto_deposito_usd: 12.34 }));
    await waitFor(() => expect(screen.getByRole("spinbutton")).toHaveValue(12.34));
    view.unmount();
    mount();
    expect(await screen.findByRole("spinbutton")).toHaveValue(12.34);
    expect(stored[0].estado).toBe("pendiente");
  });

  it("keeps the reference input focused across characters and saves its latest trimmed value on Enter", async () => {
    mount();
    const input = await screen.findByRole("textbox", { name: "Referencia o folio del depósito" });
    act(() => input.focus());
    for (const value of ["B", "BA", " BANK-123 "]) {
      fireEvent.change(input, { target: { value } });
      expect(screen.getByRole("textbox")).toBe(input);
      expect(input).toHaveFocus();
    }
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(api.update).toHaveBeenCalledExactlyOnceWith({ id: "guarantee-1", referencia_deposito: "BANK-123" }));
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("BANK-123"));
  });

  it.each(["0", ""])("preserves the explicit-zero payload when the edited amount is %j", async (value) => {
    stored[0].monto_deposito_usd = 8;
    mount();
    const input = await screen.findByRole("spinbutton");
    act(() => input.focus());
    fireEvent.change(input, { target: { value } });
    expect(input).toHaveFocus();
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(api.update).toHaveBeenCalledExactlyOnceWith({ id: "guarantee-1", monto_deposito_usd: 0 }));
    await waitFor(() => expect(screen.getByRole("spinbutton")).toHaveValue(0));
  });

  it("does not submit untouched fields or negative amounts", async () => {
    stored[0].monto_deposito_usd = 8;
    mount();
    const input = await screen.findByRole("spinbutton");
    act(() => { input.focus(); input.blur(); });
    const reference = screen.getByRole("textbox");
    act(() => { reference.focus(); reference.blur(); });
    expect(api.update).not.toHaveBeenCalled();
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "-1" } });
    act(() => input.blur());
    expect(api.update).not.toHaveBeenCalled();
    expect(input).toHaveValue(-1);
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(api.update).toHaveBeenCalledExactlyOnceWith({ id: "guarantee-1", monto_deposito_usd: 2 }));
  });

  it("preserves the null payload for a cleared reference", async () => {
    stored[0].referencia_deposito = "BANK-OLD";
    mount();
    const input = await screen.findByRole("textbox");
    act(() => input.focus());
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(api.update).toHaveBeenCalledExactlyOnceWith({ id: "guarantee-1", referencia_deposito: null }));
  });

  it("preserves the next field's focus and draft while the previous save settles and refetches", async () => {
    let completeSave: () => void = () => {};
    const pendingSave = new Promise<void>(resolve => { completeSave = resolve; });
    api.update.mockImplementationOnce(async (input: UpdateGarantiaInput) => {
      await pendingSave;
      stored[0] = { ...stored[0], ...input };
    });
    mount();
    const amount = await screen.findByRole("spinbutton");
    act(() => amount.focus());
    fireEvent.change(amount, { target: { value: "1" } });
    const reference = screen.getByRole("textbox");
    act(() => reference.focus());
    fireEvent.change(reference, { target: { value: "BANK-" } });
    await act(async () => completeSave());
    await waitFor(() => expect(screen.getByRole("spinbutton")).toHaveValue(1));
    expect(screen.getByRole("textbox")).toBe(reference);
    expect(reference).toHaveFocus();
    expect(reference).toHaveValue("BANK-");
    fireEvent.change(reference, { target: { value: "BANK-123" } });
    fireEvent.keyDown(reference, { key: "Enter" });
    await waitFor(() => expect(api.update).toHaveBeenLastCalledWith({ id: "guarantee-1", referencia_deposito: "BANK-123" }));
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue("BANK-123"));
    expect(api.update).toHaveBeenCalledTimes(2);
  });

  it("keeps edits isolated by guarantee ID across rows", async () => {
    stored.push({ ...initialRow, id: "guarantee-2" });
    mount();
    const inputs = await screen.findAllByRole("spinbutton");
    act(() => inputs[1].focus());
    fireEvent.change(inputs[1], { target: { value: "27.50" } });
    fireEvent.keyDown(inputs[1], { key: "Enter" });
    await waitFor(() => expect(api.update).toHaveBeenCalledExactlyOnceWith({ id: "guarantee-2", monto_deposito_usd: 27.5 }));
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[1]).toHaveValue(27.5));
    expect(screen.getAllByRole("spinbutton")[0]).toHaveValue(0);
  });

  it("keeps drafts and focus when catalog and arrival-date data changes", async () => {
    const view = mount();
    const amount = await screen.findByRole("spinbutton");
    act(() => amount.focus());
    fireEvent.change(amount, { target: { value: "-2" } });
    const reference = screen.getByRole("textbox");
    act(() => reference.focus());
    fireEvent.change(reference, { target: { value: "BANK-IN-PROGRESS" } });
    api.catalog.mockReturnValue({ data: [{ id: "40HC", nombre: "40 High Cube" }] });
    view.refresh();
    expect(screen.getByRole("spinbutton")).toBe(amount);
    expect(amount).toHaveValue(-2);
    expect(screen.getByRole("textbox")).toBe(reference);
    expect(reference).toHaveFocus();
    expect(reference).toHaveValue("BANK-IN-PROGRESS");
    fireEvent.keyDown(reference, { key: "Enter" });
    await waitFor(() => expect(api.update).toHaveBeenCalledExactlyOnceWith({ id: "guarantee-1", referencia_deposito: "BANK-IN-PROGRESS" }));
  });

  it.each(["read-only", "guarantee-letter"])("does not expose editable fields for %s rows", async (mode) => {
    stored[0].tiene_carta_garantia = mode === "guarantee-letter";
    mount(mode !== "read-only");
    await screen.findByText("TEST000001");
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(api.update).not.toHaveBeenCalled();
  });

});
