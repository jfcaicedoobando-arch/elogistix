/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FacturaConceptosEditor } from "../FacturaConceptosEditor";
import type { ConceptoFacturaRow } from "../../../services/conceptosFacturaCrud";
import { queryKeys } from "@/lib/query";
import { conceptosFacturaKey } from "../../../hooks/useConceptosFactura";

const { update, add, remove } = vi.hoisted(() => ({ update: vi.fn(), add: vi.fn(), remove: vi.fn() }));
vi.mock("@/features/facturacion/services/conceptosFacturaCrud", () => ({
  actualizarConceptoFactura: update, agregarConceptoFactura: add, eliminarConceptoFactura: remove,
}));
vi.mock("@/features/configuracion", () => ({ useIvaFronteraHabilitada: () => false }));
vi.mock("@/hooks/shared/useDirtyGuard", () => ({ useDirtyGuard: () => ({ guardDialog: null }) }));
const row: ConceptoFacturaRow = {
  id: "concepto1", factura_id: "f1", descripcion: "Gestión documental", cantidad: 1,
  precio_unitario: 1, total: 1, moneda: "MXN", clave_sat: "78101800", tipo_iva: "tasa_0",
  tasa_iva_aplicada: 0, tasa_ret_isr: 0, tasa_ret_iva: 0, monto_ret_isr: 0, monto_ret_iva: 0,
  embarque_id: null, embarque_expediente: null, proforma_id_origen: null,
};
const keys = [queryKeys.facturas.detail("f1"), queryKeys.facturas.saldoServidor("f1"), queryKeys.facturas.historial("f1"), conceptosFacturaKey("f1")];
function setup() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  keys.forEach((key) => qc.setQueryData(key, { value: "before" }));
  render(<QueryClientProvider client={qc}><FacturaConceptosEditor facturaId="f1" organizationId="org1" moneda="MXN"
    conceptos={[row, { ...row, id: "concepto2", descripcion: "Segunda partida" }]} /></QueryClientProvider>);
  return qc;
}
beforeEach(() => { vi.clearAllMocks(); update.mockResolvedValue(undefined); add.mockResolvedValue(undefined); remove.mockResolvedValue(undefined); });
describe("AUD112/117: editor independiente y consultas coherentes", () => {
  it("impide abrir alta u otra edición sin descartar la partida actual", () => {
    setup();
    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Edición conservada" } });
    expect(screen.getByRole("button", { name: /Agregar/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Agregar/ }));
    expect(screen.getByLabelText("Descripción")).toHaveValue("Edición conservada");
    expect(screen.getByLabelText("Precio unitario")).toHaveValue("1");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: /Agregar/ }));
    expect(screen.getByLabelText("Descripción")).toHaveValue("");
    expect(screen.getAllByRole("button", { name: "Editar" }).every((button) => button.hasAttribute("disabled"))).toBe(true);
  });

  it("guardar actualiza conceptos, total, saldo canónico e historial en el mismo ciclo", async () => {
    const qc = setup();
    fireEvent.click(screen.getAllByRole("button", { name: "Editar" })[0]);
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Actualizado" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    await waitFor(() => keys.forEach((key) => expect(qc.getQueryState(key)?.isInvalidated).toBe(true)));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ conceptoId: "concepto1", input: expect.objectContaining({ descripcion: "Actualizado", tipo_iva: "tasa_0", precio_unitario: 1 }) }));
    qc.clear();
  });
});
