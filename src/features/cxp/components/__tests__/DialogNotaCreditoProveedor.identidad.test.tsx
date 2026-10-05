import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test/utils/queryWrapper";
import { DialogNotaCreditoProveedor } from "../DialogNotaCreditoProveedor";
import type { CfdiParsedResponse } from "../../services/parseCfdi.types";
const mocks = vi.hoisted(() => ({ guardar: vi.fn(), adjuntos: vi.fn(), parse: vi.fn(), error: vi.fn() }));
vi.mock("@/features/cxp/hooks/useNotasCreditoProveedor", () => ({ useCrearNotaCredito: () => ({ mutateAsync: mocks.guardar, isPending: false }) }));
vi.mock("@/features/catalogos/services/tipoCambioDof", () => ({ fetchTcDofPorFecha: vi.fn() }));
vi.mock("@/hooks/shared", () => ({ useOrgFilter: () => ({ organizationId: "org" }) }));
vi.mock("@/hooks/shared/useOrgActiva", () => ({ useOrgActiva: () => ({ organizationId: "org" }) }));
vi.mock("@/features/cxp/services", () => ({ subirArchivosNcProveedor: mocks.adjuntos, parseCfdiXml: mocks.parse }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: mocks.error, notifySuccess: vi.fn() }));
vi.mock("@/components/shared/FormDialogShell", () => ({ FormDialogShell: ({ children, footer }: { children: ReactNode; footer: ReactNode }) => <div>{children}{footer}</div> }));
const data: CfdiParsedResponse = { cfdi: { uuid: "22222222-2222-4222-8222-222222222222", serie: "NC", folio: "1", fecha: "2026-10-04", moneda: "MXN", tipo_cambio: 1,
  subtotal: 50, total: 58, iva_trasladado: 8, ieps_trasladado: 0, retenciones: 0, tipo_comprobante: "E", emisor: { rfc: "AAA010101AAA", nombre: "Proveedor", regimen: "601" }, receptor: { rfc: "BBB010101BBB", nombre: "Organización" }, conceptos: [] },
  ai: { categoria_id: null, notas: "Bonificación" }, nc_validacion: { factura_id: "factura-fixture" } };
const xml = new File(["<cfdi/>"], "nota.xml", { type: "application/xml" });
beforeEach(() => {
  vi.clearAllMocks(); mocks.parse.mockResolvedValue(data); mocks.guardar.mockResolvedValue({ id: "nc" });
});
function abrir() {
  const view = render(<DialogNotaCreditoProveedor open onOpenChange={vi.fn()} facturaId="factura-fixture" monedaFactura="MXN" saldoFactura={100} />, { wrapper: createWrapper() });
  fireEvent.click(screen.getByText("Cargar XML CFDI"));
  const input = view.container.querySelector<HTMLInputElement>('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [xml] } });
  return { ...view, input };
}
async function procesar() {
  fireEvent.click(screen.getByRole("button", { name: "Procesar XML" }));
  await waitFor(() => expect(mocks.parse).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.getByRole("button", { name: "Procesar XML" })).toBeEnabled());
}
describe("95–96 · XML de NC y validación de identidad", () => {
  it("Quitar XML funciona, borra validación/adjuntos y exige procesarlo de nuevo", async () => {
    const { input } = abrir(); await procesar();
    expect(mocks.parse).toHaveBeenCalledWith(xml, [], "org", "factura-fixture");
    expect(screen.getByRole("button", { name: "Registrar" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Quitar XML" }));
    expect(screen.queryByText("nota.xml")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Procesar XML" })).toBeDisabled();
    expect(screen.queryByText(/campos fueron prellenados/)).not.toBeInTheDocument();
    fireEvent.change(input, { target: { files: [xml] } });
    expect(screen.getByRole("button", { name: "Procesar XML" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
    expect(mocks.guardar).not.toHaveBeenCalled(); expect(mocks.adjuntos).not.toHaveBeenCalled();
  });
  it.each([undefined, { factura_id: "otra-factura" }])("una respuesta sin validación coincidente no precarga ni permite registrar: %s", async (nc_validacion) => {
    mocks.parse.mockResolvedValue({ ...data, nc_validacion });
    abrir(); await procesar();
    expect(screen.getByLabelText("Folio NC *")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
    expect(mocks.error).toHaveBeenCalled(); expect(mocks.guardar).not.toHaveBeenCalled();
  });
  it("rechazo de identidad del servidor no registra y el flujo manual sigue disponible", async () => {
    mocks.parse.mockRejectedValue(new Error("El RFC emisor no corresponde al proveedor"));
    abrir(); await procesar();
    expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
    fireEvent.click(screen.getByText("Captura manual"));
    fireEvent.change(screen.getByLabelText("Folio NC *"), { target: { value: "MANUAL" } });
    fireEvent.change(screen.getByLabelText("Monto *"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(expect.objectContaining({ uuid_fiscal: null, monto: 10 })));
    expect(mocks.adjuntos).not.toHaveBeenCalled();
  });
});
