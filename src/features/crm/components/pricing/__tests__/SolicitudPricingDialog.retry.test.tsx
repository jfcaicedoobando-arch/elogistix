import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crmPricingKeys as keys } from "@/features/crm/queryKeys.performance";
import type { SolicitudPricingInsert, SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";
import type { DatosSolicitud } from "../SolicitudPricingCampos";

const services = vi.hoisted(() => ({
  actualizarSolicitud: vi.fn(), cancelarSolicitud: vi.fn(), crearSolicitud: vi.fn(),
  eliminarOpcion: vi.fn(), enviarSolicitud: vi.fn(), guardarOpcion: vi.fn(),
  listarBandejaPricing: vi.fn(), listarOpciones: vi.fn(), listarSolicitudesOportunidad: vi.fn(),
  listarUsuariosOrg: vi.fn(), obtenerSolicitud: vi.fn(), responderSolicitud: vi.fn(),
}));
const mocks = vi.hoisted(() => ({ subir: vi.fn(), success: vi.fn(), error: vi.fn(), cambio: vi.fn() }));
const contexto = vi.hoisted(() => ({ userId: "u1", organizationId: "org1" }));
vi.mock("@/features/crm/services/pricing/pricingCrm", () => services);
vi.mock("@/features/crm/services/pricing/tarifasParaPricing", () => ({ listarTarifasParaPricing: vi.fn() }));
vi.mock("@/features/crm/services/pricing/adjuntosPricing", () => ({ subirAdjunto: mocks.subir }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: mocks.success, notifyError: mocks.error }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: contexto.userId } }) }));
vi.mock("@/hooks/shared/useOrgActiva", () => ({ useOrgActiva: () => ({ organizationId: contexto.organizationId }) }));
vi.mock("@/lib/date/mx", () => ({ hoyMx: () => "2026-10-08" }));
vi.mock("../SolicitudPricingCampos", () => ({
  SolicitudPricingCampos: ({ datos, set, disabled }: {
    datos: DatosSolicitud; set: <K extends keyof DatosSolicitud>(campo: K, valor: DatosSolicitud[K]) => void; disabled: boolean;
  }) => <>
    <input aria-label="Servicio" value={datos.servicio ?? ""} disabled={disabled} onChange={(e) => set("servicio", e.target.value)} />
    <input aria-label="Origen" value={datos.origen ?? ""} disabled={disabled} onChange={(e) => set("origen", e.target.value)} />
    <input aria-label="Destino" value={datos.destino ?? ""} disabled={disabled} onChange={(e) => set("destino", e.target.value)} />
  </>,
}));
vi.mock("../AdjuntosPendientes", () => ({
  AdjuntosPendientes: ({ archivos, onChange, disabled }: { archivos: File[]; onChange: (files: File[]) => void; disabled: boolean }) => <>
    <input type="file" aria-label="Archivos" disabled={disabled} onChange={(e) => onChange(Array.from(e.target.files ?? []))} />
    {archivos.map((f) => <span key={f.name}>{f.name}</span>)}
  </>,
}));
vi.mock("../AdjuntosSolicitudPricing", () => ({ AdjuntosSolicitudPricing: () => null }));
import { SolicitudPricingDialog } from "../SolicitudPricingDialog";
import { purgeSessionCache } from "@/lib/auth/purgeSessionCache";

