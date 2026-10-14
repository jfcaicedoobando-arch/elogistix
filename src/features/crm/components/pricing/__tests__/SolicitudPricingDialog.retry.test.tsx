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
function enviar() { fireEvent.click(screen.getByRole("button", { name: "Revisar tarifario" })); }
function form() { return screen.getByLabelText("Servicio").closest("form")!; }
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
});
