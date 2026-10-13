import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSimpleFilteredReadMock } = await import("@/services/__tests__/_simpleFilteredReadMock"); return createSimpleFilteredReadMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { CONTACTO_COLUMNS, fetchContactosCliente } from "../contactos";
import { resolverContacto, resolverValorContactoDesdeTexto } from "../../domain/contacto";
const row = (id: string, nombre: string, deleted_at: string | null = null, cliente_id = "cli-test") => ({
  id, nombre, cliente_id, deleted_at, tipo: "Exportador", pais: "MEX", contacto: "Contacto ficticio", rfc: null,
  telefono: null, email: "fixture@example.invalid", direccion: "", ciudad: "", organization_id: "org-test",
  created_at: "2026-10-01", updated_at: "2026-10-01", deleted_by: null,
});
beforeEach(() => mock.reset());
describe("cliente/contactos: selección viva y texto histórico", () => {
  it("mezcla vivo/baja excluye borrados y otros clientes, conservando columnas y orden", async () => {
    const zeta = row("zeta", "Zeta vivo"), alfa = row("alfa", "Alfa vivo");
    mock.source("contactos_cliente", [zeta, row("baja", "Baja ficticia", "2026-10-01"), row("ajeno", "Ajeno", null, "otro-cliente"), alfa]);
    expect(await fetchContactosCliente("cli-test")).toEqual([alfa, zeta]);
    const call = mock.tableCalls[0];
    expect(call.opArgs[call.ops.indexOf("select")]).toEqual([CONTACTO_COLUMNS]);
    expect(call.opArgs).toContainEqual(["cliente_id", "cli-test"]); expect(call.opArgs).toContainEqual(["deleted_at", null]);
    expect(call.opArgs[call.ops.indexOf("order")]).toEqual(["nombre"]); expect(mock.rpcCalls).toHaveLength(0);
  });
  it("sólo bajas devuelve lista vacía", async () => {
    mock.source("contactos_cliente", [row("baja", "Histórico", "2026-10-01")]); expect(await fetchContactosCliente("cli-test")).toEqual([]);
  });
  it("null conserva lista vacía", async () => {
    mock.source("contactos_cliente", null); expect(await fetchContactosCliente("cli-test")).toEqual([]);
  });
  it("error sigue rechazando y no se convierte en lista vacía", async () => {
    const error = new Error("lectura-contactos"); mock.source("contactos_cliente", null, error);
    await expect(fetchContactosCliente("cli-test")).rejects.toBe(error);
  });
  it.each([false, true])("contacto histórico eliminado mantiene roundtrip __otro__/manual, permitirCliente=%s", async permitirCliente => {
    const baja = row("baja", "Exportador histórico", "2026-10-01"); const vivo = row("vivo", "Exportador vigente");
    const stored = resolverContacto([baja], baja.id, ""); mock.source("contactos_cliente", [baja, vivo]);
    const contactos = await fetchContactosCliente("cli-test");
    const resuelto = resolverValorContactoDesdeTexto(stored, contactos, "Cliente ficticio", { permitirCliente });
    expect(contactos.map(c => c.id)).toEqual(["vivo"]); expect(resuelto).toEqual({ value: "__otro__", manual: stored });
    expect(resolverContacto(contactos, resuelto.value, resuelto.manual)).toBe(stored);
  });
  it("contacto vivo sigue resolviendo su ID y no pasa a manual", async () => {
    const vivo = row("vivo", "Exportador vigente"); mock.source("contactos_cliente", [vivo]);
    const contactos = await fetchContactosCliente("cli-test"); const stored = resolverContacto([vivo], vivo.id, "");
    expect(resolverValorContactoDesdeTexto(stored, contactos, "Cliente ficticio")).toEqual({ value: vivo.id, manual: "" });
  });
});
