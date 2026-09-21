/**
 * Paso 3 de la auditoría: el contrato 2xx de timbrado es una unión
 * discriminable validada en runtime. Un cuerpo malformado ya NO se entrega a
 * la UI mediante cast: lanza `TimbradoContratoError`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { invoke, rpc } = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke }, rpc },
}));

import { emitirFacturapi } from "../facturapi";
import { emitirRep } from "../repFacturapi";
import { esPendiente } from "../timbradoPendiente";
import {
  esErrorWire,
  esExitoWire,
  esPendienteWire,
  TimbradoContratoError,
} from "../timbradoWire";

const EXITO = {
  uuid: "U-1", folio: 7, serie: "A",
  facturapi_id: "fx", pdf_url: "p", xml_url: "x",
};

describe("guards del contrato wire", () => {
  it("reconoce el éxito completo", () => {
    expect(esExitoWire(EXITO)).toBe(true);
    expect(esErrorWire(EXITO)).toBe(false);
    expect(esPendienteWire(EXITO)).toBe(false);
  });

  it("rechaza éxitos incompletos o con tipos equivocados", () => {
    expect(esExitoWire({ ...EXITO, folio: "7" })).toBe(false);
    expect(esExitoWire({ ...EXITO, uuid: "  " })).toBe(false);
    const { xml_url: _x, ...sinXml } = EXITO;
    expect(esExitoWire(sinXml)).toBe(false);
  });

  it("reconoce pendiente por bandera y por outcome", () => {
    expect(esPendienteWire({ pendiente: true })).toBe(true);
    expect(esPendienteWire({ outcome: "timbrado_pendiente" })).toBe(true);
    expect(esPendienteWire({ pendiente: true, outcome: "timbrado_pendiente" })).toBe(true);
    expect(esPendienteWire({ outcome: "otro" })).toBe(false);
  });

  it("rechaza objetos sin discriminador de pendiente", () => {
    expect(esPendienteWire({})).toBe(false);
    expect(esPendienteWire({ message: "en proceso" })).toBe(false);
    expect(esPendienteWire({ pendiente: false })).toBe(false);
    expect(esPendienteWire({ outcome: null })).toBe(false);
  });

  it("reconoce el error estructurado y descarta cuerpos no objeto", () => {
    expect(esErrorWire({ error: "boom" })).toBe(true);
    expect(esErrorWire({ error: "" })).toBe(false);
    for (const v of [null, undefined, 3, "x", []]) {
      expect(esErrorWire(v)).toBe(false);
      expect(esPendienteWire(v)).toBe(false);
      expect(esExitoWire(v)).toBe(false);
    }
  });
});

describe("emitirFacturapi / emitirRep con el contrato validado", () => {
  beforeEach(() => { invoke.mockReset(); rpc.mockReset(); });

  it("devuelve sólo los seis campos del timbre en el éxito", async () => {
    invoke.mockResolvedValueOnce({ data: { ...EXITO, extra: "ignorado" }, error: null });
    await expect(emitirFacturapi("f1")).resolves.toEqual(EXITO);
  });

  it("pendiente por pendiente:true", async () => {
    invoke.mockResolvedValueOnce({ data: { pendiente: true, message: "en proceso" }, error: null });
    const res = await emitirFacturapi("f1");
    expect(esPendiente(res)).toBe(true);
    expect(res).toEqual({ pendiente: true, message: "en proceso" });
  });

  it("pendiente por outcome en el REP", async () => {
    invoke.mockResolvedValueOnce({ data: { outcome: "timbrado_pendiente" }, error: null });
    expect(esPendiente(await emitirRep("p1"))).toBe(true);
  });

  it("error estructurado se lanza, no se devuelve", async () => {
    invoke.mockResolvedValueOnce({ data: { error: "X", message: "No se pudo" }, error: null });
    await expect(emitirFacturapi("f1")).rejects.toThrow("No se pudo");
  });

  it("cuerpo null o malformado lanza error de contrato (factura y REP)", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: null });
    await expect(emitirFacturapi("f1")).rejects.toBeInstanceOf(TimbradoContratoError);
    invoke.mockResolvedValueOnce({ data: { uuid: "U-1" }, error: null });
    await expect(emitirRep("p1")).rejects.toBeInstanceOf(TimbradoContratoError);
  });

  it("nunca entrega un timbre incompleto a la UI", async () => {
    const { folio: _f, ...sinFolio } = EXITO;
    invoke.mockResolvedValueOnce({ data: sinFolio, error: null });
    const err = await emitirFacturapi("f1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TimbradoContratoError);
    expect((err as TimbradoContratoError).code).toBe("LC_TIMBRADO_CONTRATO");
  });

  it("el error de contrato advierte no volver a timbrar y no invita a reintentar", async () => {
    invoke.mockResolvedValueOnce({ data: { folio: 1 }, error: null });
    const err = await emitirFacturapi("f1").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TimbradoContratoError);
    const msg = (err as TimbradoContratoError).message;
    expect(msg).toContain("No vuelvas a timbrar");
    expect(msg).not.toContain("vuelve a intentar");
  });
});
