import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchClienteFiscal, actualizarDatosTimbradoFactura } from "../datosFiscalesCliente";

describe("datosFiscalesCliente service", () => {
  beforeEach(() => { mock.tableCalls.length = 0; });

  it("fetchClienteFiscal devuelve la fila", async () => {
    const row = { rfc: "XAXX010101000", codigo_postal: "01000", regimen_fiscal: "601", uso_cfdi_default: "G03" };
    mock.setTableResult("clientes", { data: row, error: null });
    await expect(fetchClienteFiscal("c1")).resolves.toEqual(row);
  });

  it("fetchClienteFiscal devuelve null cuando no hay data", async () => {
    mock.setTableResult("clientes", { data: null, error: null });
    await expect(fetchClienteFiscal("c1")).resolves.toBeNull();
  });

  it("fetchClienteFiscal propaga error", async () => {
    mock.setTableResult("clientes", { data: null, error: new Error("denied") });
    await expect(fetchClienteFiscal("c1")).rejects.toThrow("denied");
  });

  it("actualizarDatosTimbradoFactura envía patch completo y filtra por id", async () => {
    mock.setTableResult("facturas", { data: null, error: null });
    const patch = { serie: "A", uso_cfdi: "G03", forma_pago: "03", metodo_pago: "PUE" };
    await actualizarDatosTimbradoFactura("f1", patch);
    const call = mock.tableCalls.find((c) => c.table === "facturas")!;
    expect(call.opArgs[call.ops.indexOf("update")]?.[0]).toEqual(patch);
    expect(call.opArgs[call.ops.indexOf("eq")]).toEqual(["id", "f1"]);
  });

  it("actualizarDatosTimbradoFactura propaga error", async () => {
    mock.setTableResult("facturas", { data: null, error: new Error("nope") });
    await expect(
      actualizarDatosTimbradoFactura("f1", { serie: "", uso_cfdi: "", forma_pago: "", metodo_pago: "" }),
    ).rejects.toThrow("nope");
  });
});
