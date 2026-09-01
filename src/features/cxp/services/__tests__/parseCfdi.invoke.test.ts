import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from "@supabase/supabase-js";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

import { invokeParseCfdiOnce } from "../parseCfdi.invoke";

const file = new File(["<x/>"], "test.xml", { type: "application/xml" });
const categorias = [{ id: "c1", nombre: "Fletes" }];
const organizationId = "22222222-2222-4222-8222-222222222222";

function fakeResponse(status: number, body?: unknown): Response {
  return new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("invokeParseCfdiOnce", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("retorna ok=true con la data cuando la función responde correctamente", async () => {
    invokeMock.mockResolvedValueOnce({ data: { cfdi: { uuid: "u1" } }, error: null });
    const r = await invokeParseCfdiOnce(file, categorias, organizationId);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.cfdi.uuid).toBe("u1");
    // FormData fresco con file + categorias serializadas
    const call = invokeMock.mock.calls[0];
    expect(call[0]).toBe("parse-cfdi-xml");
    expect((call[1].body as FormData).get("file")).toBeInstanceOf(File);
    // v13.823.4: la organización viaja en header (no en el multipart) para que
    // la edge function autorice antes de bufferar el archivo.
    expect(call[1].headers["x-organization-id"]).toBe(organizationId);
    expect((call[1].body as FormData).get("organization_id")).toBeNull();
  });

  it("retorna EmptyResponse cuando no hay error ni data", async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: null });
    const r = await invokeParseCfdiOnce(file, categorias, organizationId);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorName).toBe("EmptyResponse");
      expect(r.retryable).toBe(false);
      expect(r.phase).toBe("response");
      expect(r.status).toBe(200);
    }
  });

  it("mapea FunctionsHttpError 500 como retryable phase=response", async () => {
    const httpErr = new FunctionsHttpError(fakeResponse(500, { error: "boom-server" }));
    invokeMock.mockResolvedValueOnce({ data: null, error: httpErr });
    const r = await invokeParseCfdiOnce(file, categorias, organizationId);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorName).toBe("FunctionsHttpError");
      expect(r.retryable).toBe(true);
      expect(r.status).toBe(500);
      expect(r.message).toBe("boom-server");
      expect(r.phase).toBe("response");
    }
  });

  it("mapea FunctionsHttpError 400 como NO retryable", async () => {
    const httpErr = new FunctionsHttpError(fakeResponse(400, { error: "mal formato" }));
    invokeMock.mockResolvedValueOnce({ data: null, error: httpErr });
    const r = await invokeParseCfdiOnce(file, categorias, organizationId);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.retryable).toBe(false);
      expect(r.status).toBe(400);
      expect(r.message).toBe("mal formato");
    }
  });

  it("usa mensaje genérico cuando el body no es JSON", async () => {
    const resp = new Response("not-json", { status: 503 });
    const httpErr = new FunctionsHttpError(resp);
    invokeMock.mockResolvedValueOnce({ data: null, error: httpErr });
    const r = await invokeParseCfdiOnce(file, categorias, organizationId);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/HTTP 503/);
      expect(r.retryable).toBe(true);
    }
  });

  it("mapea FunctionsRelayError como preflight retryable", async () => {
    const relayErr = Object.assign(Object.create(FunctionsRelayError.prototype), { message: "blocked" });
    invokeMock.mockResolvedValueOnce({ data: null, error: relayErr });
    const r = await invokeParseCfdiOnce(file, categorias, organizationId);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorName).toBe("FunctionsRelayError");
      expect(r.phase).toBe("preflight");
      expect(r.retryable).toBe(true);
      expect(r.message).toBe("blocked");
    }
  });

  it("mapea FunctionsFetchError como request retryable", async () => {
    const fetchErr = Object.assign(Object.create(FunctionsFetchError.prototype), { message: "net" });
    invokeMock.mockResolvedValueOnce({ data: null, error: fetchErr });
    const r = await invokeParseCfdiOnce(file, categorias, organizationId);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorName).toBe("FunctionsFetchError");
      expect(r.phase).toBe("request");
      expect(r.retryable).toBe(true);
      expect(r.message).toBe("net");
    }
  });

  it("mapea Error genérico preservando name y message", async () => {
    const e = new Error("custom-fail");
    e.name = "WeirdError";
    invokeMock.mockResolvedValueOnce({ data: null, error: e });
    const r = await invokeParseCfdiOnce(file, categorias, organizationId);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorName).toBe("WeirdError");
      expect(r.message).toBe("custom-fail");
      expect(r.retryable).toBe(true);
      expect(r.phase).toBe("request");
    }
  });

  it("atrapa rechazos del invoke (throw) y los mapea", async () => {
    invokeMock.mockRejectedValueOnce(new Error("thrown"));
    const r = await invokeParseCfdiOnce(file, categorias, organizationId);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toBe("thrown");
      expect(r.retryable).toBe(true);
    }
  });
});
