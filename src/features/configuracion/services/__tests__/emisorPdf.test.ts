import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";

const { mock } = vi.hoisted(() => ({ mock: { current: null as ReturnType<typeof createSupabaseMock> | null } }));
vi.mock("@/integrations/supabase/client", () => ({ get supabase() { return mock.current!.supabase; } }));
import { fetchEmisorEmpresa, invalidarEmisorCache } from "../emisor";
import { fetchEmisorDocumento, fetchEmisorEntidad, fetchEmisorPdf, fetchEmisorReporte } from "../emisorPdf";

function useOrg(organizationId: string | null, userId = "synthetic-user") {
  setAuthSnapshot({ userId, email: null, organizationId: null, organizationName: "Perfil ajeno",
    role: "super_admin", effectiveRole: "super_admin" });
  syncActiveOrganizationScope({ userId, organizationId });
  mock.current!.setRpcResult("org_scope", { data: organizationId, error: null });
}

describe("emisor PDF: identidad comercial del documento", () => {
  beforeEach(() => {
    invalidarEmisorCache();
    mock.current = createSupabaseMock();
    useOrg("org-a");
    mock.current.setTableResult("configuracion", { data: [], error: null });
    mock.current.setTableResult("organizations", { data: { id: "org-a", nombre: "Comercial A" }, error: null });
  });

  it("identifica el PDF con fiscal vacío sin fabricar razón social ni RFC", async () => {
    expect(await fetchEmisorDocumento("org-a")).toEqual({
      organizacionNombre: "Comercial A", razonSocial: "Empresa", subtitulo: "", rfc: "", direccion: "", contacto: "",
    });
    const orgRead = mock.current!.tableCalls.find((call) => call.table === "organizations");
    expect(orgRead?.opArgs).toContainEqual(["id", "org-a"]);
    expect(orgRead?.opArgs).toContainEqual(["id, nombre"]);
    expect(await fetchEmisorEmpresa()).not.toHaveProperty("organizacionNombre");
  });

  it("conserva por separado la marca comercial y los datos fiscales configurados", async () => {
    mock.current!.setTableResult("configuracion", { data: [
      { clave: "nombre", valor: "Fiscal A SA" }, { clave: "rfc", valor: "RFC-SINTETICO" },
    ], error: null });
    expect(await fetchEmisorPdf()).toMatchObject({
      organizacionNombre: "Comercial A", razonSocial: "Fiscal A SA", rfc: "RFC-SINTETICO",
    });
  });

  it("rechaza una fila de otro tenant o sin identidad antes de leer", async () => {
    await expect(fetchEmisorDocumento("org-b")).rejects.toThrow("no coincide");
    await expect(fetchEmisorDocumento("")).rejects.toThrow("no coincide");
    expect(mock.current!.supabase.from).not.toHaveBeenCalled();
    expect(mock.current!.supabase.rpc).not.toHaveBeenCalled();
  });

  it("no reutiliza la marca de A al pasar a B y no usa el nombre del perfil", async () => {
    expect((await fetchEmisorPdf()).organizacionNombre).toBe("Comercial A");
    useOrg("org-b");
    mock.current!.setTableResult("organizations", { data: { id: "org-b", nombre: "Comercial B" }, error: null });
    expect((await fetchEmisorPdf()).organizacionNombre).toBe("Comercial B");
  });

  it("rechaza respuesta de organización ausente o discordante", async () => {
    mock.current!.setTableResult("organizations", { data: null, error: null });
    await expect(fetchEmisorPdf()).rejects.toThrow("identificar la organización");
    mock.current!.setTableResult("organizations", { data: { id: "org-b", nombre: "No usar" }, error: null });
    await expect(fetchEmisorPdf()).rejects.toThrow("identificar la organización");
  });

  it("propaga el error de lectura comercial y rechaza tenant remoto desincronizado", async () => {
    mock.current!.setTableResult("organizations", { data: null, error: new Error("lectura falló") });
    await expect(fetchEmisorPdf()).rejects.toThrow("lectura falló");
    mock.current!.setRpcResult("org_scope", { data: "org-b", error: null });
    await expect(fetchEmisorPdf()).rejects.toThrow("aún no está sincronizada");
  });

  it.each(["tenant", "usuario"])("rechaza la respuesta comercial tardía tras cambiar %s", async (change) => {
    await fetchEmisorEmpresa();
    let resolve!: (value: unknown) => void;
    const pending = new Promise((done) => { resolve = done; });
    mock.current!.supabase.from.mockImplementationOnce(() => ({
      select: () => ({ eq: () => ({ maybeSingle: () => pending }) }),
    }));
    const previous = fetchEmisorDocumento("org-a");
    const rejection = expect(previous).rejects.toThrow("cambió el usuario o la organización");
    await vi.waitFor(() => expect(mock.current!.supabase.from).toHaveBeenCalledTimes(2));
    useOrg(change === "tenant" ? "org-b" : "org-a", change === "usuario" ? "otro-user" : "synthetic-user");
    resolve({ data: { id: "org-a", nombre: "Comercial A tardía" }, error: null });
    await rejection;
  });

  it("sin ámbito no consulta ninguna tabla", async () => {
    useOrg(null);
    await expect(fetchEmisorPdf()).rejects.toThrow("Selecciona una organización");
    expect(mock.current!.supabase.from).not.toHaveBeenCalled();
  });
  it("mantiene neutral el reporte global autenticado y no consulta ninguna empresa", async () => {
    useOrg(null);
    await expect(fetchEmisorReporte(null)).resolves.toBeUndefined();
    expect(mock.current!.supabase.from).not.toHaveBeenCalled();
    await expect(fetchEmisorReporte("org-a")).rejects.toThrow("no coincide");
  });
  it("no confunde org vacía, ausente o discordante con un reporte global", async () => {
    await expect(fetchEmisorReporte(null)).rejects.toThrow("no coincide");
    await expect(fetchEmisorReporte("org-b")).rejects.toThrow("no coincide");
    useOrg(null);
    await expect(fetchEmisorReporte("")).rejects.toThrow("no coincide");
    await expect(fetchEmisorReporte(undefined as never)).rejects.toThrow("no coincide");
    setAuthSnapshot({ userId: null, email: null, organizationId: null, organizationName: null, role: null, effectiveRole: null });
    await expect(fetchEmisorReporte(null)).rejects.toThrow("no coincide");
    setAuthSnapshot({ userId: "synthetic-user", email: null, organizationId: null, organizationName: null, role: "admin", effectiveRole: "admin" });
    await expect(fetchEmisorReporte(null)).rejects.toThrow("no coincide");
    expect(mock.current!.supabase.from).not.toHaveBeenCalled();
  });

  it.each(["proveedores", "cuentas_bancarias", "proveedor_facturas"] as const)("resuelve %s por ID y organización persistida", async (tabla) => {
    mock.current!.setTableResult(tabla, { data: { id: "entidad-a", organization_id: "org-a" }, error: null });
    expect((await fetchEmisorEntidad(tabla, "entidad-a")).organizacionNombre).toBe("Comercial A");
    expect(mock.current!.tableCalls[0].opArgs).toContainEqual(["id", "entidad-a"]);
    expect(mock.current!.tableCalls[0].opArgs).toContainEqual(["organization_id", "org-a"]);
  });

  it("rechaza entidad vacía, ausente, ajena o con error sin cargar identidad", async () => {
    await expect(fetchEmisorEntidad("proveedores", "")).rejects.toThrow("identificar");
    expect(mock.current!.supabase.from).not.toHaveBeenCalled();
    for (const data of [null, { id: "entidad-a", organization_id: "org-b" }, { id: "entidad-b", organization_id: "org-a" }]) {
      mock.current!.setTableResult("proveedores", { data, error: null });
      await expect(fetchEmisorEntidad("proveedores", "entidad-a")).rejects.toThrow("no coincide");
    }
    mock.current!.setTableResult("proveedores", { data: null, error: new Error("entidad inaccesible") });
    await expect(fetchEmisorEntidad("proveedores", "entidad-a")).rejects.toThrow("entidad inaccesible");
    expect(mock.current!.supabase.rpc).not.toHaveBeenCalled();
  });

  it("descarta entidad tardía antes de cargar la identidad del nuevo tenant", async () => {
    let resolve!: (value: unknown) => void;
    const pending = new Promise((done) => { resolve = done; });
    mock.current!.supabase.from.mockImplementationOnce(() => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => pending }) }) }),
    }));
    const previous = fetchEmisorEntidad("cuentas_bancarias", "cuenta-a");
    const rejection = expect(previous).rejects.toThrow("cambió el usuario o la organización");
    useOrg("org-b");
    resolve({ data: { id: "cuenta-a", organization_id: "org-a" }, error: null });
    await rejection;
    expect(mock.current!.supabase.rpc).not.toHaveBeenCalled();
  });
});
