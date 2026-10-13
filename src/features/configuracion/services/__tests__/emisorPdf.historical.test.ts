import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { createHistoricalReadMock } from "@/test/helpers/historicalReadMock";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";

const h = vi.hoisted(() => ({ current: null as ReturnType<typeof createHistoricalReadMock> | null }));
vi.mock("@/integrations/supabase/client", () => ({ get supabase() { return h.current!.supabase; } }));
import { invalidarEmisorCache } from "../emisor";
import { fetchEmisorEntidad } from "../emisorPdf";

const tables = ["proveedores", "cuentas_bancarias", "proveedor_facturas"] as const;
const deletedAt = "2026-09-10T12:00:00.000Z";
function useScope(organizationId: string | null, userId = "synthetic-user", role = "super_admin") {
  setAuthSnapshot({ userId, email: null, organizationId: role === "super_admin" ? null : organizationId,
    organizationName: "Perfil no utilizable como emisor", role, effectiveRole: role });
  syncActiveOrganizationScope({ userId, organizationId });
}
function fiscal(nombre: string, rfc: string) {
  return [{ clave: "nombre", valor: nombre }, { clave: "rfc", valor: rfc }]
    .map((row) => ({ ...row, organization_id: "org-a", categoria: "empresa" }));
}

beforeEach(() => {
  invalidarEmisorCache();
  h.current = createHistoricalReadMock();
  useScope("org-a");
  h.current.tables.organizations = [{ id: "org-a", nombre: "Comercial A" }];
  h.current.tables.configuracion = fiscal("Fiscal A", "RFC-SINTETICO-A");
  for (const table of tables) h.current.tables[table] = [
    { id: "entidad-a", organization_id: "org-a", deleted_at: deletedAt },
    { id: "entidad-b", organization_id: "org-b", deleted_at: deletedAt },
  ];
});

