import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test/utils/queryWrapper";
import { fetchTcDofPorFecha } from "@/features/catalogos/services/tipoCambioDof";
import { DialogNotaCreditoProveedor } from "../DialogNotaCreditoProveedor";

const { guardar, adjuntos } = vi.hoisted(() => ({ guardar: vi.fn(), adjuntos: vi.fn() }));
vi.mock("@/features/cxp/hooks/useNotasCreditoProveedor", () => ({
  useCrearNotaCredito: () => ({ mutateAsync: guardar, isPending: false }),
}));
vi.mock("@/features/catalogos/services/tipoCambioDof", () => ({ fetchTcDofPorFecha: vi.fn() }));
vi.mock("@/hooks/shared", () => ({ useOrgFilter: () => ({ organizationId: "org-fixture" }) }));
vi.mock("@/features/cxp/services", () => ({ subirArchivosNcProveedor: adjuntos }));
vi.mock("../CargaXmlNcSection", () => ({ CargaXmlNcSection: () => null }));
vi.mock("@/components/shared/FormDialogShell", () => ({
  FormDialogShell: ({ children, footer }: { children: ReactNode; footer: ReactNode }) => <div>{children}{footer}</div>,
}));
const consultar = vi.mocked(fetchTcDofPorFecha);

beforeEach(() => {
  consultar.mockReset();
  consultar.mockResolvedValue(null);
  guardar.mockReset();
  guardar.mockResolvedValue({ id: "nc-fixture" });
});

function abrir() {
  const cerrar = vi.fn();
  render(<DialogNotaCreditoProveedor open onOpenChange={cerrar} facturaId="factura-fixture" monedaFactura="USD" saldoFactura={95} />, {
    wrapper: createWrapper(),
  });
  fireEvent.change(screen.getByLabelText("Folio NC *"), { target: { value: " NC-PRUEBA " } });
  fireEvent.change(screen.getByLabelText("Monto *"), { target: { value: "1" } });
  return cerrar;
}

async function elegirMxn() {
  fireEvent.keyDown(screen.getAllByRole("combobox")[0], { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: "MXN" }));
}

describe("Preview y payload de la NC usan el mismo TC", () => {
  it.each([
    { tc: "0.5", equivalente: "2.00" },
    { tc: "1", equivalente: "1.00" },
    { tc: "20", equivalente: "0.05" },
  ])("MXN 1 con TC $tc muestra USD $equivalente y envía el TC capturado", async ({ tc, equivalente }) => {
    const cerrar = abrir();
    await elegirMxn();
    fireEvent.change(screen.getByLabelText(/Tipo de cambio/), { target: { value: tc } });
    expect(screen.getByText(/Equivale a/)).toHaveTextContent(`TC ${tc} MXN por 1 USD (capturado)`);
    expect(screen.getByText(/Equivale a/)).toHaveTextContent(equivalente);
    expect(screen.getByRole("button", { name: "Registrar" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    await waitFor(() => expect(guardar).toHaveBeenCalledTimes(1));
    expect(guardar).toHaveBeenCalledWith(expect.objectContaining({
      proveedor_factura_id: "factura-fixture", folio_nc: "NC-PRUEBA", monto: 1, moneda: "MXN", tipo_cambio: Number(tc), estado: "Borrador",
    }));
    await waitFor(() => expect(cerrar).toHaveBeenCalledWith(false));
    expect(adjuntos).not.toHaveBeenCalled();
  });

  it("el campo vacío muestra la publicación DOF y envía exactamente la cotización mostrada", async () => {
    consultar.mockResolvedValue({ usdMxn: 18.1903, eurMxn: null, fecha: "2026-10-02", exacto: false });
    abrir();
    await elegirMxn();
    await waitFor(() => expect(screen.getByText(/Equivale a/)).toHaveTextContent("TC 18.1903 MXN por 1 USD (DOF publicado el 2026-10-02)"));
    expect(screen.getByText(/Equivale a/)).toHaveTextContent("0.06");
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ tipo_cambio: 18.1903, monto: 1, moneda: "MXN" })));
  });

  it.each(["0", "-0.5"])("TC %s impide enviar y no promete aplicar DOF", async (tc) => {
    abrir();
    await elegirMxn();
    fireEvent.change(screen.getByLabelText(/Tipo de cambio/), { target: { value: tc } });
    expect(screen.getByText(/El tipo de cambio debe ser un número positivo/)).toBeInTheDocument();
    expect(screen.queryByText(/Equivale a/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(guardar).not.toHaveBeenCalled();
  });

  it("la ausencia de DOF bloquea el registro hasta que el usuario capture una paridad válida", async () => {
    abrir();
    await elegirMxn();
    await waitFor(() => expect(screen.getByText(/No hay tipo de cambio DOF disponible/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(guardar).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Tipo de cambio/), { target: { value: "0.5" } });
    expect(screen.getByRole("button", { name: "Registrar" })).toBeEnabled();
  });

  it("en la moneda de la factura envía TC nulo y mantiene el importe", async () => {
    abrir();
    expect(screen.queryByLabelText(/Tipo de cambio/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ monto: 1, moneda: "USD", tipo_cambio: null })));
    expect(consultar).not.toHaveBeenCalled();
  });

  it("una conversión que desborda tampoco permite enviar un importe sin valuación", async () => {
    abrir();
    await elegirMxn();
    fireEvent.change(screen.getByLabelText("Monto *"), { target: { value: "1e308" } });
    fireEvent.change(screen.getByLabelText(/Tipo de cambio/), { target: { value: "0.0001" } });
    expect(screen.queryByText(/Equivale a/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(guardar).not.toHaveBeenCalled();
  });
});
