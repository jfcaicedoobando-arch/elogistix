import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SolicitudPricingRow } from "@/features/crm/services/pricing/tiposPricing";

const services = vi.hoisted(() => ({ enviarSolicitud: vi.fn() }));
vi.mock("@/features/crm/services/pricing/pricingCrm", () => services);
vi.mock("@/features/crm/services/pricing/tarifasParaPricing", () => ({ listarTarifasParaPricing: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
import { EnviarSolicitudFinal } from "../EnviarSolicitudFinal";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { purgeSessionCache } from "@/lib/auth/purgeSessionCache";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

const solicitud: SolicitudPricingRow = {
  id: "s1", organization_id: "org1", oportunidad_id: "o1", solicitante_id: "u1", created_by: "u1",
  estado: "borrador", folio: "SP1", fecha: "2026-10-08", complejidad: "media", created_at: "", updated_at: "",
  cantidad: null, cliente: null, commodity: null, container_size: null, deleted_at: null, delivery: null,
  destino: "Manzanillo", dimensiones: null, enviada_at: null, estibable: null, fecha_tentativa_carga: null,
  imo: null, incoterm: null, notas: null, origen: "Shanghai", peso: null, pod: null, pol: null,
  respondida_at: null, servicio: "Marítimo", tipo_carga: null, unidad_medida: null, vence_at: null, tarifa_tarifario_id: null,
};
const auth = { userId: "u1", email: null, organizationId: "org1", organizationName: null, role: "operador", effectiveRole: "operador" };
function diferido() {
  let resolve!: () => void; let reject!: (error: Error) => void;
  const promise = new Promise<void>((si, no) => { resolve = si; reject = no; });
  return { promise, resolve, reject };
}
let client: QueryClient;
function Vista({ fila = solicitud, puede = true }: { fila?: SolicitudPricingRow; puede?: boolean }) {
  return <QueryClientProvider client={client}><EnviarSolicitudFinal solicitud={fila} puede={puede} /></QueryClientProvider>;
}
beforeEach(() => {
  setAuthSnapshot(auth);
  services.enviarSolicitud.mockReset().mockResolvedValue(undefined);
  vi.mocked(notifySuccess).mockClear(); vi.mocked(notifyError).mockClear();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No se permite red real"); }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); });

describe("envío final después de revisar tarifario", () => {
  it("dos clics en el mismo turno producen un solo envío y permiten reintentar tras fallo", async () => {
    const envio = diferido();
    services.enviarSolicitud.mockReturnValueOnce(envio.promise);
    render(<Vista />);
    const boton = screen.getByRole("button", { name: "Enviar a Pricing" });
    act(() => { boton.click(); boton.click(); });
    await waitFor(() => expect(services.enviarSolicitud).toHaveBeenCalledTimes(1));
    await act(async () => envio.reject(new Error("sin conexión")));
    await waitFor(() => expect(boton).toBeEnabled());
    fireEvent.click(boton);
    await waitFor(() => expect(services.enviarSolicitud).toHaveBeenCalledTimes(2));
    expect(services.enviarSolicitud.mock.calls).toEqual([["s1"], ["s1"]]);
  });

  it.each([false, true])("el resultado de otra solicitud no modifica la vista nueva (fallo=%s)", async (falla) => {
    const anterior = diferido(); const actual = diferido();
    services.enviarSolicitud.mockReturnValueOnce(anterior.promise).mockReturnValueOnce(actual.promise);
    const invalidar = vi.spyOn(client, "invalidateQueries");
    const view = render(<Vista />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar a Pricing" }));
    await waitFor(() => expect(services.enviarSolicitud).toHaveBeenCalledTimes(1));
    view.rerender(<Vista fila={{ ...solicitud, id: "s2" }} />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar a Pricing" }));
    await waitFor(() => expect(services.enviarSolicitud).toHaveBeenCalledTimes(2));
    await act(async () => { if (falla) anterior.reject(new Error("anterior")); else anterior.resolve(); });
    expect(screen.getByRole("button", { name: "Enviar a Pricing" })).toBeDisabled();
    expect(invalidar).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled(); expect(notifyError).not.toHaveBeenCalled();
    await act(async () => actual.resolve());
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledTimes(1));
  });

  it.each(["usuario", "purga"])("revoca el envío pendiente al cambiar %s y libera la nueva vista", async (cambio) => {
    const envio = diferido();
    services.enviarSolicitud.mockReturnValueOnce(envio.promise);
    const invalidar = vi.spyOn(client, "invalidateQueries");
    render(<Vista />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar a Pricing" }));
    await waitFor(() => expect(services.enviarSolicitud).toHaveBeenCalledTimes(1));
    await act(async () => { if (cambio === "usuario") setAuthSnapshot({ ...auth, userId: "u2" }); else purgeSessionCache(client); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviar a Pricing" })).toBeEnabled());
    await act(async () => envio.resolve());
    expect(invalidar).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled(); expect(notifyError).not.toHaveBeenCalled();
  });

  it.each(["enviada", "respondida", "cancelada"])("no ofrece enviar una solicitud %s", (estado) => {
    render(<Vista fila={{ ...solicitud, estado }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("respeta la capacidad existente de envío", () => {
    render(<Vista puede={false} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
