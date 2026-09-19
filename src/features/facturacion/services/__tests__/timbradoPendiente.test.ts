/**
 * QA (severidad alta) — el 202 "timbrado pendiente" llegaba al cliente como
 * éxito y la UI decía "Factura timbrada correctamente · Serie undefined".
 * Aquí se fija el contrato: la respuesta pendiente se reconoce y NO trae
 * uuid/folio.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { invoke, rpc } = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke }, rpc },
}));

import { emitirFacturapi } from "../facturapi";
import { emitirRep } from "../repFacturapi";
import { esPendiente, MSG_TIMBRADO_PENDIENTE_CLIENTE } from "../timbradoPendiente";

const CUERPO_202 = {
  outcome: "timbrado_pendiente",
  pendiente: true,
  reintentable: false,
  message: "El SAT aún no devuelve el timbre.",
};

describe("timbrado pendiente (202)", () => {
  beforeEach(() => { invoke.mockReset(); rpc.mockReset(); });

  it("emitirFacturapi devuelve pendiente sin uuid ni folio", async () => {
    invoke.mockResolvedValueOnce({ data: CUERPO_202, error: null });
    const res = await emitirFacturapi("f1");
    expect(esPendiente(res)).toBe(true);
    expect(res).toEqual({ pendiente: true, message: "El SAT aún no devuelve el timbre." });
    expect((res as unknown as Record<string, unknown>).uuid).toBeUndefined();
  });

  it("emitirRep devuelve pendiente con mensaje por omisión si falta", async () => {
    invoke.mockResolvedValueOnce({ data: { outcome: "timbrado_pendiente" }, error: null });
    const res = await emitirRep("p1");
    expect(esPendiente(res)).toBe(true);
    expect((res as { message: string }).message).toBe(MSG_TIMBRADO_PENDIENTE_CLIENTE);
  });

  it("un timbre válido no se confunde con pendiente", async () => {
    const payload = { uuid: "U", folio: 7, serie: "A", facturapi_id: "fx", pdf_url: "p", xml_url: "x" };
    invoke.mockResolvedValueOnce({ data: payload, error: null });
    const res = await emitirFacturapi("f1");
    expect(esPendiente(res)).toBe(false);
    expect(res).toEqual(payload);
  });

  it("esPendiente tolera respuestas nulas de dobles de prueba", () => {
    expect(esPendiente(undefined)).toBe(false);
    expect(esPendiente(null)).toBe(false);
  });
});
