import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const mock = await vi.hoisted(async () => {
  const { createSimpleFilteredReadMock } = await import("@/services/__tests__/_simpleFilteredReadMock"); return createSimpleFilteredReadMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/ui/appFeedback")>(), notifySuccess: vi.fn(), notifyError: vi.fn() }));
import { useContactosCliente, useDeleteContacto } from "../useClientes";
const contacto = (id: string, nombre: string, deleted_at: string | null = null) => ({
  id, nombre, deleted_at, cliente_id: "cli-test", tipo: "Exportador", pais: "MEX", contacto: "Contacto ficticio", rfc: null,
  telefono: null, email: "fixture@example.invalid", direccion: "", ciudad: "", organization_id: "org-test",
  created_at: "2026-10-01", updated_at: "2026-10-01", deleted_by: null,
});
let rows: ReturnType<typeof contacto>[];
const rpc = mock.supabase.rpc.getMockImplementation()!;
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  (globalThis as unknown as { __TEST_QUERY_CLIENT__?: QueryClient }).__TEST_QUERY_CLIENT__ = client;
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
}
beforeEach(() => {
  mock.reset(); rows = [contacto("eliminar", "Alfa eliminar"), contacto("conservar", "Zeta conservar")];
  mock.source("contactos_cliente", rows);
  mock.supabase.rpc.mockImplementation(async (fn, args) => {
    const result = await rpc(fn, args);
    if (fn === "soft_delete_record" && args && typeof args === "object" && "_id" in args) {
      rows = rows.map(row => row.id === args._id ? { ...row, deleted_at: "2026-10-01" } : row);
      mock.source("contactos_cliente", rows);
    }
    return result;
  });
});
describe("cliente/contactos: lista editable e invalidación tras baja", () => {
  it("la query de lista para edición recibe sólo contactos vivos", async () => {
    rows.push(contacto("anterior-baja", "Contacto eliminado", "2026-10-01")); mock.source("contactos_cliente", rows);
    const { result } = renderHook(() => useContactosCliente("cli-test"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map(row => row.id)).toEqual(["eliminar", "conservar"]);
  });
  it("baja, invalidación y nuevo refetch no hacen reaparecer la fila conservada en papelera", async () => {
    const { result } = renderHook(() => ({ lista: useContactosCliente("cli-test"), eliminar: useDeleteContacto() }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.lista.data?.map(row => row.id)).toEqual(["eliminar", "conservar"]));
    await act(async () => { await result.current.eliminar.mutateAsync({ id: "eliminar", cliente_id: "cli-test" }); });
    await waitFor(() => expect(result.current.lista.data?.map(row => row.id)).toEqual(["conservar"]));
    expect(rows.find(row => row.id === "eliminar")?.deleted_at).toBe("2026-10-01");
    expect(mock.rpcCalls).toContainEqual({ fn: "soft_delete_record", args: { _table: "contactos_cliente", _id: "eliminar" } });
    await act(async () => { await result.current.lista.refetch(); });
    expect(result.current.lista.data?.map(row => row.id)).toEqual(["conservar"]); expect(mock.tableCalls.length).toBeGreaterThanOrEqual(3);
  });
});
