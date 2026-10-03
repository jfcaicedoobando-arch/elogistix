// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Envelope } from "@sentry/core";
import { maybeInstrument, resetInstrumentationHandlers, triggerHandlers } from "@sentry/core";
import { HTTP_FAILURE_TARGETS, IGNORE_ERRORS } from "../initOptions";
import { shouldDropSentryEvent } from "../dropPredicate";
import { scrubEventPii } from "../helpers";
let Sentry: typeof import("@sentry/react");
let queryClient: typeof import("@/lib/query/queryClient").queryClient;

// Real SDK response handler + real Supabase parsing + actual QueryCache.
// Drive the SDK instrumentation boundary explicitly: Vitest restores globals
// between cases, while the SDK intentionally wraps native fetch only once.
vi.mock("../core", () => ({ initSentry: () => undefined, isSentryReady: () => Sentry.isEnabled() }));
vi.mock("@/lib/ui/appFeedback", async () => {
  return { notifyError: (_: unknown, options: { error: unknown }) =>
    import("../../reportCaughtError").then(({ reportCaughtError }) =>
      reportCaughtError(options.error, { feature: "ui" })) };
});

const envelopes: Envelope[] = [];
let attempts = 0;
let recover = false;
const supabase = createClient("https://mock.supabase.co", "mock-public-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (...args) => globalThis.fetch(...args) },
});

beforeEach(async () => {
  // No native request: deliver the same response record that SDK fetch emits.
  vi.resetModules();
  resetInstrumentationHandlers();
  maybeInstrument("fetch", () => undefined);
  attempts = 0; recover = false; envelopes.length = 0;
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    attempts += 1;
    const url = input instanceof Request ? input.url : String(input);
    const ok = recover && attempts > 1;
    const response = new Response(JSON.stringify(ok ? [] : { code: "XX000", message: "mock unexpected upstream failure" }),
      { status: ok ? 200 : 500, headers: { "Content-Type": "application/json" } });
    Object.defineProperty(response, "url", { value: url });
    triggerHandlers("fetch", { args: [input], response, fetchData: { method: "GET", url },
      startTimestamp: Date.now(), endTimestamp: Date.now() });
    return response;
  });
  Sentry = await import("@sentry/react");
  queryClient = (await import("@/lib/query/queryClient")).queryClient;
  Sentry.init({
    dsn: "https://mock@mock.invalid/1", defaultIntegrations: false,
    integrations: [Sentry.eventFiltersIntegration(), Sentry.dedupeIntegration(), Sentry.httpClientIntegration({
      failedRequestStatusCodes: [[500, 599]], failedRequestTargets: HTTP_FAILURE_TARGETS,
    })],
    ignoreErrors: IGNORE_ERRORS,
    beforeSend: (event, hint) => shouldDropSentryEvent(event, hint) ? null : scrubEventPii(event),
    transport: () => ({
      send: (envelope) => { envelopes.push(envelope); return Promise.resolve({ statusCode: 200 }); },
      flush: () => Promise.resolve(true),
    }),
  });
});
afterEach(async () => { queryClient.clear(); await Sentry.close(1000); vi.unstubAllGlobals(); });

async function request(kind: "REST" | "Edge") {
  const result = kind === "REST" ? await supabase.from("facturas").select("id")
    : await supabase.functions.invoke("mock-read-only");
  if (result.error) throw result.error;
  return result.data;
}

describe("HTTP capture ownership", () => {
  it.each(["REST", "Edge"] as const)("%s 500 retries produce one terminal Query/UI event", async (kind) => {
    await expect(queryClient.fetchQuery({
      queryKey: ["mock", kind], retry: 2, retryDelay: 0, queryFn: () => request(kind),
    })).rejects.toBeDefined();
    await vi.waitFor(() => expect(envelopes).toHaveLength(1));
    await Sentry.flush(1000);
    expect(attempts).toBe(3);
    expect(envelopes).toHaveLength(1);
    expect(JSON.stringify(envelopes)).toContain("react_query");
    expect(JSON.stringify(envelopes)).not.toContain("auto.http.client");
  });

  it("a recovered REST retry leaves no false incident", async () => {
    recover = true;
    await expect(queryClient.fetchQuery({
      queryKey: ["mock", "recovery"], retry: 2, retryDelay: 0, queryFn: () => request("REST"),
    })).resolves.toEqual([]);
    await Sentry.flush(1000);
    expect(attempts).toBe(2);
    expect(envelopes).toHaveLength(0);
  });

  it.each(["https://mock.supabase.co/storage/v1/object/mock", "https://mock.supabase.co/auth/v1/token",
    "https://librecarga.com/assets/mock.js"])("unowned 500 remains automatic: %s", async (url) => {
    await fetch(url);
    await Sentry.flush(1000);
    expect(envelopes).toHaveLength(1);
    expect(JSON.stringify(envelopes)).toContain("auto.http.client.fetch");
  });

  it("real SDK filters preserve meaningful primitive promise rejections", async () => {
    Sentry.captureEvent({ exception: { values: [{ type: "UnhandledRejection",
      value: "Non-Error promise rejection captured with value: mock REP provider unexpected response",
      mechanism: { type: "auto.browser.browserapierrors.promise", handled: false },
    }] } }, { originalException: "mock REP provider unexpected response" });
    await Sentry.flush(1000);
    expect(envelopes).toHaveLength(1);
    expect(JSON.stringify(envelopes)).toContain("mock REP provider unexpected response");
  });

  it("empty serialized promise rejections remain filtered by the precise policy", async () => {
    Sentry.captureEvent({ exception: { values: [{ type: "UnhandledRejection",
      value: "Object captured as promise rejection with keys: message",
    }] }, extra: { __serialized__: { message: "" } } });
    await Sentry.flush(1000);
    expect(envelopes).toHaveLength(0);
  });
});
