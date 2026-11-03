import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps, ReactNode } from "react";

const state = vi.hoisted(() => ({
  auth: { user: { id: "actor-a" }, effectiveRole: "admin_org", loading: false },
  organization: { organizationId: "org-a", loading: false }, canDelete: true,
  fetch: vi.fn(), remove: vi.fn(), activity: vi.fn(), navigate: vi.fn(), success: vi.fn(),
  confirmCallback: undefined as undefined | (() => void | boolean | Promise<void | boolean>),
}));
vi.mock("@/components/shared/DoubleConfirmDeleteDialog", async (original) => {
  const { default: RealDialog } = await original<typeof import("@/components/shared/DoubleConfirmDeleteDialog")>();
  return { default: (props: ComponentProps<typeof RealDialog>) => {
    state.confirmCallback = props.onConfirm;
    return <RealDialog {...props} />;
  } };
});
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/lib/contexts/OrganizationContext", () => ({ useOrganization: () => state.organization }));
vi.mock("@/hooks/shared/usePermissions", () => ({ usePermissions: () => ({ canEliminarEmbarque: state.canDelete }) }));
vi.mock("@/features/embarques/services/dependenciasFinancieras", async (original) => ({
  ...await original<typeof import("../../services/dependenciasFinancieras")>(), fetchEmbarqueDependenciasFinancieras: (...args: unknown[]) => state.fetch(...args),
}));
vi.mock("@/features/embarques/hooks", async () => ({
  useEmbarqueDependenciasFinancieras: (await import("../../hooks/useEmbarqueDependenciasFinancieras")).useEmbarqueDependenciasFinancieras,
  useEliminarEmbarque: () => ({ mutateAsync: state.remove, isPending: false }),
}));
vi.mock("@/features/embarques/services", async () => ({ EmbarqueBloqueadoError: (await import("../../services/embarqueBloqueadoError")).EmbarqueBloqueadoError }));
vi.mock("@/hooks/shared", () => ({ useRegistrarActividad: () => ({ mutate: state.activity }) }));
vi.mock("react-router", () => ({ useNavigate: () => state.navigate }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: (...args: unknown[]) => state.success(...args) }));

import DialogEliminarEmbarque from "../DialogEliminarEmbarque";
import type { EmbarqueRow } from "../../hooks";
import { EmbarqueBloqueadoError } from "../../services/embarqueBloqueadoError";
import { diagnosticoADependencias } from "../../services/dependenciasFinancieras";
import { diagnosticoBaja, EMBARQUE_ID, OTRO_EMBARQUE_ID, FACTURA_ID } from "../../services/__tests__/fixtures/diagnosticoBaja.fixture";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
import { resetSessionCaches } from "@/lib/auth/sessionCacheRegistry";

