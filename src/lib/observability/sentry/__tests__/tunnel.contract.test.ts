import { afterEach, describe, expect, it, vi } from "vitest";
import { serializeEnvelope } from "@sentry/core";
import { handleEnvelopeRequest } from "../../../../../supabase/functions/sentry-tunnel/index";
import { leerEnvelopeAcotado, MAX_ENVELOPE_BYTES } from "../../../../../supabase/functions/sentry-tunnel/envelope";

const envelope = () => serializeEnvelope([
  { dsn: "https://mock@o4511415732404224.ingest.us.sentry.io/1",
    event_id: "0".repeat(32), sent_at: new Date(0).toISOString() },
  [[{ type: "attachment", filename: "mock.png", length: 6 },
    new Uint8Array([0x89, 0xff, 0x00, 0x80, 0xfe, 0x9c])]],
]);
const request = (body: BodyInit, headers: HeadersInit = {}) => new Request("https://mock.invalid/tunnel", {
  method: "POST", body, headers: { "x-real-ip": crypto.randomUUID(), ...headers },
});
afterEach(() => vi.unstubAllGlobals());

describe("Sentry binary tunnel contract", () => {
  it("forwards SDK-created attachments byte for byte with a bounded timeout", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const original = envelope();
    expect((await handleEnvelopeRequest(request(original as BodyInit))).status).toBe(200);
    const options = fetchMock.mock.calls[0][1];
    expect(Array.from(new Uint8Array(options.body))).toEqual(Array.from(original as Uint8Array));
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([200, 429])("preserves upstream quota signals on HTTP %s and exposes them to browsers", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("quota", {
      status, headers: { "Retry-After": "17", "X-Sentry-Rate-Limits": "60:error:organization" },
    })));
    const response = await handleEnvelopeRequest(request(envelope() as BodyInit));
    expect(response.status).toBe(status);
    expect(response.headers.get("Retry-After")).toBe("17");
    expect(response.headers.get("X-Sentry-Rate-Limits")).toBe("60:error:organization");
    expect(response.headers.get("Access-Control-Expose-Headers")).toContain("X-Sentry-Rate-Limits");
  });

  it("still rejects oversized streaming bodies even without Content-Length", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await handleEnvelopeRequest(request(new Uint8Array(MAX_ENVELOPE_BYTES + 1)));
    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retains stream bounds and does not materialize text", async () => {
    const body = new Uint8Array([0xff, 0x80]);
    expect(await leerEnvelopeAcotado(request(body))).toEqual(body);
  });

  it("never forwards an unapproved destination", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await handleEnvelopeRequest(request('{"dsn":"https://mock@evil.invalid/1"}\n{}\n{}'));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a safe gateway error when the upstream aborts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("mock timeout", "TimeoutError")));
    const response = await handleEnvelopeRequest(request(envelope() as BodyInit));
    expect(response.status).toBe(502);
    expect(await response.text()).toBe('{"error":"tunnel_failed"}');
  });
});
