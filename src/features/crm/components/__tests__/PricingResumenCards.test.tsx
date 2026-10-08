import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PricingResumenCards } from "../PricingResumenCards";
import { crm } from "../../queryKeys";
import type { ResumenPricing } from "../../services/pricing/resumenPricing";

const mocks = vi.hoisted(() => ({ org: "org-a" as string | null, user: "user-a" as string | null, loading: false, read: vi.fn() }));
vi.mock("@/lib/contexts/OrganizationContext", () => ({ useOrganization: () => ({ organizationId: mocks.org, loading: mocks.loading }) }));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ user: mocks.user ? { id: mocks.user } : null, loading: false }) }));
vi.mock("../../services/pricing/resumenPricing", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../services/pricing/resumenPricing")>(), obtenerResumenPricing: mocks.read,
}));
const resumen = (total: number): ResumenPricing => ({
  porEstado: [{ estado: "enviada", etiqueta: "Por responder", cantidad: total }], total,
  horasPromedioRespuesta: null, respondidas: 0, respondidasATiempo: 0,
});
let client: QueryClient;
const view = () => <QueryClientProvider client={client}><PricingResumenCards /></QueryClientProvider>;
beforeEach(() => {
  mocks.org = "org-a"; mocks.user = "user-a"; mocks.loading = false;
  mocks.read.mockReset().mockResolvedValue(resumen(11));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); });

describe("PricingResumenCards: aislamiento de lectura y recuperación", () => {
  it("cambiar de empresa oculta el resumen anterior y resuelve en otra clave", async () => {
    const { rerender } = render(view());
    await screen.findByText("Total: 11 solicitudes (sin borradores).");
    let resolver!: (value: ResumenPricing) => void;
    mocks.read.mockImplementationOnce(() => new Promise<ResumenPricing>((resolve) => { resolver = resolve; }));
    mocks.org = "org-b"; rerender(view());
    expect(screen.queryByText("Total: 11 solicitudes (sin borradores).")).toBeNull();
    await waitFor(() => expect(mocks.read).toHaveBeenCalledWith("org-b"));
    await act(async () => { resolver(resumen(22)); });
    await screen.findByText("Total: 22 solicitudes (sin borradores).");
    expect(client.getQueryData(crm.resumenPricing("org-a", "user-a"))).toEqual(resumen(11));
    expect(client.getQueryData(crm.resumenPricing("org-b", "user-a"))).toEqual(resumen(22));
  });
  it("cambiar de cuenta en la misma empresa no reutiliza el resumen de otra cuenta", async () => {
    const { rerender } = render(view());
    await screen.findByText("Total: 11 solicitudes (sin borradores).");
    mocks.read.mockResolvedValueOnce(resumen(33));
    mocks.user = "user-b"; rerender(view());
    expect(screen.queryByText("Total: 11 solicitudes (sin borradores).")).toBeNull();
    await screen.findByText("Total: 33 solicitudes (sin borradores).");
    expect(mocks.read).toHaveBeenCalledTimes(2);
  });
  it("no consulta sin empresa, sin usuario o mientras se resuelve la organización", async () => {
    mocks.org = null;
    const { rerender } = render(view());
    await act(async () => {});
    expect(mocks.read).not.toHaveBeenCalled();
    mocks.org = "org-a"; mocks.user = null; rerender(view());
    await act(async () => {});
    expect(mocks.read).not.toHaveBeenCalled();
    mocks.user = "user-a"; mocks.loading = true; rerender(view());
    await act(async () => {});
    expect(mocks.read).not.toHaveBeenCalled();
    mocks.loading = false; rerender(view());
    await screen.findByText("Total: 11 solicitudes (sin borradores).");
  });
  it("distingue error de vacío y permite recargar sin cambiar de empresa", async () => {
    mocks.read.mockRejectedValueOnce(new Error("red interrumpida"));
    render(view());
    await screen.findAllByText("No se pudo cargar el resumen de pricing.");
    expect(screen.queryByText("Sin solicitudes de pricing aún.")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Reintentar" })[0]);
    await screen.findByText("Total: 11 solicitudes (sin borradores).");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mocks.read).toHaveBeenCalledTimes(2);
    expect(mocks.read).toHaveBeenLastCalledWith("org-a");
  });
  it("un error al recargar datos existentes no presenta cifras viejas como vigentes", async () => {
    render(view());
    await screen.findByText("Total: 11 solicitudes (sin borradores).");
    mocks.read.mockRejectedValueOnce(new Error("no disponible"));
    await act(async () => { await client.invalidateQueries({ queryKey: crm.resumenPricing("org-a", "user-a") }); });
    await screen.findAllByText("No se pudo cargar el resumen de pricing.");
    expect(screen.queryByText("Total: 11 solicitudes (sin borradores).")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Reintentar" })[0]);
    await screen.findByText("Total: 11 solicitudes (sin borradores).");
  });
  it("un resumen vacío exitoso conserva ambos estados vacíos", async () => {
    mocks.read.mockResolvedValue(resumen(0));
    render(view());
    await screen.findByText("Sin solicitudes de pricing aún.");
    expect(screen.getByText("Aún no hay solicitudes respondidas.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
