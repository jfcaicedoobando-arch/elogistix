import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FacturaSeguroElegible } from "@/features/embarques/services/seguros";
import type { FacturasSeguroContext } from "../../hooks/useFacturasSeguroElegibles";
const { mockHook, more, refetch } = vi.hoisted(() => ({ mockHook: vi.fn(), more: vi.fn(), refetch: vi.fn() }));
vi.mock("@/features/embarques/hooks/useFacturasSeguroElegibles", () => ({ useFacturasSeguroElegibles: mockHook }));
import { SeguroFacturaProveedorSelect } from "../SeguroFacturaProveedorSelect";
const facturas: FacturaSeguroElegible[] = [{ id: "factura-1", folio_interno: "FP-1", proveedor_nombre: "Aseguradora", subtotal: "100.005", moneda: "MXN" }];
const context: FacturasSeguroContext = { embarqueId: "embarque-1", prima: 100, moneda: "MXN", seguroId: "policy", tipoCambioUsd: 20, tipoCambioEur: 22, open: true };
const ready = { items: facturas, isLoading: false, isRefetching: false, isError: false, unavailable: false,
  isFetching: false, isFetchingNextPage: false, isFetchNextPageError: false, complete: true, hasNextPage: false, fetchNextPage: more, refetch };
beforeEach(() => { vi.clearAllMocks(); mockHook.mockReturnValue(ready); });

describe("SeguroFacturaProveedorSelect", () => {
  it("passes complete context and chooses only the invoice id", () => {
    const onChange = vi.fn();
    render(<SeguroFacturaProveedorSelect {...context} value={null} onChange={onChange} />);
    expect(mockHook).toHaveBeenCalledWith(context);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: /FP-1.*Aseguradora/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("factura-1");
  });
  it("keeps unlinking an explicit choice", () => {
    const onChange = vi.fn();
    render(<SeguroFacturaProveedorSelect {...context} value="factura-1" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: /Sin factura ligada/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
  });
  it.each([
    { isLoading: true }, { isRefetching: true }, { isError: true }, { unavailable: true },
  ])("retains a neutral historical label without altering the saved link while unavailable (%j)", (state) => {
    mockHook.mockReturnValue({ ...ready, ...state, items: [], complete: false });
    const onChange = vi.fn();
    render(<SeguroFacturaProveedorSelect {...context} value="old-invoice" savedValue="old-invoice" onChange={onChange} />);
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(screen.getByRole("combobox")).toHaveTextContent("Factura ligada guardada");
    expect(screen.getByText(/Su ausencia en esta lista no permite determinar su vigencia ni su cobertura/)).toBeInTheDocument();
    expect(screen.queryByText(/No hay facturas elegibles/)).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
  it("shows the same generic unavailable error, with no retry that bypasses the disabled gate", () => {
    mockHook.mockReturnValue({ ...ready, items: [], unavailable: true, complete: false });
    render(<SeguroFacturaProveedorSelect {...context} value={null} onChange={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar las facturas del embarque.");
    expect(screen.queryByRole("button", { name: /Reintentar/ })).not.toBeInTheDocument();
  });
  it("offers retry after a recoverable initial error", () => {
    mockHook.mockReturnValue({ ...ready, items: [], isError: true, complete: false });
    render(<SeguroFacturaProveedorSelect {...context} value="old" savedValue="old" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar carga" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
  it("keeps saved links outside the loaded page without inventing a cause", () => {
    const onChange = vi.fn();
    mockHook.mockReturnValue({ ...ready, hasNextPage: true, complete: false });
    render(<SeguroFacturaProveedorSelect {...context} value="old-invoice" savedValue="old-invoice" onChange={onChange} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Factura ligada guardada");
    fireEvent.click(screen.getByRole("button", { name: "Cargar más facturas" }));
    expect(more).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });
  it("does not label an unsaved selection as saved", () => {
    render(<SeguroFacturaProveedorSelect {...context} value="new-invoice" savedValue="old-invoice" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Factura seleccionada");
    expect(screen.queryByText("Se conserva el vínculo guardado.")).not.toBeInTheDocument();
  });
  it("preserves exact subtotal text and clarifies that selection is not a reservation", () => {
    render(<SeguroFacturaProveedorSelect {...context} value="factura-1" onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Subtotal de factura: 100.005 MXN");
    expect(screen.getByText(/Seleccionarla no la reserva/)).toBeInTheDocument();
  });
  it("retains rows after a later-page error and explicitly calls the list incomplete", () => {
    const onChange = vi.fn();
    mockHook.mockReturnValue({ ...ready, isError: true, isFetchNextPageError: true, complete: false, hasNextPage: true });
    render(<SeguroFacturaProveedorSelect {...context} value="factura-1" onChange={onChange} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("FP-1");
    expect(screen.getByText(/La lista está incompleta/)).toBeInTheDocument();
    expect(screen.queryByText(/No hay facturas elegibles/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar cargar más" }));
    expect(more).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });
  it("blocks repeated load-more clicks while a page is running", () => {
    mockHook.mockReturnValue({ ...ready, isFetching: true, isFetchingNextPage: true, hasNextPage: true, complete: false });
    render(<SeguroFacturaProveedorSelect {...context} value={null} onChange={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Cargando más…" });
    fireEvent.click(button); fireEvent.click(button);
    expect(button).toBeDisabled(); expect(more).not.toHaveBeenCalled();
  });
  it("distinguishes a successful empty page from an incomplete page", () => {
    mockHook.mockReturnValue({ ...ready, items: [] });
    const { rerender } = render(<SeguroFacturaProveedorSelect {...context} value={null} onChange={vi.fn()} />);
    expect(screen.getByText("No hay facturas elegibles para estos datos.")).toBeInTheDocument();
    mockHook.mockReturnValue({ ...ready, items: [], complete: false, isError: true });
    rerender(<SeguroFacturaProveedorSelect {...context} value={null} onChange={vi.fn()} />);
    expect(screen.queryByText(/No hay facturas elegibles/)).not.toBeInTheDocument();
  });
});
