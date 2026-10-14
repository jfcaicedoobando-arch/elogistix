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
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";

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
function completar() {
  fireEvent.change(screen.getByLabelText("Servicio"), { target: { value: "Marítimo" } });
  fireEvent.change(screen.getByLabelText("Origen"), { target: { value: "Shanghai" } });
  fireEvent.change(screen.getByLabelText("Destino"), { target: { value: "Manzanillo" } });
}
function enviar() { fireEvent.click(screen.getByRole("button", { name: "Revisar tarifario" })); }
function form() { return screen.getByLabelText("Servicio").closest("form")!; }
function diferido<T>() {
  let resolve!: (value: T) => void; let reject!: (error: Error) => void;
  const promise = new Promise<T>((si, no) => { resolve = si; reject = no; });
  return { promise, resolve, reject };
}
function SesionHarness({ open = true, oportunidadId = "o1", solicitud = null }: {
  open?: boolean; oportunidadId?: string; solicitud?: SolicitudPricingRow | null;
}) {
  return <QueryClientProvider client={client}>
    <SolicitudPricingDialog open={open} onOpenChange={mocks.cambio} oportunidadId={oportunidadId} solicitud={solicitud} />
  </QueryClientProvider>;
}
beforeEach(() => {
  contexto.userId = "u1"; contexto.organizationId = "org1";
  setAuthSnapshot({ userId: "u1", email: null, organizationId: "org1", organizationName: null, role: "operador", effectiveRole: "operador" });
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

describe("Revisar tarifario antes de enviar a Pricing", () => {
  it("guarda el borrador sin enviarlo a Pricing y cierra", async () => {
    render(<Harness />); completar(); enviar();
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledWith(false));
    expect(services.crearSolicitud).toHaveBeenCalledTimes(1);
    expect(services.enviarSolicitud).not.toHaveBeenCalled();
  });
  it("dos submits en el mismo turno hacen un solo INSERT", async () => {
    render(<Harness />); completar();
    act(() => { fireEvent.submit(form()); fireEvent.submit(form()); });
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledWith(false));
    expect(services.crearSolicitud).toHaveBeenCalledTimes(1);
  });

  it("un guardado rechazado conserva captura y archivos para reintentar sin enviar", async () => {
    services.crearSolicitud.mockRejectedValueOnce(new Error("sin conexión"));
    render(<Harness />); completar();
    const archivo = new File(["1"], "pendiente.pdf");
    fireEvent.change(screen.getByLabelText("Archivos"), { target: { files: [archivo] } });
    enviar();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Revisar tarifario" })).toBeEnabled());
    expect(screen.getByLabelText("Origen")).toHaveValue("Shanghai");
    expect(screen.getByText("pendiente.pdf")).toBeInTheDocument();
    expect(mocks.cambio).not.toHaveBeenCalled(); expect(mocks.subir).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Origen"), { target: { value: "Ningbo" } });
    enviar();
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledWith(false));
    expect(services.crearSolicitud).toHaveBeenCalledTimes(2);
    expect(services.crearSolicitud).toHaveBeenLastCalledWith(expect.objectContaining({ origen: "Ningbo" }));
    expect(mocks.subir).toHaveBeenCalledWith("org1", "s1", archivo);
    expect(services.enviarSolicitud).not.toHaveBeenCalled();
  });

  it("reintentar la edición fallida conserva el ID y no inserta otra solicitud", async () => {
    services.actualizarSolicitud.mockRejectedValueOnce(new Error("sin conexión"));
    render(<SesionHarness solicitud={borrador} />);
    fireEvent.change(screen.getByLabelText("Origen"), { target: { value: "Ningbo" } });
    enviar();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Revisar tarifario" })).toBeEnabled());
    enviar();
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledWith(false));
    expect(services.actualizarSolicitud.mock.calls.map(([id]) => id)).toEqual(["s1", "s1"]);
    expect(services.crearSolicitud).not.toHaveBeenCalled(); expect(services.enviarSolicitud).not.toHaveBeenCalled();
  });

  it("mantiene bloqueo de cierre y submits durante la subida secuencial de adjuntos", async () => {
    const primero = diferido<void>(); const segundo = diferido<void>();
    mocks.subir.mockReturnValueOnce(primero.promise).mockReturnValueOnce(segundo.promise);
    render(<Harness />); completar();
    const archivos = [new File(["1"], "uno.pdf"), new File(["2"], "dos.pdf")];
    fireEvent.change(screen.getByLabelText("Archivos"), { target: { files: archivos } });
    enviar();
    await waitFor(() => expect(mocks.subir).toHaveBeenCalledTimes(1));
    fireEvent.submit(form()); fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    expect(mocks.cambio).not.toHaveBeenCalled(); expect(services.crearSolicitud).toHaveBeenCalledTimes(1);
    await act(async () => primero.resolve());
    await waitFor(() => expect(mocks.subir).toHaveBeenCalledTimes(2));
    expect(mocks.subir.mock.calls).toEqual(archivos.map((f) => ["org1", "s1", f]));
    expect(mocks.cambio).not.toHaveBeenCalled();
    await act(async () => segundo.resolve());
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledTimes(1));
    expect(services.enviarSolicitud).not.toHaveBeenCalled();
  });

  it("informa el fallo de adjunto y conserva el borrador persistido sin enviarlo", async () => {
    mocks.subir.mockRejectedValueOnce(new Error("archivo rechazado"));
    render(<Harness />); completar();
    fireEvent.change(screen.getByLabelText("Archivos"), { target: { files: [new File(["1"], "uno.pdf"), new File(["2"], "dos.pdf")] } });
    enviar();
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledWith(false));
    expect(mocks.subir).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledWith(undefined, expect.objectContaining({ method: "CRM_PRICING_ADJUNTO" }));
    expect(client.getQueryData(keys.solicitud("s1"))).toMatchObject({ id: "s1", estado: "borrador" });
    expect(services.enviarSolicitud).not.toHaveBeenCalled();
  });

  it("reabrir el borrador guardado reutiliza su ID; Nueva solicitud inicia otra captura", async () => {
    render(<Harness />); completar(); enviar();
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Editar borrador" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Solicitud SP1");
    enviar();
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledTimes(2));
    expect(services.actualizarSolicitud).toHaveBeenCalledWith("s1", expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "Nueva solicitud" }));
    expect(screen.getByLabelText("Origen")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledTimes(3));
    expect(services.crearSolicitud).toHaveBeenCalledTimes(2); expect(services.enviarSolicitud).not.toHaveBeenCalled();
  });
});