describe("identidad PDF histórica: pertenencia persistida bajo el ámbito actual", () => {
  it("mantiene cerrada la unión de entidades admitidas", () => {
    expectTypeOf<Parameters<typeof fetchEmisorEntidad>[0]>().toEqualTypeOf<
      "proveedores" | "cuentas_bancarias" | "proveedor_facturas"
    >();
    expect(tables).toHaveLength(3);
  });

  it.each(tables.flatMap((table) => [null, deletedAt].map((deleted_at) => ({ table, deleted_at }))))(
    "$table con deleted_at=$deleted_at identifica sin leer contenido operativo",
    async ({ table, deleted_at }) => {
      h.current!.tables[table][0].deleted_at = deleted_at;
      const identity = await fetchEmisorEntidad(table, "entidad-a");
      expect(identity).toMatchObject({ organizacionNombre: "Comercial A", razonSocial: "Fiscal A", rfc: "RFC-SINTETICO-A" });
      expect(h.current!.calls[0]).toEqual({ table, columns: "id, organization_id", filters: [
        { method: "eq", column: "id", value: "entidad-a" },
        { method: "eq", column: "organization_id", value: "org-a" },
      ] });
      expect(identity).not.toHaveProperty("deleted_at");
      expect(h.current!.supabase.rpc).toHaveBeenCalledWith("org_scope");
    },
  );

  it.each([
    { id: "entidad-a", organization_id: "org-b" },
    { id: "otra-entidad", organization_id: "org-a" },
    { id: "entidad-a" },
    { organization_id: "org-a" },
  ])("rechaza respuesta inválida %j antes de cargar emisor", async (data) => {
    h.current!.responses.set("proveedores", { data, error: null });
    await expect(fetchEmisorEntidad("proveedores", "entidad-a")).rejects.toThrow("no coincide");
    expect(h.current!.calls.map((c) => c.table)).toEqual(["proveedores"]);
    expect(h.current!.supabase.rpc).not.toHaveBeenCalled();
  });

  it.each(["ausente", "invisible"])("rechaza identidad %s sin inferir la causa ni reemplazarla por la sesión", async (condition) => {
    if (condition === "ausente") h.current!.tables.proveedores = [];
    else h.current!.setVisible((table) => table !== "proveedores");
    await expect(fetchEmisorEntidad("proveedores", "entidad-a")).rejects.toThrow("no coincide");
    expect(h.current!.calls.map((c) => c.table)).toEqual(["proveedores"]);
    expect(h.current!.supabase.rpc).not.toHaveBeenCalled();
  });

  it("propaga permiso denegado sin reintentos, RPC ni lectura fiscal/comercial", async () => {
    const error = { code: "42501", message: "lectura denegada sintética" };
    h.current!.errors.set("proveedores:0", error);
    await expect(fetchEmisorEntidad("proveedores", "entidad-a")).rejects.toEqual(error);
    expect(h.current!.calls.map((c) => c.table)).toEqual(["proveedores"]);
    expect(h.current!.supabase.rpc).not.toHaveBeenCalled();
  });

  it("exige ID y organización antes de consultar, sin fallback al perfil", async () => {
    await expect(fetchEmisorEntidad("proveedores", "")).rejects.toThrow("identificar");
    useScope(null);
    await expect(fetchEmisorEntidad("proveedores", "entidad-a")).rejects.toThrow("identificar");
    expect(h.current!.supabase.from).not.toHaveBeenCalled();
    expect(h.current!.supabase.rpc).not.toHaveBeenCalled();
  });

  it.each(["tenant", "usuario", "rol", "ida y vuelta"])("descarta entidad tardía tras cambio de %s", async (change) => {
    let release!: () => void;
    h.current!.delays.set("proveedores", new Promise<void>((resolve) => { release = resolve; }));
    const pending = fetchEmisorEntidad("proveedores", "entidad-a");
    const rejection = expect(pending).rejects.toThrow("cambió el usuario o la organización");
    if (change === "tenant") useScope("org-b");
    if (change === "usuario") useScope("org-a", "otro-usuario");
    if (change === "rol") useScope("org-a", "synthetic-user", "admin");
    if (change === "ida y vuelta") { useScope("org-b"); useScope("org-a"); }
    release();
    await rejection;
    expect(h.current!.calls.map((c) => c.table)).toEqual(["proveedores"]);
    expect(h.current!.supabase.rpc).not.toHaveBeenCalled();
  });

  it.each(["discordante", "error"])("comprueba org_scope %s incluso con emisor fiscal en caché", async (condition) => {
    await fetchEmisorEntidad("proveedores", "entidad-a");
    const callsBefore = h.current!.calls.length;
    h.current!.supabase.rpc.mockResolvedValue(condition === "error"
      ? { data: null, error: new Error("scope inaccesible") } : { data: "org-b", error: null });
    await expect(fetchEmisorEntidad("proveedores", "entidad-a")).rejects.toThrow(
      condition === "error" ? "scope inaccesible" : "aún no está sincronizada",
    );
    expect(h.current!.calls.slice(callsBefore).map((c) => c.table)).toEqual(["proveedores"]);
    expect(h.current!.supabase.rpc).toHaveBeenCalledTimes(2);
  });

  it("usa configuración actual tras invalidar caché, sin reconstruir un emisor a fecha de baja", async () => {
    expect(await fetchEmisorEntidad("proveedores", "entidad-a")).toMatchObject({ razonSocial: "Fiscal A", rfc: "RFC-SINTETICO-A" });
    h.current!.tables.configuracion = fiscal("Fiscal actualizada", "RFC-SINTETICO-NUEVO");
    h.current!.tables.organizations = [{ id: "org-a", nombre: "Marca actualizada" }];
    invalidarEmisorCache();
    expect(await fetchEmisorEntidad("proveedores", "entidad-a")).toMatchObject({
      organizacionNombre: "Marca actualizada", razonSocial: "Fiscal actualizada", rfc: "RFC-SINTETICO-NUEVO",
    });
    expect(h.current!.calls.filter((c) => c.table === "proveedores")).toHaveLength(2);
    expect(h.current!.tables.proveedores[0].deleted_at).toBe(deletedAt);
  });
});