const borrador: SolicitudPricingRow = {
  id: "s1", organization_id: "org1", oportunidad_id: "o1", solicitante_id: "u1", created_by: "u1",
  estado: "borrador", folio: "SP1", fecha: "2026-10-08", complejidad: "media", created_at: "", updated_at: "",
  cantidad: null, cliente: null, commodity: null, container_size: null, deleted_at: null, delivery: null,
  destino: "Manzanillo", dimensiones: null, enviada_at: null, estibable: null, fecha_tentativa_carga: null,
  imo: null, incoterm: null, notas: null, origen: "Shanghai", peso: null, pod: null, pol: null,
  respondida_at: null, servicio: "Marítimo", tipo_carga: null, unidad_medida: null, vence_at: null, tarifa_tarifario_id: null,
};
let client: QueryClient;
function Harness({ clienteNombre = "Cliente" }: { clienteNombre?: string }) {
  const [open, setOpen] = useState(true);
  const [solicitud, setSolicitud] = useState<SolicitudPricingRow | null>(null);
  return <QueryClientProvider client={client}>
    <button onClick={() => { setSolicitud(null); setOpen(true); }}>Nueva solicitud</button>
    <button onClick={() => { setSolicitud(client.getQueryData<SolicitudPricingRow[]>(keys.oportunidad("o1"))?.[0] ?? null); setOpen(true); }}>Editar borrador</button>
    <SolicitudPricingDialog open={open} onOpenChange={(next) => { mocks.cambio(next); setOpen(next); }}
      oportunidadId="o1" clienteNombre={clienteNombre} solicitud={solicitud} />
  </QueryClientProvider>;
}
function SesionHarness({ open = true, oportunidadId = "o1", solicitud = null }: {
  open?: boolean; oportunidadId?: string; solicitud?: SolicitudPricingRow | null;
}) {
  return <QueryClientProvider client={client}>
    <SolicitudPricingDialog open={open} onOpenChange={mocks.cambio}
      oportunidadId={oportunidadId} solicitud={solicitud} />
  </QueryClientProvider>;
}
function diferido<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((si, no) => { resolve = si; reject = no; });
  return { promise, resolve, reject };
}
function completar() {
  fireEvent.change(screen.getByLabelText("Servicio"), { target: { value: "Marítimo" } });
  fireEvent.change(screen.getByLabelText("Origen"), { target: { value: "Shanghai" } });
  fireEvent.change(screen.getByLabelText("Destino"), { target: { value: "Manzanillo" } });
}
function enviar() { fireEvent.click(screen.getByRole("button", { name: "Enviar a Pricing" })); }
function form() { return screen.getByLabelText("Servicio").closest("form")!; }
async function parcial() {
  services.enviarSolicitud.mockRejectedValueOnce(new Error("LC_PRICING_INCOMPLETA"));
  render(<Harness />); completar(); enviar();
  await screen.findByRole("status");
  await waitFor(() => expect(screen.getByRole("button", { name: "Enviar a Pricing" })).toBeEnabled());
}
beforeEach(() => {
  contexto.userId = "u1"; contexto.organizationId = "org1";
  for (const fn of Object.values(services)) fn.mockReset().mockResolvedValue(undefined);
  for (const fn of Object.values(mocks)) fn.mockReset();
  services.crearSolicitud.mockImplementation(async (datos: SolicitudPricingInsert) => ({ ...borrador, ...datos, id: "s1", folio: "SP1" }));
  mocks.subir.mockResolvedValue(undefined);
  // Cualquier acceso accidental a red hace fallar la prueba.
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No se permiten solicitudes reales en esta prueba"); }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity }, mutations: { retry: false } } });
  client.setQueryData(keys.oportunidad("o1"), []);
});
afterEach(() => { cleanup(); client.clear(); });

