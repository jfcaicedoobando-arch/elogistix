import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSimpleFilteredReadMock } = await import("@/services/__tests__/_simpleFilteredReadMock"); return createSimpleFilteredReadMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { obtenerAutorizacionCliente } from "../autorizacionClienteService";
const combinaciones = [{ cot: false, pro: false }, { cot: false, pro: true }, { cot: true, pro: false }, { cot: true, pro: true }];
const conservador = { requiereAutorizacionCotizacion: true, requiereAutorizacionProforma: true, esClienteDeCasa: false };
beforeEach(() => mock.reset());
describe("cliente/autorización: flags vivos y defaults ante ausencia", () => {
  it.each(combinaciones)("cliente vivo conserva flags cot=$cot pro=$pro", async ({ cot, pro }) => {
    mock.source("clientes", { id: "cli-test", requiere_autorizacion_cotizacion: cot, requiere_autorizacion_proforma: pro, deleted_at: null });
    expect(await obtenerAutorizacionCliente("cli-test")).toEqual({ requiereAutorizacionCotizacion: cot, requiereAutorizacionProforma: pro, esClienteDeCasa: !cot && !pro });
    const call = mock.tableCalls[0]; expect(call.opArgs).toContainEqual(["id", "cli-test"]); expect(call.opArgs).toContainEqual(["deleted_at", null]);
    expect(call.opArgs[call.ops.indexOf("select")]).toEqual(["id, requiere_autorizacion_cotizacion, requiere_autorizacion_proforma"]);
  });
  it.each(combinaciones)("cliente borrado ignora flags cot=$cot pro=$pro y vuelve a defaults", async ({ cot, pro }) => {
    mock.source("clientes", { id: "cli-test", requiere_autorizacion_cotizacion: cot, requiere_autorizacion_proforma: pro, deleted_at: "2026-10-01" });
    expect(await obtenerAutorizacionCliente("cli-test")).toEqual(conservador);
  });
  it("null conserva ambas autorizaciones requeridas y casa=false", async () => {
    mock.source("clientes", null); expect(await obtenerAutorizacionCliente("cli-test")).toEqual(conservador);
  });
  it("campos null en cliente vivo conservan defaults existentes", async () => {
    mock.source("clientes", { id: "cli-test", requiere_autorizacion_cotizacion: null, requiere_autorizacion_proforma: null, deleted_at: null });
    expect(await obtenerAutorizacionCliente("cli-test")).toEqual(conservador);
  });
  it("identidad diferente no devuelve flags de otro cliente", async () => {
    mock.source("clientes", { id: "otro-cliente", requiere_autorizacion_cotizacion: false, requiere_autorizacion_proforma: false, deleted_at: null });
    expect(await obtenerAutorizacionCliente("cli-test")).toEqual(conservador);
  });
  it("error Supabase rechaza con Error(message), aun cuando la respuesta trae flags", async () => {
    mock.source("clientes", { id: "cli-test", requiere_autorizacion_cotizacion: false, requiere_autorizacion_proforma: false, deleted_at: null }, { message: "fallo-autorización", code: "P0001" });
    await expect(obtenerAutorizacionCliente("cli-test")).rejects.toEqual(new Error("fallo-autorización"));
  });
});
