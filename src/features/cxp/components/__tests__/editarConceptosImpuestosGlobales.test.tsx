import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";

const { mutateAsync, filas } = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  filas: [{ id: "c1", descripcion: "Maniobras", monto: 1000, cantidad: 1, iva: 172.8, ieps: 0 }],
}));
vi.mock("@/features/cxp/hooks/useConceptosFacturaSnapshot", () => ({
  useConceptosFacturaSnapshot: () => ({ data: { conceptos: filas, factura: {
    subtotal: 1000, iva: 172.8, ieps: 80, retenciones: 0, total: 1252.8, updated_at: "v1",
  } }, isLoading: false, isError: false }),
}));
vi.mock("@/features/cxp/hooks/useEditarConceptosFactura", () => ({
  useEditarConceptosFactura: () => ({ mutateAsync, isPending: false }),
}));
import { DialogEditarConceptosFactura } from "../DialogEditarConceptosFactura";

function abrir() {
  return render(<TooltipProvider><DialogEditarConceptosFactura open onOpenChange={vi.fn()}
    facturaId="f1" folio="FP-000004" moneda="MXN" subtotal={1000} iva={172.8} ieps={80}
    retenciones={0} total={1252.8} /></TooltipProvider>);
}
describe("edición conserva impuestos globales · AUD-F04", () => {
  beforeEach(() => mutateAsync.mockReset().mockResolvedValue(1));
  it("cambiar sólo descripción conserva el impuesto y muestra el total sin falso Cuadrado", async () => {
    abrir();
    expect(screen.getByLabelText("IEPS global sin desglose")).toHaveValue("80");
    expect(screen.queryByText("Cuadrado")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Descripción del concepto"), { target: { value: "Maniobras corregidas" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar conceptos" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      impuestosNoDesglosados: { iva: 0, ieps: 80 },
      conceptos: [expect.objectContaining({ descripcion: "Maniobras corregidas", ieps: 0, iva: 172.8 })],
    })));
    expect(screen.getAllByText(/1,252\.80/)).toHaveLength(2);
  });
  it("distribuir IEPS obliga a ver y descontar el importe global para no duplicarlo", async () => {
    abrir();
    fireEvent.change(screen.getByLabelText("IEPS del concepto"), { target: { value: "80" } });
    expect(screen.getByRole("button", { name: "Guardar y actualizar importes" })).toBeInTheDocument();
    expect(screen.getByText(/1,332\.80/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("IEPS global sin desglose"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar conceptos" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({
      impuestosNoDesglosados: { iva: 0, ieps: 0 },
      conceptos: [expect.objectContaining({ ieps: 80 })],
    })));
  });
  it("no guarda un importe global inválido", () => {
    abrir();
    fireEvent.change(screen.getByLabelText("IEPS global sin desglose"), { target: { value: "-80" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/no negativos/);
    expect(screen.getByRole("button", { name: "Guardar y actualizar importes" })).toBeDisabled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
