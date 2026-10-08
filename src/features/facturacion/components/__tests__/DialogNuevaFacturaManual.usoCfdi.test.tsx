/** @vitest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DialogNuevaFacturaManual } from "../DialogNuevaFacturaManual";

const mocks = vi.hoisted(() => ({ crear: vi.fn(), emitir: vi.fn(), fiscal: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/hooks/shared/useOrgActiva", () => ({ useOrgActiva: () => ({ organizationId: "org1" }) }));
vi.mock("@/features/catalogos/hooks/useTasaIVA", () => ({ useTasaIVA: () => 0.16 }));
vi.mock("@/features/facturacion/hooks/useClientesFiscalOpts", () => ({ useClientesFiscalOpts: () => ({ data: [
  { id: "c1", nombre: "Cliente genérico", rfc: "XAXX010101000", regimen_fiscal: "616", codigo_postal: "64000", dias_credito: 0 },
] }) }));
vi.mock("@/features/cliente/hooks/useValidarLimiteCredito", () => ({ useValidarLimiteCredito: () => async () => null, registrarExcesoCredito: vi.fn() }));
vi.mock("@/features/facturacion/hooks/useBanxicoTipoCambio", () => ({ useBanxicoTipoCambio: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock("@/features/configuracion", () => ({ useIvaFronteraHabilitada: () => false }));
vi.mock("../CreditoExcesoConfirmDialog", () => ({ CreditoExcesoConfirmDialog: () => null }));
vi.mock("@/features/facturacion/services/facturaManual", () => ({ crearFacturaManual: mocks.crear }));
vi.mock("@/features/facturacion/services/facturapi", () => ({ emitirFacturapi: mocks.emitir }));
vi.mock("@/features/facturacion/services/datosFiscalesCliente", () => ({ fetchClienteFiscal: mocks.fiscal }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: mocks.success, notifyError: mocks.error, notifyInfo: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.crear.mockResolvedValue("f1");
  mocks.fiscal.mockResolvedValue({ rfc: "XAXX010101000", regimen_fiscal: "616", codigo_postal: "64000" });
  mocks.emitir.mockResolvedValue({ uuid: "uuid", folio: 1, serie: "A", facturapi_id: "remote", pdf_url: "pdf", xml_url: "xml" });
});

describe("Nueva factura manual: receptor y acciones visibles", () => {
  it("muestra G03/616 inválido, permite borrador y sólo habilita timbrado tras elegir S01", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const onOpenChange = vi.fn();
    render(<QueryClientProvider client={client}><DialogNuevaFacturaManual open onOpenChange={onOpenChange} /></QueryClientProvider>);
    fireEvent.keyDown(screen.getAllByRole("combobox")[0], { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: /Cliente genérico/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Descripción del concepto 1" }), { target: { value: "Servicio" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Precio unitario del concepto 1" }), { target: { value: "100" } });
    fireEvent.blur(screen.getByRole("textbox", { name: "Precio unitario del concepto 1" }));
    expect(screen.getByRole("combobox", { name: "Uso CFDI" })).toHaveTextContent("G03");
    expect(screen.getByText(/El uso G03 no es compatible con el régimen fiscal 616/, { selector: '[role="alert"]' })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear y timbrar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeEnabled();
    expect(mocks.crear).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Uso CFDI" }), { key: "ArrowDown" });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.click(screen.getByRole("option", { name: /S01/ }));
    expect(screen.getByRole("button", { name: "Crear y timbrar" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Crear y timbrar" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(mocks.crear).toHaveBeenCalledWith(expect.objectContaining({ usoCfdi: "S01", rfcCliente: "XAXX010101000" }));
    expect(mocks.emitir).toHaveBeenCalledExactlyOnceWith("f1");
    expect(mocks.error).not.toHaveBeenCalled();
    client.clear();
  });
});
