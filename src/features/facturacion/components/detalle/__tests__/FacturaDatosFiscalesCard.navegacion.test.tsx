/** @vitest-environment jsdom */
import { useEffect } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
import { queryKeys } from "@/lib/query";

const mocks = vi.hoisted(() => ({ actualizar: vi.fn(), fiscal: vi.fn(), fetchFactura: vi.fn(), error: vi.fn(), guardarDefaults: vi.fn(), timbrar: vi.fn(), stored: {} as Record<string, Record<string, unknown>> }));
vi.mock("@/features/facturacion/services", () => ({ actualizarDatosTimbradoFactura: mocks.actualizar, fetchClienteFiscal: mocks.fiscal, guardarDefaultsTimbradoCliente: mocks.guardarDefaults }));
vi.mock("@/features/facturacion/services/detail", () => ({ fetchFacturaById: mocks.fetchFactura }));
vi.mock("@/features/facturacion/services/datosFiscalesCliente", () => ({ realinearFechaEmisionBorrador: vi.fn() }));
vi.mock("@/features/facturacion/services/enviarCfdiEmail", () => ({ enviarCfdiFactura: vi.fn() }));
vi.mock("@/features/facturacion/hooks/useBanxicoTipoCambio", () => ({ useBanxicoTipoCambio: () => ({ isPending: false, mutate: vi.fn() }) }));
vi.mock("@/features/facturacion/hooks/useTimbrarFactura", () => ({ useTimbrarFactura: () => ({ isPending: false, mutate: mocks.timbrar }) }));
vi.mock("@/hooks/shared", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: mocks.error }));
vi.mock("@/features/facturacion/hooks", () => ({ usePagosFactura: () => ({ data: [] }) }));
vi.mock("@/features/facturacion/hooks/useNotasCreditoDeFactura", () => ({ useNotasCreditoDeFactura: () => ({ data: [] }) }));
vi.mock("../FacturaConceptosEditor", () => ({ FacturaConceptosEditor: () => null }));
vi.mock("../FacturaConceptosTable", () => ({ FacturaConceptosTable: () => null }));
vi.mock("../FacturaResumenCard", () => ({ FacturaResumenCard: () => null }));
vi.mock("../FacturaReceptorCard", () => ({ FacturaReceptorCard: () => null }));
vi.mock("../FacturaTimbradoCard", () => ({ FacturaTimbradoCard: () => null }));
vi.mock("../FacturaPagosSection", () => ({ FacturaPagosSection: () => null }));
vi.mock("../FacturaNotasCreditoSeccion", () => ({ FacturaNotasCreditoSeccion: () => null }));
vi.mock("../FacturaDocumentosSection", () => ({ FacturaDocumentosSection: () => null }));
import { FacturaDetalleBody } from "../FacturaDetalleBody";
import { useFactura } from "../../../hooks/useFactura";
import { useTimbrarFacturaDialog } from "../../../hooks/useTimbrarFacturaDialog";
import type { FacturaDetalle } from "../../../services/detail";

