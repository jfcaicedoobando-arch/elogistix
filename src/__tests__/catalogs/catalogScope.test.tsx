import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const io = vi.hoisted(() => ({ planes: vi.fn(), ports: vi.fn(), lines: vi.fn(), containers: vi.fn(), dof: vi.fn() }));
vi.mock("@/features/admin/services/planes", () => ({ fetchPlanes: io.planes, updatePlan: vi.fn() }));
vi.mock("@/features/catalogos/services/tipoCambioDof", () => ({ fetchHistorialTcDof: io.dof, upsertTcDofManual: vi.fn() }));
vi.mock("@/features/catalogos/services", () => ({
  fetchPuertos: io.ports, insertPuerto: vi.fn(), setPuertoActivo: vi.fn(), deletePuerto: vi.fn(),
  fetchNavieras: io.lines, insertNaviera: vi.fn(), updateNaviera: vi.fn(), setNavieraActivo: vi.fn(), deleteNaviera: vi.fn(),
  fetchTiposContenedor: io.containers, insertTipoContenedor: vi.fn(), setTipoContenedorActivo: vi.fn(), deleteTipoContenedor: vi.fn(),
}));
vi.mock("@/lib/query", async () => ({ queryKeys: {
  ...(await import("@/features/catalogos/queryKeys")), ...(await import("@/features/admin/queryKeys")),
} }));
vi.mock("@/hooks/shared", () => ({ useMutationWithFeedback: vi.fn() }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));
vi.mock("@/lib/errors", () => ({ getErrorMessage: vi.fn() }));
vi.mock("@/lib/diagnostics/errorDetailsStore", () => ({ clearErrorReports: vi.fn() }));

import { usePlanes } from "@/features/admin/hooks/usePlanes";
import { useAllPuertos } from "@/features/catalogos/hooks/usePuertos";
import { useAllNavieras } from "@/features/catalogos/hooks/useNavieras";
import { useAllTiposContenedor } from "@/features/catalogos/hooks/useTiposContenedor";
import { useHistorialTcDof } from "@/features/catalogos/hooks/useTipoCambioDof";
import { setAuthSnapshot, syncAuthSessionUser } from "@/lib/auth/authSnapshot";

const row = (id: string) => ({ id, activo: true, nombre: id, name: id, code: id,
  max_usuarios: 1, max_embarques_mes: 1, almacenamiento_mb: 0, precio_mensual: 1, created_at: "2026-10-13",
  fecha: "2026-10-13", usd_mxn: 18, eur_mxn: null, fuente: "mock", origen: "manual", updated_at: "2026-10-13" });
const oldRow = row("old-scope");
const newRow = row("new-scope");
let client: QueryClient;
function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function authenticate(userId = "shared", role = "super_admin", organizationId = "org-a") {
  setAuthSnapshot({ userId, email: null, role, effectiveRole: role, organizationId, organizationName: null });
}
const catalogs = [
  { name: "planes", hook: usePlanes, fetch: io.planes },
  { name: "puertos", hook: useAllPuertos, fetch: io.ports },
  { name: "navieras", hook: useAllNavieras, fetch: io.lines },
  { name: "tipos_contenedor", hook: useAllTiposContenedor, fetch: io.containers },
  { name: "tipos_cambio_dof", hook: useHistorialTcDof, fetch: io.dof },
];
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, placeholderData: keepPreviousData } } });
  for (const fetch of Object.values(io)) fetch.mockReset().mockResolvedValue([oldRow]);
  authenticate();
});
afterEach(() => { cleanup(); client.clear(); });

describe.each(catalogs)("$name session isolation", ({ name, hook, fetch }) => {
  it("does not read while auth is absent, including manual refetch", async () => {
    setAuthSnapshot({ userId: null, email: null, role: null, effectiveRole: null, organizationId: null, organizationName: null });
    const { result } = renderHook(() => hook(), { wrapper: Wrapper });
    await act(async () => { await result.current.refetch(); });
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });
  it("does not keep previous rows while another tenant is loading", async () => {
    const { result } = renderHook(() => hook(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toEqual([oldRow]));
    let resolve!: (data: typeof oldRow[]) => void;
    fetch.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    await act(async () => authenticate("shared", "super_admin", "org-b"));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(result.current.data).toBeUndefined();
    await act(async () => resolve([newRow]));
    await waitFor(() => expect(result.current.data).toEqual([newRow]));
    expect(client.getQueriesData({ queryKey: [name] }).flatMap(([, data]) => data ?? [])).not.toContainEqual(oldRow);
  });
  it("rejects late rows after a role change and preserves other domain caches", async () => {
    let resolve!: (data: typeof oldRow[]) => void;
    fetch.mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValue([newRow]);
    const { result } = renderHook(() => hook(), { wrapper: Wrapper });
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    client.setQueryData(["unrelated-audit-domain"], "keep");
    await act(async () => authenticate("shared", "operador"));
    await waitFor(() => expect(result.current.data).toEqual([newRow]));
    await act(async () => resolve([oldRow]));
    expect(result.current.data).toEqual([newRow]);
    expect(client.getQueriesData({ queryKey: [name] }).flatMap(([, data]) => data ?? [])).not.toContainEqual(oldRow);
    expect(client.getQueryData(["unrelated-audit-domain"])).toBe("keep");
  });
  it("a new session for the same user refreshes and discards prior rows", async () => {
    syncAuthSessionUser("shared", "session-a");
    const { result } = renderHook(() => hook(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toEqual([oldRow]));
    fetch.mockResolvedValue([newRow]);
    await act(async () => syncAuthSessionUser("shared", "session-b"));
    await waitFor(() => expect(result.current.data).toEqual([newRow]));
    expect(client.getQueriesData({ queryKey: [name] }).flatMap(([, data]) => data ?? [])).not.toContainEqual(oldRow);
  });
});

it("ordinary plan reads discard inactive rows even if the service returns them", async () => {
  authenticate("shared", "operador");
  io.planes.mockResolvedValue([oldRow, { ...newRow, activo: false }]);
  const { result } = renderHook(usePlanes, { wrapper: Wrapper });
  await waitFor(() => expect(result.current.data).toEqual([oldRow]));
  expect(client.getQueriesData({ queryKey: ["planes"] }).flatMap(([, data]) => data ?? []))
    .not.toContainEqual({ ...newRow, activo: false });
});