describe("aislamiento de la revisión del tarifario", () => {
  const cambios = ["oportunidad", "organización", "usuario", "solicitud", "reapertura", "purga"] as const;
  function cambiar(cambio: typeof cambios[number]) {
    if (cambio === "organización") contexto.organizationId = "org2";
    if (cambio === "usuario") contexto.userId = "u2";
    if (cambio === "purga") purgeSessionCache(client);
  }
  it.each(cambios.flatMap((cambio) => [false, true].map((falla) => ({ cambio, falla }))))(
    "ignora el guardado anterior al cambiar $cambio (fallo=$falla)", async ({ cambio, falla }) => {
      const alta = diferido<SolicitudPricingRow>();
      services.crearSolicitud.mockReturnValueOnce(alta.promise);
      const view = render(<SesionHarness />); completar();
      fireEvent.change(screen.getByLabelText("Archivos"), { target: { files: [new File(["1"], "anterior.pdf")] } });
      enviar(); await waitFor(() => expect(services.crearSolicitud).toHaveBeenCalledTimes(1));
      act(() => cambiar(cambio));
      if (cambio === "reapertura") view.rerender(<SesionHarness open={false} />);
      const oportunidadId = cambio === "oportunidad" ? "o2" : "o1";
      const solicitud = cambio === "solicitud" ? { ...borrador, id: "s2" } : null;
      view.rerender(<SesionHarness oportunidadId={oportunidadId} solicitud={solicitud} />);
      completar(); fireEvent.change(screen.getByLabelText("Origen"), { target: { value: "Otra sesión" } });
      await act(async () => { if (falla) alta.reject(new Error("guardado anterior")); else alta.resolve(borrador); });
      expect(screen.getByLabelText("Origen")).toHaveValue("Otra sesión");
      expect(screen.queryByText("anterior.pdf")).not.toBeInTheDocument();
      expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-busy", "true");
      expect(mocks.cambio).not.toHaveBeenCalled(); expect(mocks.subir).not.toHaveBeenCalled();
      expect(mocks.success).not.toHaveBeenCalled(); expect(mocks.error).not.toHaveBeenCalled();
      expect(client.getQueryData(keys.solicitud("s1"))).toBeUndefined();
      enviar(); await waitFor(() => expect(mocks.cambio).toHaveBeenCalledWith(false));
      if (solicitud) expect(services.actualizarSolicitud).toHaveBeenCalledWith("s2", expect.objectContaining({ origen: "Otra sesión" }));
      else expect(services.crearSolicitud).toHaveBeenLastCalledWith(expect.objectContaining({ origen: "Otra sesión", oportunidad_id: oportunidadId, organization_id: contexto.organizationId }));
      expect(services.enviarSolicitud).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])("el finally antiguo no libera la operación nueva (fallo=%s)", async (falla) => {
    const vieja = diferido<SolicitudPricingRow>(); const nueva = diferido<SolicitudPricingRow>();
    services.crearSolicitud.mockReturnValueOnce(vieja.promise).mockReturnValueOnce(nueva.promise);
    const view = render(<SesionHarness />); completar(); enviar();
    await waitFor(() => expect(services.crearSolicitud).toHaveBeenCalledTimes(1));
    view.rerender(<SesionHarness oportunidadId="o2" />); completar(); enviar();
    await waitFor(() => expect(services.crearSolicitud).toHaveBeenCalledTimes(2));
    await act(async () => { if (falla) vieja.reject(new Error("anterior")); else vieja.resolve(borrador); });
    fireEvent.submit(form()); fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    expect(services.crearSolicitud).toHaveBeenCalledTimes(2); expect(mocks.cambio).not.toHaveBeenCalled();
    await act(async () => nueva.resolve({ ...borrador, id: "s2", oportunidad_id: "o2" }));
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledTimes(1));
    expect(services.enviarSolicitud).not.toHaveBeenCalled();
  });

  it.each((["oportunidad", "usuario", "purga"] as const).flatMap((cambio) => [false, true].map((falla) => ({ cambio, falla }))))(
    "detiene adjuntos al cambiar $cambio (fallo=$falla)", async ({ cambio, falla }) => {
      const adjunto = diferido<void>(); mocks.subir.mockReturnValueOnce(adjunto.promise);
      const view = render(<SesionHarness />); completar();
      fireEvent.change(screen.getByLabelText("Archivos"), { target: { files: [new File(["1"], "uno.pdf"), new File(["2"], "dos.pdf")] } });
      enviar(); await waitFor(() => expect(mocks.subir).toHaveBeenCalledTimes(1));
      act(() => cambiar(cambio));
      view.rerender(<SesionHarness oportunidadId={cambio === "oportunidad" ? "o2" : "o1"} />);
      completar(); fireEvent.change(screen.getByLabelText("Origen"), { target: { value: "Nueva captura" } });
      await act(async () => { if (falla) adjunto.reject(new Error("anterior")); else adjunto.resolve(); });
      expect(mocks.subir).toHaveBeenCalledTimes(1); expect(mocks.error).not.toHaveBeenCalled(); expect(mocks.cambio).not.toHaveBeenCalled();
      expect(screen.getByLabelText("Origen")).toHaveValue("Nueva captura");
      expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-busy", "true");
    },
  );
  it.each(["oportunidad", "organización"] as const)("rechaza una solicitud incompatible por %s", async (cambio) => {
    const view = render(<SesionHarness solicitud={borrador} />);
    act(() => cambiar(cambio));
    view.rerender(<SesionHarness solicitud={borrador} oportunidadId={cambio === "oportunidad" ? "o2" : "o1"} />);
    expect(screen.getByLabelText("Origen")).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(mocks.cambio).toHaveBeenCalledWith(false));
    expect(services.actualizarSolicitud).not.toHaveBeenCalled(); expect(services.crearSolicitud).toHaveBeenCalledTimes(1);
  });
});
