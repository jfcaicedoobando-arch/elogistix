import { interpretarErrorCancelacion } from "../cancelacionErrorWire";
import { describe, expect, it } from "vitest";
import { interpretarCancelacion, interpretarAcuse, CancelacionContratoError } from "../cancelacionWire";
import { kpisCobranzaSchema } from "../cobranzaWire";

describe("fiscal response contracts", () => {
  it.each([null, {}, { ok: true }, { ok: true, cancellation_status: "unknown" }, { ok: true, cancellation_status: "accepted" }, { ok: true, cancellation_status: "accepted", sustituida: false, pending: true }])("preserves uncertainty for malformed cancellation %j", (data) => {
    expect(() => interpretarCancelacion(data)).toThrow(CancelacionContratoError);
    expect(() => interpretarCancelacion(data)).toThrow(/Consulta el estado/);
  });
  it("accepts terminal and pending variants", () => {
    expect(interpretarCancelacion({ ok: true, cancellation_status: "accepted", sustituida: true })).toMatchObject({ sustituida: true, pending: false });
    expect(interpretarCancelacion({ ok: true, cancellation_status: "verifying", pending: true, uncertain: true })).toMatchObject({ pending: true, uncertain: true });
  });
  it("rejects a structured error without treating it as success", () => {
    expect(() => interpretarCancelacion({ error: "forbidden" })).toThrow();
  });
  it("validates acuse status and storage consistently", () => {
    expect(interpretarAcuse({ ok: true, acuse_status: "accepted", acuse_guardado: true })).toEqual({ acuse_status: "accepted", acuse_guardado: true });
    expect(interpretarAcuse({ ok: true, acuse_status: "pending", acuse_guardado: false })).toEqual({ acuse_status: "pending", acuse_guardado: false });
    for (const data of [{}, null, { ok: true, acuse_status: "accepted", acuse_guardado: false }, { ok: true, acuse_status: "unknown", acuse_guardado: false }]) expect(() => interpretarAcuse(data)).toThrow();
  });
});

describe("financial JSONB contract", () => {
  const valid = { total_mxn: 1, total_usd: 0, vencido_mxn: 0, vencido_usd: 0, por_vencer_7d_mxn: 1, por_vencer_7d_usd: 0, facturas_vencidas: 0, facturas_con_saldo: 1 };
  it("accepts a complete finite result", () => expect(kpisCobranzaSchema.parse(valid)).toEqual(valid));
  it.each([null, {}, { ...valid, total_mxn: NaN }, { ...valid, total_usd: Infinity }, { ...valid, facturas_vencidas: -1 }, { ...valid, facturas_con_saldo: 0.5 }])("rejects malformed figures %j", (data) => expect(kpisCobranzaSchema.safeParse(data).success).toBe(false));
});

describe("cancellation error boundary", () => {
  it.each([
    { error: "provider_response", transient: "false" },
    { error: "provider_response", issues: "bad" },
    { error: "provider_response", transient: true },
    { ok: true, cancellation_status: "accepted", error: "facturapi_error", transient: true, status: 502, message: "SAT unavailable" },
  ])("never offers blind retry for malformed or contradictory response %j", (data) => {
    expect(() => interpretarCancelacion(data)).toThrow(CancelacionContratoError);
    const error = interpretarErrorCancelacion(data);
    expect(error).toBeInstanceOf(CancelacionContratoError);
    expect(error).not.toHaveProperty("transient", true);
  });
  it("preserves explicitly validated SAT-unavailable retry semantics", () => {
    expect(interpretarErrorCancelacion({ error: "facturapi_error", status: 502, message: "SAT unavailable", transient: true })).toHaveProperty("transient", true);
  });
});

describe("contradictory wire fields", () => {
  it.each([42, {}, "", null])("rejects an accepted response carrying error=%j", (error) => {
    expect(() => interpretarCancelacion({ ok: true, cancellation_status: "accepted", sustituida: false, error })).toThrow(CancelacionContratoError);
  });
  it.each([
    { ok: false, cancellation_status: "rejected", message: "Rejected", sustituida: true },
    { error: "facturapi_error", status: 502, message: "SAT unavailable", transient: true, acuse_status: "accepted", acuse_guardado: true },
  ])("rejects incompatible error fields %j", (body) => {
    expect(interpretarErrorCancelacion(body)).toBeInstanceOf(CancelacionContratoError);
  });
});

it.each(["facturapi_timeout", "cerrar_cancelacion_failed", "db_update_failed"])("preserves uncertainty after provider request: %s", (error) => {
  expect(interpretarErrorCancelacion({ error, persisted: false, message: "server failure" })).toBeInstanceOf(CancelacionContratoError);
});
it("does not accept a rejection contradicting canceled invoice status", () => {
  expect(interpretarErrorCancelacion({ ok: false, cancellation_status: "rejected", message: "Rejected", status: "canceled" })).toBeInstanceOf(CancelacionContratoError);
});