const cliente = { rfc: "XAXX010101000", codigo_postal: "64000", regimen_fiscal: "616", uso_cfdi_default: "G03" };
const f1 = { id: "f1", organization_id: "org1", cliente_id: "c1", uso_cfdi: "G03", forma_pago: "99", metodo_pago: "PPD", moneda: "MXN", tipo_cambio: 1, total: 5, numero: "BORRADOR", cliente_nombre: "Prueba", fecha_emision: "2026-10-07", notas: "primera", dias_credito: 0, estado: "Borrador", uuid_fiscal: null, facturapi_id: null };
const f2 = { ...f1, id: "f2", organization_id: "org2", cliente_id: "c2", rfc_cliente: "AAA010101AAA", uso_cfdi: "G01", notas: "segunda" };
const cliente2 = { ...cliente, rfc: "AAA010101AAA", regimen_fiscal: "601" };
let confirmar: (() => Promise<void>) | undefined;
let diagnostico: Record<string, unknown> = {};
function TimbrarControl({ factura, qc }: { factura: FacturaDetalle; qc: QueryClient }) {
  const fiscal = qc.getQueryData<typeof cliente>(queryKeys.facturacion.clienteFiscal(factura.cliente_id));
  const dlg = useTimbrarFacturaDialog(factura, fiscal, null, vi.fn());
  useEffect(() => { confirmar = dlg.onConfirm; diagnostico = { uso: dlg.usoCfdi, forma: dlg.formaPago, metodo: dlg.metodoPago, pending: dlg.datosFiscalesPending, error: dlg.datosFiscalesError, mutaciones: qc.getMutationCache().getAll().map((m) => ({ status: m.state.status, data: m.state.data, key: m.options.mutationKey })) }; }, [dlg, qc]);
  return <button disabled={dlg.datosFiscalesSinGuardar} onClick={() => void dlg.onConfirm()}>Timbrar prueba</button>;
}
function Harness({ id, qc, edit = true }: { id: string; qc: QueryClient; edit?: boolean }) {
  const { data } = useFactura(id);
  if (!data) return null;
  return <><FacturaDetalleBody factura={data} canEdit puedeEditarBorrador={edit} conceptosVivos={[]} onRegistrarPago={vi.fn()} /><TimbrarControl factura={data} qc={qc} /></>;
}
function usuario(organizationId = "org1") {
  setAuthSnapshot({ userId: "u1", organizationId, role: "admin", effectiveRole: "admin", email: null, organizationName: null });
  syncActiveOrganizationScope({ userId: "u1", organizationId });
}
function setup(initialId = "f1", path = "/") {
  usuario(initialId === "f2" ? "org2" : "org1");
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity }, mutations: { retry: false } } });
  for (const f of [f1, f2]) qc.setQueryData(queryKeys.facturas.detail(f.id), { ...mocks.stored[f.id] });
  qc.setQueryData(queryKeys.facturacion.clienteFiscal("c1"), cliente);
  qc.setQueryData(queryKeys.facturacion.clienteFiscal("c2"), cliente2);
  const tree = (id: string, edit = true) => <QueryClientProvider client={qc}><MemoryRouter initialEntries={[path]}><Harness id={id} qc={qc} edit={edit} /></MemoryRouter></QueryClientProvider>;
  const view = render(tree(initialId));
  return { ...view, qc, changeInvoice: (id: string, edit = true) => { usuario(mocks.stored[id].organization_id as string); view.rerender(tree(id, edit)); } };
}
async function selectUso(uso: string) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Uso CFDI" }), { key: "Enter" });
  fireEvent.keyDown(await screen.findByRole("option", { name: new RegExp(`^${uso}`) }), { key: "Enter" });
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Uso CFDI" })).toHaveTextContent(uso));
}
const tab = (name: string) => fireEvent.keyDown(screen.getByRole("tab", { name }), { key: "Enter" });
const pause = () => act(() => new Promise((resolve) => setTimeout(resolve, 650)));
beforeEach(() => {
  vi.clearAllMocks(); confirmar = undefined;
  mocks.stored = { f1: { ...f1 }, f2: { ...f2 } };
  mocks.fetchFactura.mockImplementation(async (id: string) => ({ ...mocks.stored[id] }));
  mocks.fiscal.mockResolvedValue(cliente);
  mocks.actualizar.mockImplementation(async (id: string, patch: object) => { mocks.stored[id] = { ...mocks.stored[id], ...patch }; });
  mocks.timbrar.mockImplementation((_id, opts) => void opts?.onSuccess?.({ uuid: "uuid", uso_cfdi_solicitado: "S01", uso_cfdi_efectivo: "S01", fuente_uso_cfdi: "xml" }));
  mocks.guardarDefaults.mockResolvedValue(undefined);
});