const clear = () => diagnosticoADependencias(diagnosticoBaja());
const shipment = { id: EMBARQUE_ID, expediente: "H14-FICTICIO", cliente_nombre: "Cliente ficticio", modo: "Aéreo", tipo: "Importación" } as EmbarqueRow;
const clients: QueryClient[] = [];
function context(organizationId = "org-a", role = "admin_org") {
  state.auth = { user: { id: "actor-a" }, effectiveRole: role, loading: false };
  state.organization = { organizationId, loading: false };
  setAuthSnapshot({ userId: "actor-a", organizationId, effectiveRole: role, role, email: null, organizationName: null });
  syncActiveOrganizationScope({ userId: "actor-a", organizationId });
}
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const close = vi.fn();
  return { close, ...render(<DialogEliminarEmbarque embarque={shipment} open onOpenChange={close} />, { wrapper }) };
}
async function confirm() {
  fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
  fireEvent.change(screen.getByPlaceholderText("ELIMINAR"), { target: { value: "ELIMINAR" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar a la papelera" }));
}
beforeEach(() => { vi.clearAllMocks(); context(); state.canDelete = true; state.fetch.mockResolvedValue(clear()); state.remove.mockResolvedValue(undefined); });
afterEach(async () => { for (const client of clients.splice(0)) { await client.cancelQueries(); client.clear(); } });

describe("baja con diagnóstico autorizado y confirmación vigente", () => {
  it("oculta una respuesta vacía cacheada mientras vuelve a verificar al reabrir, incluso si falla", async () => {
    const { close, rerender } = setup(); await screen.findByRole("button", { name: "Continuar" });
    rerender(<DialogEliminarEmbarque embarque={shipment} open={false} onOpenChange={close} />);
    const next = deferred<ReturnType<typeof clear>>(); state.fetch.mockReturnValueOnce(next.promise);
    rerender(<DialogEliminarEmbarque embarque={shipment} open onOpenChange={close} />);
    expect(screen.getByRole("status")).toHaveTextContent("Verificando");
    expect(screen.queryByRole("button", { name: "Continuar" })).not.toBeInTheDocument();
    await act(async () => { next.reject(new Error("denied")); });
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos completar");
    expect(state.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Volver a verificar" }));
    await screen.findByRole("button", { name: "Continuar" });
  });

  it("no consulta ni confirma cuando la capacidad de baja dejó de estar disponible", () => {
    state.canDelete = false; setup();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(state.fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Continuar" })).not.toBeInTheDocument();
  });

  it("mantiene abierto el rechazo final y muestra cierre, comisiones y total separado de ejemplos", async () => {
    state.remove.mockRejectedValue(new EmbarqueBloqueadoError(diagnosticoBaja({ bloqueado: true, cerrado: true,
      comisiones_definitivas: 1, facturas: 21, ejemplos_cxc: [{ id: FACTURA_ID, folio: "F-FICTICIA", estado: "Borrador" }] })));
    const { close } = setup(); await confirm();
    expect(await screen.findByText("El embarque está cerrado.")).toBeInTheDocument();
    expect(screen.getByText(/Comisiones definitivas/)).toHaveTextContent("1");
    expect(screen.getByText("Facturas a clientes (CxC): 21")).toBeInTheDocument();
    expect(screen.getByText("Se muestran 1 de 21 facturas. El conteo incluye todas.")).toBeInTheDocument();
    expect(close).not.toHaveBeenCalledWith(false);
    expect(state.activity).not.toHaveBeenCalled();
  });

  it.each(["55P03", "25001"])("el error %s exige otra verificación manual; nunca reintenta la mutación", async (code) => {
    state.remove.mockRejectedValue({ code, message: "rechazo controlado" }); setup(); await confirm();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Otra operación|No se completó/);
    expect(state.remove).toHaveBeenCalledTimes(1);
    const next = deferred<ReturnType<typeof clear>>(); state.fetch.mockReturnValueOnce(next.promise);
    fireEvent.click(screen.getByRole("button", { name: "Volver a verificar" }));
    expect(screen.queryByRole("button", { name: "Continuar" })).not.toBeInTheDocument();
    await act(async () => { next.resolve(clear()); });
    expect(await screen.findByRole("button", { name: "Continuar" })).toBeInTheDocument();
    expect(state.remove).toHaveBeenCalledTimes(1);
  });

  it.each(["empresa", "rol"])("descarta el rechazo tardío y reinicia confirmación al cambiar %s", async (change) => {
    const mutation = deferred<void>(); state.remove.mockReturnValueOnce(mutation.promise);
    const { close, rerender } = setup(); await confirm();
    await act(async () => { context(change === "empresa" ? "org-b" : "org-a", change === "rol" ? "coordinador_logistico" : "admin_org"); });
    rerender(<DialogEliminarEmbarque embarque={shipment} open onOpenChange={close} />);
    await act(async () => { mutation.reject(new EmbarqueBloqueadoError(diagnosticoBaja({ bloqueado: true, cerrado: true }))); });
    expect(await screen.findByRole("button", { name: "Continuar" })).toBeInTheDocument();
    expect(screen.queryByText("El embarque está cerrado.")).not.toBeInTheDocument();
    expect(close).not.toHaveBeenCalledWith(false);
    expect(state.activity).not.toHaveBeenCalled();
  });

  it("no navega, notifica ni registra actividad por un éxito tardío después de cambiar empresa", async () => {
    const mutation = deferred<void>(); state.remove.mockReturnValueOnce(mutation.promise);
    const { close, rerender } = setup(); await confirm();
    fireEvent.click(screen.getByRole("button", { name: "Enviar a la papelera" }));
    expect(state.remove).toHaveBeenCalledTimes(1);
    await act(async () => { context("org-b"); });
    rerender(<DialogEliminarEmbarque embarque={shipment} open onOpenChange={close} />);
    await act(async () => { mutation.resolve(); });
    await screen.findByRole("button", { name: "Continuar" });
    expect(state.activity).not.toHaveBeenCalled(); expect(state.success).not.toHaveBeenCalled();
    expect(state.navigate).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalledWith(false);
  });

  it("reinicia el segundo paso al cambiar embarque o generación de sesión", async () => {
    const { close, rerender } = setup(); fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByPlaceholderText("ELIMINAR"), { target: { value: "ELIMINAR" } });
    await act(async () => { resetSessionCaches(); });
    await screen.findByRole("button", { name: "Continuar" });
    rerender(<DialogEliminarEmbarque embarque={{ ...shipment, id: OTRO_EMBARQUE_ID }} open onOpenChange={close} />);
    await screen.findByRole("button", { name: "Continuar" });
    expect(screen.queryByPlaceholderText("ELIMINAR")).not.toBeInTheDocument();
    expect(state.remove).not.toHaveBeenCalled();
  });

  it.each(["reabrir", "otro embarque"])("suprime la continuación de la instancia anterior al %s", async (change) => {
    const mutation = deferred<void>(); state.remove.mockReturnValueOnce(mutation.promise);
    const { close, rerender } = setup(); await confirm();
    if (change === "reabrir") {
      rerender(<DialogEliminarEmbarque embarque={shipment} open={false} onOpenChange={close} />);
      rerender(<DialogEliminarEmbarque embarque={shipment} open onOpenChange={close} />);
    } else rerender(<DialogEliminarEmbarque embarque={{ ...shipment, id: OTRO_EMBARQUE_ID }} open onOpenChange={close} />);
    await act(async () => { mutation.resolve(); });
    await screen.findByRole("button", { name: "Continuar" });
    expect(state.navigate).not.toHaveBeenCalled(); expect(state.success).not.toHaveBeenCalled();
    expect(state.activity).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalledWith(false);
  });


  it("no envía la baja desde un callback SA antiguo tras cambiar empresa sin rerender explícito", async () => {
    context("org-a", "super_admin");
    const { close } = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
    fireEvent.change(screen.getByPlaceholderText("ELIMINAR"), { target: { value: "ELIMINAR" } });
    const confirmarAnterior = state.confirmCallback;
    expect(confirmarAnterior).toBeTypeOf("function");
    await act(async () => {
      // Change the authoritative snapshots before React replaces the old callback.
      // The real dialog stays mounted; no explicit rerender is called here.
      setAuthSnapshot({ userId: "actor-a", organizationId: null, role: "super_admin", effectiveRole: "super_admin", email: null, organizationName: null });
      syncActiveOrganizationScope({ userId: "actor-a", organizationId: "org-b" });
      await confirmarAnterior?.();
    });
    expect(state.remove).not.toHaveBeenCalled();
    expect(state.activity).not.toHaveBeenCalled(); expect(state.success).not.toHaveBeenCalled();
    expect(state.navigate).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalledWith(false);
  });

});