describe("recuperación del guardado parcial de Pricing", () => {
  it("INSERT exitoso y envío fallido conserva captura, caché y un estado honesto", async () => {
    await parcial();
    expect(services.crearSolicitud).toHaveBeenCalledTimes(1);
    expect(services.enviarSolicitud).toHaveBeenCalledWith("s1");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Origen")).toHaveValue("Shanghai");
    expect(screen.getByRole("status")).toHaveTextContent("La solicitud se guardó, pero no se confirmó el envío");
    expect(client.getQueryData(keys.solicitud("s1"))).toMatchObject({ id: "s1", estado: "borrador", folio: "SP1" });
    expect(client.getQueryData(keys.oportunidad("o1"))).toEqual([expect.objectContaining({ id: "s1" })]);
    expect(mocks.cambio).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("reintentar Enviar actualiza la misma solicitud con las correcciones y cierra", async () => {
    await parcial();
    fireEvent.change(screen.getByLabelText("Origen"), { target: { value: "Ningbo" } });
    enviar();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(services.crearSolicitud).toHaveBeenCalledTimes(1);
    expect(services.actualizarSolicitud).toHaveBeenCalledWith("s1", expect.objectContaining({ origen: "Ningbo" }));
    expect(services.enviarSolicitud.mock.calls).toEqual([["s1"], ["s1"]]);
    expect(mocks.success).toHaveBeenCalledWith(undefined, { title: "Solicitud enviada a Pricing" });
  });

  it("otro fallo al reintentar conserva el ID también para Guardar borrador", async () => {
    await parcial();
    services.enviarSolicitud.mockRejectedValueOnce(new Error("falló de nuevo"));
    enviar();
    await waitFor(() => expect(services.enviarSolicitud).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledWith(false));
    expect(services.crearSolicitud).toHaveBeenCalledTimes(1);
    expect(services.actualizarSolicitud.mock.calls.map(([id]) => id)).toEqual(["s1", "s1"]);
  });

  it("un cambio de nombre durante la misma sesión no pierde ID, captura ni archivos", async () => {
    services.enviarSolicitud.mockRejectedValueOnce(new Error("falló enviar"));
    const view = render(<Harness />); completar();
    const archivo = new File(["1"], "pendiente.pdf");
    fireEvent.change(screen.getByLabelText("Archivos"), { target: { files: [archivo] } });
    enviar(); await screen.findByRole("status");
    view.rerender(<Harness clienteNombre="Cliente actualizado" />);
    expect(screen.getByLabelText("Origen")).toHaveValue("Shanghai");
    expect(screen.getByText("pendiente.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledWith(false));
    expect(services.crearSolicitud).toHaveBeenCalledTimes(1);
    expect(services.actualizarSolicitud).toHaveBeenCalledWith("s1", expect.anything());
    expect(mocks.subir).toHaveBeenCalledWith("org1", "s1", archivo);
  });

  it("Guardar borrador después del fallo reutiliza ID y sube los archivos pendientes", async () => {
    services.enviarSolicitud.mockRejectedValueOnce(new Error("falló enviar"));
    render(<Harness />); completar();
    const archivo = new File(["contenido de prueba"], "cotizacion.pdf");
    fireEvent.change(screen.getByLabelText("Archivos"), { target: { files: [archivo] } });
    enviar(); await screen.findByRole("status");
    expect(screen.getByText("cotizacion.pdf")).toBeInTheDocument();
    expect(mocks.subir).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledWith(false));
    expect(services.crearSolicitud).toHaveBeenCalledTimes(1);
    expect(services.actualizarSolicitud).toHaveBeenCalledWith("s1", expect.anything());
    expect(services.enviarSolicitud).toHaveBeenCalledTimes(1);
    expect(mocks.subir).toHaveBeenCalledWith("org1", "s1", archivo);
    expect(mocks.success).toHaveBeenCalledWith(undefined, { title: "Borrador guardado" });
  });

  it("dos submits en el mismo turno hacen un INSERT y bloquean cierre durante el envío", async () => {
    let insertar!: (row: SolicitudPricingRow) => void;
    let terminarEnvio!: () => void;
    services.crearSolicitud.mockReturnValueOnce(new Promise<SolicitudPricingRow>((resolve) => { insertar = resolve; }));
    services.enviarSolicitud.mockReturnValueOnce(new Promise<void>((resolve) => { terminarEnvio = resolve; }));
    render(<Harness />); completar();
    act(() => { fireEvent.submit(form()); fireEvent.submit(form()); });
    await waitFor(() => expect(services.crearSolicitud).toHaveBeenCalledTimes(1));
    await act(async () => insertar(borrador));
    await waitFor(() => expect(services.enviarSolicitud).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(mocks.cambio).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await act(async () => terminarEnvio());
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledTimes(1));
  });

  it("mantiene bloqueo de submits y cierre hasta terminar de adjuntar", async () => {
    let terminarAdjunto!: () => void;
    mocks.subir.mockReturnValueOnce(new Promise<void>((resolve) => { terminarAdjunto = resolve; }));
    render(<Harness />); completar();
    fireEvent.change(screen.getByLabelText("Archivos"), { target: { files: [new File(["1"], "uno.pdf")] } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(mocks.subir).toHaveBeenCalledTimes(1));
    fireEvent.submit(form());
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    expect(services.crearSolicitud).toHaveBeenCalledTimes(1);
    expect(services.actualizarSolicitud).not.toHaveBeenCalled();
    expect(mocks.cambio).not.toHaveBeenCalled();
    await act(async () => terminarAdjunto());
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledTimes(1));
  });

  it("cerrar tras el parcial y reabrir el borrador usa el ID de la caché", async () => {
    await parcial();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Editar borrador" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Solicitud SP1");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    enviar(); await waitFor(() => expect(mocks.cambio).toHaveBeenCalledTimes(2));
    expect(services.crearSolicitud).toHaveBeenCalledTimes(1);
    expect(services.actualizarSolicitud).toHaveBeenCalledWith("s1", expect.anything());
  });

  it("Nueva solicitud tras cerrar inicia una sesión limpia, sin reutilizar el borrador previo", async () => {
    await parcial();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Nueva solicitud" }));
    expect(screen.getByLabelText("Origen")).toHaveValue("");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(services.crearSolicitud).toHaveBeenCalledTimes(2));
    expect(services.actualizarSolicitud).not.toHaveBeenCalled();
  });

  it.each(["ediciones", "archivos"])("confirmar descarte de %s pendientes no elimina el borrador guardado", async (pendiente) => {
    await parcial();
    if (pendiente === "ediciones") fireEvent.change(screen.getByLabelText("Origen"), { target: { value: "sin guardar" } });
    else fireEvent.change(screen.getByLabelText("Archivos"), { target: { files: [new File(["1"], "sin-subir.pdf")] } });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(mocks.cambio).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(client.getQueryData(keys.solicitud("s1"))).toMatchObject({ origen: "Shanghai" });
    expect(services.cancelarSolicitud).not.toHaveBeenCalled();
    expect(mocks.subir).not.toHaveBeenCalled();
  });
});

describe("aislamiento de operaciones entre sesiones de Pricing", () => {
  const cambios = ["oportunidad", "organización", "usuario", "solicitud", "reapertura"] as const;
  it.each(cambios.flatMap((cambio) => [
    { cambio, falla: true }, { cambio, falla: false },
  ]))("ignora el resultado anterior al cambiar $cambio (fallo=$falla)", async ({ cambio, falla }) => {
    const envio = diferido<void>();
    services.enviarSolicitud.mockReturnValueOnce(envio.promise);
    const view = render(<SesionHarness />); completar();
    fireEvent.change(screen.getByLabelText("Archivos"), { target: { files: [new File(["1"], "anterior.pdf")] } });
    enviar();
    await waitFor(() => expect(services.enviarSolicitud).toHaveBeenCalledWith("s1"));
    if (cambio === "organización") contexto.organizationId = "org2";
    if (cambio === "usuario") contexto.userId = "u2";
    if (cambio === "reapertura") view.rerender(<SesionHarness open={false} />);
    const oportunidadId = cambio === "oportunidad" ? "o2" : "o1";
    const solicitud = cambio === "solicitud" ? { ...borrador, id: "s2", folio: "SP2" } : null;
    view.rerender(<SesionHarness oportunidadId={oportunidadId} solicitud={solicitud} />);
    expect(screen.getByLabelText("Origen")).toHaveValue(solicitud ? "Shanghai" : "");
    expect(screen.queryByText("anterior.pdf")).not.toBeInTheDocument();
    completar();
    fireEvent.change(screen.getByLabelText("Origen"), { target: { value: "Otra sesión" } });
    await act(async () => { if (falla) envio.reject(new Error("falló el envío antiguo")); else envio.resolve(); });
    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("Origen")).toHaveValue("Otra sesión");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(mocks.cambio).not.toHaveBeenCalled();
    expect(mocks.subir).not.toHaveBeenCalled();
    services.crearSolicitud.mockImplementationOnce(async (datos: SolicitudPricingInsert) => ({ ...borrador, ...datos, id: "s2" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledWith(false));
    const datos = expect.objectContaining({ oportunidad_id: oportunidadId, organization_id: contexto.organizationId,
      solicitante_id: solicitud?.solicitante_id ?? contexto.userId, origen: "Otra sesión" });
    if (solicitud) expect(services.actualizarSolicitud).toHaveBeenCalledWith("s2", datos);
    else {
      expect(services.crearSolicitud).toHaveBeenLastCalledWith(datos);
      expect(services.actualizarSolicitud).not.toHaveBeenCalled();
    }
    expect(services.enviarSolicitud).toHaveBeenCalledTimes(1);
  });

  it.each([true, false])("el finally antiguo no libera el bloqueo de la operación nueva (fallo=%s)", async (falla) => {
    const envio = diferido<void>();
    const altaNueva = diferido<SolicitudPricingRow>();
    services.enviarSolicitud.mockReturnValueOnce(envio.promise);
    const view = render(<SesionHarness />); completar(); enviar();
    await waitFor(() => expect(services.enviarSolicitud).toHaveBeenCalledTimes(1));
    view.rerender(<SesionHarness oportunidadId="o2" />); completar();
    services.crearSolicitud.mockReturnValueOnce(altaNueva.promise);
    act(() => { fireEvent.submit(form()); fireEvent.submit(form()); });
    await waitFor(() => expect(services.crearSolicitud).toHaveBeenCalledTimes(2));
    await act(async () => { if (falla) envio.reject(new Error("envío anterior")); else envio.resolve(); });
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    fireEvent.submit(form());
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(services.crearSolicitud).toHaveBeenCalledTimes(2);
    expect(services.actualizarSolicitud).not.toHaveBeenCalled();
    expect(mocks.cambio).not.toHaveBeenCalled();
    await act(async () => altaNueva.resolve({ ...borrador, id: "s2", oportunidad_id: "o2" }));
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledTimes(1));
    expect(services.enviarSolicitud.mock.calls).toEqual([["s1"], ["s2"]]);
  });

  it.each([true, false])("interrumpir adjuntos no continúa el lote ni cambia la sesión nueva (fallo=%s)", async (falla) => {
    const adjunto = diferido<void>();
    mocks.subir.mockReturnValueOnce(adjunto.promise);
    const view = render(<SesionHarness />); completar();
    fireEvent.change(screen.getByLabelText("Archivos"), { target: { files: [new File(["1"], "uno.pdf"), new File(["2"], "dos.pdf")] } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(mocks.subir).toHaveBeenCalledTimes(1));
    view.rerender(<SesionHarness oportunidadId="o2" />); completar();
    fireEvent.change(screen.getByLabelText("Archivos"), { target: { files: [new File(["3"], "nuevo.pdf")] } });
    await act(async () => { if (falla) adjunto.reject(new Error("adjunto anterior")); else adjunto.resolve(); });
    expect(mocks.subir).toHaveBeenCalledTimes(1);
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.cambio).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Origen")).toHaveValue("Shanghai");
    expect(screen.getByText("nuevo.pdf")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-busy", "true");
  });

  it.each(["oportunidad", "organización"])("no reutiliza una solicitud incompatible al cambiar %s", async (cambio) => {
    const view = render(<SesionHarness solicitud={borrador} />);
    if (cambio === "organización") contexto.organizationId = "org2";
    const oportunidadId = cambio === "oportunidad" ? "o2" : "o1";
    view.rerender(<SesionHarness oportunidadId={oportunidadId} solicitud={borrador} />);
    expect(screen.getByLabelText("Origen")).toHaveValue("");
    expect(screen.getByRole("dialog")).toHaveTextContent("Nueva solicitud a Pricing");
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledWith(false));
    expect(services.actualizarSolicitud).not.toHaveBeenCalled();
    expect(services.crearSolicitud).toHaveBeenCalledWith(expect.objectContaining({ oportunidad_id: oportunidadId,
      organization_id: contexto.organizationId, solicitante_id: contexto.userId }));
  });

  it("una purga revoca también la sesión del diálogo aunque conserve usuario y organización", async () => {
    const insert = diferido<SolicitudPricingRow>();
    services.crearSolicitud.mockReturnValueOnce(insert.promise);
    render(<SesionHarness />); completar(); enviar();
    await waitFor(() => expect(services.crearSolicitud).toHaveBeenCalledTimes(1));
    await act(async () => purgeSessionCache(client));
    expect(screen.getByLabelText("Origen")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeEnabled();
    await act(async () => insert.resolve(borrador));
    expect(screen.getByLabelText("Origen")).toHaveValue("");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(mocks.cambio).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled(); expect(mocks.error).not.toHaveBeenCalled();
    expect(services.enviarSolicitud).not.toHaveBeenCalled();
    expect(client.getQueryData(keys.solicitud("s1"))).toBeUndefined();
  });
});