describe("selección fiscal: Card + Body + DocumentoTabs + autosave + React Query reales", () => {
  it("cambiar de pestaña antes de 500 ms conserva S01, lo guarda una vez y no cambia defaults del cliente", async () => {
    const { qc } = setup();
    await selectUso("S01"); tab("Cliente y datos fiscales");
    expect(screen.getByText("Configuración de timbrado")).not.toBeVisible();
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledWith("f1", expect.objectContaining({ uso_cfdi: "S01" }), undefined, expect.objectContaining({ organizationId: "org1", borrador: true, authScope: expect.any(Object) })));
    await waitFor(() => expect(mocks.fetchFactura).toHaveBeenCalled());
    tab("Conceptos");
    expect(screen.getByRole("combobox", { name: "Uso CFDI" })).toHaveTextContent("S01");
    expect(mocks.actualizar).toHaveBeenCalledOnce();
    expect(mocks.actualizar.mock.calls[0][1]).toEqual({ uso_cfdi: "S01" });
    expect(mocks.timbrar).not.toHaveBeenCalled();
    expect(qc.getQueryData<typeof cliente>(queryKeys.facturacion.clienteFiscal("c1"))?.uso_cfdi_default).toBe("G03");
  });
  it("una pestaña editable nunca visitada no monta la card ni guarda nada", async () => {
    setup("f1", "/?tab=fiscal");
    expect(screen.queryByText("Configuración de timbrado")).not.toBeInTheDocument();
    await pause(); expect(mocks.actualizar).not.toHaveBeenCalled();
  });
  it("cambiar de factura/empresa antes del debounce cancela la captura antigua", async () => {
    const { changeInvoice } = setup();
    await selectUso("S01"); changeInvoice("f2");
    expect(screen.getByRole("combobox", { name: "Uso CFDI" })).toHaveTextContent("G01");
    await pause(); expect(mocks.actualizar).not.toHaveBeenCalled();
    await selectUso("G03");
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledWith("f2", expect.objectContaining({ uso_cfdi: "G03" }), undefined, expect.objectContaining({ organizationId: "org2", borrador: true, authScope: expect.any(Object) })));
    expect(mocks.stored.f1.uso_cfdi).toBe("G03");
  });
  it("desmontar/cancelar antes de enviar no hace flush ni emite", async () => {
    const { unmount } = setup();
    await selectUso("S01"); unmount(); await pause();
    expect(mocks.actualizar).not.toHaveBeenCalled(); expect(mocks.timbrar).not.toHaveBeenCalled();
  });
  it("dejar de ser editable cancela el debounce sin escribir sobre una factura cancelada", async () => {
    const { changeInvoice } = setup();
    await selectUso("S01"); mocks.stored.f1.estado = "Cancelada"; changeInvoice("f1", false);
    await pause(); expect(mocks.actualizar).not.toHaveBeenCalled();
  });
  it("un error conserva la selección visible y nunca la presenta como guardada", async () => {
    mocks.actualizar.mockRejectedValue(new Error("rechazado"));
    setup(); await selectUso("S01"); tab("Cliente y datos fiscales");
    await waitFor(() => expect(mocks.error).toHaveBeenCalled()); tab("Conceptos");
    expect(screen.getByRole("combobox", { name: "Uso CFDI" })).toHaveTextContent("S01");
    expect(screen.getByText("No se guardó")).toBeVisible(); expect(mocks.stored.f1.uso_cfdi).toBe("G03");
    expect(mocks.error).toHaveBeenCalledWith(undefined, expect.objectContaining({ context: { facturaId: "f1", organizationId: "org1" } }));
  });
  it("timbrar espera al guardado/refresco de esa factura y después emite S01 sólo una vez", async () => {
    setup(); await selectUso("S01"); tab("Cliente y datos fiscales");
    expect(screen.getByRole("button", { name: "Timbrar prueba" })).toBeDisabled();
    await act(async () => { await confirmar?.(); }); expect(mocks.timbrar).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Timbrar prueba" }), JSON.stringify(diagnostico)).toBeEnabled(), { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: "Timbrar prueba" }));
    await waitFor(() => expect(mocks.timbrar, JSON.stringify({ diagnostico, errores: mocks.error.mock.calls, escrituras: mocks.actualizar.mock.calls.map((c) => c.slice(0, 2)) })).toHaveBeenCalledOnce());
    expect(mocks.stored.f1.uso_cfdi).toBe("S01");
  });
  it("un default tardío no sustituye la selección explícita pendiente", async () => {
    mocks.stored.f1.uso_cfdi = null;
    const { qc } = setup(); await selectUso("S01");
    act(() => { qc.setQueryData(queryKeys.facturacion.clienteFiscal("c1"), { ...cliente, uso_cfdi_default: "G01" }); });
    expect(screen.getByRole("combobox", { name: "Uso CFDI" })).toHaveTextContent("S01");
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledWith("f1", expect.objectContaining({ uso_cfdi: "S01" }), undefined, expect.objectContaining({ organizationId: "org1", borrador: true, authScope: expect.any(Object) })));
  });

  it("un error G01→G03 compatible bloquea timbrar el valor viejo hasta reintentar y confirmar G03", async () => {
    mocks.actualizar.mockRejectedValueOnce(new Error("rechazado"));
    setup("f2"); await selectUso("G03"); tab("Cliente y datos fiscales");
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Timbrar prueba" })).toBeDisabled();
    await act(async () => { await confirmar?.(); });
    expect(mocks.actualizar).toHaveBeenCalledOnce(); expect(mocks.timbrar).not.toHaveBeenCalled();
    expect(mocks.stored.f2.uso_cfdi).toBe("G01");
    tab("Conceptos"); expect(screen.getByRole("combobox", { name: "Uso CFDI" })).toHaveTextContent("G03");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar guardado" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Timbrar prueba" }), JSON.stringify(diagnostico)).toBeEnabled(), { timeout: 3000 });
    expect(mocks.stored.f2.uso_cfdi).toBe("G03"); expect(mocks.timbrar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Timbrar prueba" }));
    await waitFor(() => expect(mocks.timbrar, JSON.stringify({ diagnostico, errores: mocks.error.mock.calls, escrituras: mocks.actualizar.mock.calls.map((c) => c.slice(0, 2)) })).toHaveBeenCalledOnce());
    expect(mocks.stored.f2.uso_cfdi).toBe("G03");
  });

  it.each([false, true])("volver durante un guardado hidrata campos intactos sin regrabar uso viejo (cambio de empresa=%s)", async (cambioEmpresa) => {
    let resolve!: () => void;
    mocks.actualizar.mockImplementationOnce(async (id: string, patch: object) => {
      await new Promise<void>((ok) => { resolve = ok; });
      mocks.stored[id] = { ...mocks.stored[id], ...patch };
    });
    const { changeInvoice, qc } = setup("f2"); await selectUso("G03");
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledOnce());
    if (!cambioEmpresa) {
      mocks.stored.f1.organization_id = "org2";
      act(() => { qc.setQueryData(queryKeys.facturas.detail("f1"), { ...mocks.stored.f1 }); });
    }
    changeInvoice("f1"); changeInvoice("f2");
    await act(async () => { resolve(); });
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Uso CFDI" })).toHaveTextContent("G03"));
    fireEvent.change(screen.getByPlaceholderText("Notas internas para el CFDI (opcional)"), { target: { value: "nota nueva" } });
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledTimes(2));
    expect(mocks.actualizar.mock.calls[1][1]).toEqual({ notas: "nota nueva" });
    expect(mocks.stored.f2.uso_cfdi).toBe("G03");
  });
  it("la instancia remontada conserva una nueva elección mientras espera la escritura anterior", async () => {
    let resolve!: () => void;
    mocks.actualizar.mockImplementationOnce(async (id: string, patch: object) => {
      await new Promise<void>((ok) => { resolve = ok; });
      mocks.stored[id] = { ...mocks.stored[id], ...patch };
    });
    const { changeInvoice, qc } = setup("f2"); await selectUso("G03");
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledOnce());
    mocks.stored.f1.organization_id = "org2";
    act(() => { qc.setQueryData(queryKeys.facturas.detail("f1"), { ...mocks.stored.f1 }); });
    changeInvoice("f1"); changeInvoice("f2"); await selectUso("S01");
    await pause(); expect(mocks.actualizar).toHaveBeenCalledOnce();
    await act(async () => { resolve(); });
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Timbrar prueba" }), JSON.stringify(diagnostico)).toBeEnabled(), { timeout: 3000 });
    expect(screen.getByRole("combobox", { name: "Uso CFDI" })).toHaveTextContent("S01");
    expect(mocks.stored.f2.uso_cfdi).toBe("S01");
  });

  it("al volver bloquea Timbrar durante lectura nueva, conserva bloqueo si falla y permite reintentar", async () => {
    let enviar!: () => void; let fallarLectura!: (error: Error) => void;
    mocks.actualizar.mockImplementationOnce(async (id: string, patch: object) => {
      await new Promise<void>((ok) => { enviar = ok; });
      mocks.stored[id] = { ...mocks.stored[id], ...patch };
    });
    const { changeInvoice } = setup("f2"); await selectUso("G03");
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledOnce());
    changeInvoice("f1"); changeInvoice("f2");
    mocks.fetchFactura.mockImplementationOnce(() => new Promise((_ok, fail) => { fallarLectura = fail; }));
    await act(async () => { enviar(); });
    await waitFor(() => expect(mocks.fetchFactura).toHaveBeenCalled());
    expect(mocks.stored.f2.uso_cfdi).toBe("G03");
    expect(screen.getByRole("button", { name: "Timbrar prueba" })).toBeDisabled();
    await act(async () => { await confirmar?.(); }); expect(mocks.timbrar).not.toHaveBeenCalled();
    await act(async () => { fallarLectura(new Error("lectura fallida")); });
    await waitFor(() => expect(screen.getByText("No se guardó")).toBeVisible());
    expect(screen.getByRole("button", { name: "Timbrar prueba" })).toBeDisabled();
    await act(async () => { await confirmar?.(); }); expect(mocks.timbrar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar guardado" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Timbrar prueba" }), JSON.stringify(diagnostico)).toBeEnabled(), { timeout: 3000 });
    expect(screen.getByRole("combobox", { name: "Uso CFDI" })).toHaveTextContent("G03");
    expect(mocks.actualizar).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Timbrar prueba" }));
    await waitFor(() => expect(mocks.timbrar, JSON.stringify({ diagnostico, errores: mocks.error.mock.calls, escrituras: mocks.actualizar.mock.calls.map((c) => c.slice(0, 2)) })).toHaveBeenCalledOnce());
    expect(mocks.stored.f2.uso_cfdi).toBe("G03");
  });

  it("un GET de retorno retenido queda antes de la nueva escritura y nunca reemplaza su confirmación", async () => {
    let enviar!: () => void; let leer!: () => void;
    mocks.actualizar.mockImplementationOnce(async (id: string, patch: object) => {
      await new Promise<void>((ok) => { enviar = ok; });
      mocks.stored[id] = { ...mocks.stored[id], ...patch };
    });
    const { changeInvoice, qc } = setup("f2"); await selectUso("G03");
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledOnce());
    changeInvoice("f1"); changeInvoice("f2");
    mocks.fetchFactura.mockImplementationOnce(async (id: string) => {
      const snapshot = { ...mocks.stored[id] };
      await new Promise<void>((ok) => { leer = ok; });
      return snapshot;
    });
    await act(async () => { enviar(); });
    await waitFor(() => expect(mocks.fetchFactura).toHaveBeenCalled());
    await selectUso("S01"); await pause();
    expect(mocks.actualizar).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Timbrar prueba" })).toBeDisabled();
    await act(async () => { leer(); });
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Timbrar prueba" }), JSON.stringify(diagnostico)).toBeEnabled(), { timeout: 3000 });
    expect(mocks.stored.f2.uso_cfdi).toBe("S01");
    expect(qc.getQueryData<typeof f2>(queryKeys.facturas.detail("f2"))?.uso_cfdi).toBe("S01");
    expect(screen.getByRole("combobox", { name: "Uso CFDI" })).toHaveTextContent("S01");
    expect(mocks.timbrar).not.toHaveBeenCalled();
  });

  it("la lectura de retorno no cambia caché si cambia el usuario durante el GET", async () => {
    let enviar!: () => void; let leer!: () => void;
    mocks.actualizar.mockImplementationOnce(async (id: string, patch: object) => {
      await new Promise<void>((ok) => { enviar = ok; });
      mocks.stored[id] = { ...mocks.stored[id], ...patch };
    });
    const { changeInvoice, qc } = setup("f2"); await selectUso("G03");
    await waitFor(() => expect(mocks.actualizar).toHaveBeenCalledOnce());
    changeInvoice("f1"); changeInvoice("f2");
    mocks.fetchFactura.mockImplementationOnce(async (id: string) => {
      await new Promise<void>((ok) => { leer = ok; }); return { ...mocks.stored[id] };
    });
    await act(async () => { enviar(); });
    await waitFor(() => expect(mocks.fetchFactura).toHaveBeenCalled());
    setAuthSnapshot({ userId: "u2", organizationId: "org2", role: "admin", effectiveRole: "admin", email: null, organizationName: null });
    syncActiveOrganizationScope({ userId: "u2", organizationId: "org2" });
    await act(async () => { leer(); });
    await waitFor(() => expect(qc.isMutating()).toBe(0));
    expect(qc.getQueryData<typeof f2>(queryKeys.facturas.detail("f2"))?.uso_cfdi).toBe("G01");
    expect(mocks.actualizar).toHaveBeenCalledOnce(); expect(mocks.error).not.toHaveBeenCalled();
  });

});
