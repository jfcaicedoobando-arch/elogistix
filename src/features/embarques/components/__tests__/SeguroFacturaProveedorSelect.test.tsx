import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FacturaSeguroElegible } from "@/features/embarques/services/seguros";

const { mockHook } = vi.hoisted(() => ({ mockHook: vi.fn() }));

vi.mock("@/features/embarques/hooks/useFacturasSeguroElegibles", () => ({
  useFacturasSeguroElegibles: mockHook,
}));

import { SeguroFacturaProveedorSelect } from "../SeguroFacturaProveedorSelect";

const facturas: FacturaSeguroElegible[] = [{
  id: "factura-1", folio_interno: "FP-1", proveedor_nombre: "Aseguradora",
  subtotal: 100, moneda: "MXN",
}];

beforeEach(() => {
  mockHook.mockReset().mockReturnValue({ data: facturas, isLoading: false, isError: false });
});

describe("SeguroFacturaProveedorSelect", () => {
  it("delega el embarque al hook y conserva el id al elegir una factura", () => {
    const onChange = vi.fn();
    render(<SeguroFacturaProveedorSelect embarqueId="embarque-1" value={null} onChange={onChange} />);
    expect(mockHook).toHaveBeenCalledWith("embarque-1");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: /FP-1.*Aseguradora/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("factura-1");
  });

  it("conserva null al quitar el vínculo opcional", () => {
    const onChange = vi.fn();
    render(<SeguroFacturaProveedorSelect embarqueId="embarque-1" value="factura-1" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: /Sin factura ligada/ }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("deshabilita el selector mientras carga sin modificar el valor", () => {
    mockHook.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const onChange = vi.fn();
    render(<SeguroFacturaProveedorSelect embarqueId="embarque-1" value="factura-1" onChange={onChange} />);
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("muestra el error y deshabilita el selector sin borrar un vínculo existente", () => {
    mockHook.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    const onChange = vi.fn();
    render(<SeguroFacturaProveedorSelect embarqueId="embarque-1" value="factura-1" onChange={onChange} />);
    expect(screen.getByText("No se pudieron cargar las facturas del embarque.")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
