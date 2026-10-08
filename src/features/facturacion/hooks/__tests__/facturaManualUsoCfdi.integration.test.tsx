/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({ crear: vi.fn(), emitir: vi.fn(), fiscal: vi.fn(), limite: vi.fn(), success: vi.fn(), error: vi.fn(),
  clientes: [{ id: "c1", nombre: "Fixture", rfc: "XAXX010101000" as string | null, codigo_postal: "64000" as string | null,
    regimen_fiscal: "616" as string | null, uso_cfdi_default: null as string | null, dias_credito: 0 }],
}));
vi.mock("@/hooks/shared/useOrgActiva", () => ({ useOrgActiva: () => ({ organizationId: "org1" }) }));
vi.mock("@/features/catalogos/hooks/useTasaIVA", () => ({ useTasaIVA: () => 0.16 }));
vi.mock("@/features/facturacion/hooks/useClientesFiscalOpts", () => ({ useClientesFiscalOpts: () => ({ data: mocks.clientes }) }));
vi.mock("@/features/cliente/hooks/useValidarLimiteCredito", () => ({ useValidarLimiteCredito: () => mocks.limite, registrarExcesoCredito: vi.fn() }));
vi.mock("@/features/facturacion/services/facturaManual", () => ({ crearFacturaManual: mocks.crear }));
vi.mock("@/features/facturacion/services/facturapi", () => ({ emitirFacturapi: mocks.emitir }));
vi.mock("@/features/facturacion/services/datosFiscalesCliente", () => ({ fetchClienteFiscal: mocks.fiscal }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: mocks.success, notifyError: mocks.error, notifyInfo: vi.fn() }));
import { useFacturaManualForm } from "../useFacturaManualForm";

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const onClose = vi.fn();
  const hook = renderHook(() => useFacturaManualForm(true, onClose), {
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
  act(() => {
    hook.result.current.onClienteChange("c1");
    hook.result.current.setConceptos([{ descripcion: "Servicio", cantidad: 1, precio_unitario: 100, clave_sat: "78101800", tipo_iva: "gravado_16" }]);
  });
  return { ...hook, onClose, client };
}
const exito = { uuid: "12345678-uuid", folio: 1, serie: "A", facturapi_id: "remote", pdf_url: "pdf", xml_url: "xml",
  uso_cfdi_solicitado: "S01", uso_cfdi_efectivo: "S01", fuente_uso_cfdi: "xml" };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.clientes = [{ id: "c1", nombre: "Fixture", rfc: "XAXX010101000", codigo_postal: "64000", regimen_fiscal: "616", uso_cfdi_default: null, dias_credito: 0 }];
  mocks.fiscal.mockImplementation(async () => mocks.clientes[0]);
  mocks.limite.mockResolvedValue(null);
  mocks.crear.mockResolvedValue("f1");
  mocks.emitir.mockResolvedValue(exito);
});

describe("Nueva factura manual → formulario → submit → mutación real", () => {
  it("616/G03 se bloquea antes de crédito, INSERT y PAC; sólo borrador sigue permitido", async () => {
    const { result, client } = setup();
    expect(result.current.fiscal.usoCfdi).toBe("G03");
    expect(result.current.puedeTimbrar).toBe(false);
    expect(result.current.puedeGuardar).toBe(true);
    expect(result.current.faltantesTimbrar.join(" ")).toContain("no es compatible con el régimen fiscal 616");
    await act(() => result.current.handleSubmit(true));
    expect(mocks.limite).not.toHaveBeenCalled();
    expect(mocks.crear).not.toHaveBeenCalled();
    expect(mocks.emitir).not.toHaveBeenCalled();
    await act(() => result.current.handleSubmit(false));
    await waitFor(() => expect(mocks.crear).toHaveBeenCalledOnce());
    expect(mocks.fiscal).not.toHaveBeenCalled();
    expect(mocks.emitir).not.toHaveBeenCalled();
    client.clear();
  });
  it("S01/616 se elige explícitamente, valida antes del INSERT y emite una sola vez", async () => {
    const { result, onClose, client } = setup();
    act(() => result.current.updateFiscal({ usoCfdi: "S01" }));
    expect(result.current.puedeTimbrar).toBe(true);
    await act(() => result.current.handleSubmit(true));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(mocks.fiscal).toHaveBeenCalledWith("c1");
    expect(mocks.fiscal.mock.invocationCallOrder[0]).toBeLessThan(mocks.crear.mock.invocationCallOrder[0]);
    expect(mocks.crear).toHaveBeenCalledWith(expect.objectContaining({ usoCfdi: "S01", rfcCliente: "XAXX010101000" }));
    expect(mocks.emitir).toHaveBeenCalledExactlyOnceWith("f1");
    expect(mocks.error).not.toHaveBeenCalled();
    client.clear();
  });
  it("catálogo UI obsoleto: un cambio de régimen se rechaza al releer antes de crear", async () => {
    mocks.clientes[0] = { ...mocks.clientes[0], rfc: "AAAA010101AAA", regimen_fiscal: "612" };
    mocks.fiscal.mockResolvedValue({ ...mocks.clientes[0], regimen_fiscal: "616" });
    const { result, client } = setup();
    expect(result.current.puedeTimbrar).toBe(true);
    await act(() => result.current.handleSubmit(true));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.crear).not.toHaveBeenCalled();
    expect(mocks.emitir).not.toHaveBeenCalled();
    client.clear();
  });
  it("la validación usa RFC de la captura, aunque la consulta devuelva otro RFC", async () => {
    mocks.clientes[0].uso_cfdi_default = "S01";
    mocks.fiscal.mockResolvedValue({ ...mocks.clientes[0], rfc: "AAA010101AAA", regimen_fiscal: "601" });
    const { result, client } = setup();
    await act(() => result.current.handleSubmit(true));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.error.mock.calls[0][1].description).toContain("requiere régimen fiscal 616");
    expect(mocks.crear).not.toHaveBeenCalled();
    expect(mocks.emitir).not.toHaveBeenCalled();
    client.clear();
  });
  it("XML distinto conserva éxito e informa ambos usos en la ruta manual sin reemitir", async () => {
    mocks.clientes[0] = { ...mocks.clientes[0], rfc: "AAA010101AAA", regimen_fiscal: "601" };
    mocks.emitir.mockResolvedValue({ ...exito, uso_cfdi_solicitado: "G03" });
    const { result, onClose, client } = setup();
    await act(() => result.current.handleSubmit(true));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(mocks.success).toHaveBeenCalledWith(undefined, expect.objectContaining({
      title: expect.stringContaining("Factura manual timbrada"),
      description: expect.stringContaining("solicitado: G03; efectivo en el XML: S01"),
    }));
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.crear).toHaveBeenCalledOnce();
    expect(mocks.emitir).toHaveBeenCalledOnce();
    client.clear();
  });
  it("borrador admite datos fiscales incompletos y nunca consulta ni llama al PAC", async () => {
    mocks.clientes[0] = { ...mocks.clientes[0], rfc: null, regimen_fiscal: null, codigo_postal: null };
    const { result, onClose, client } = setup();
    expect(result.current.puedeGuardar).toBe(true);
    expect(result.current.puedeTimbrar).toBe(false);
    await act(() => result.current.handleSubmit(false));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mocks.crear).toHaveBeenCalledOnce();
    expect(mocks.fiscal).not.toHaveBeenCalled();
    expect(mocks.emitir).not.toHaveBeenCalled();
    client.clear();
  });
});
