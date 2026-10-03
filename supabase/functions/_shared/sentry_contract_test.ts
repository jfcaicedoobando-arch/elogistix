import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { captureEdgeMessage, wrapEdgeHandler, withCronMonitor } from "./sentry.ts";
import { loadSentryEdge } from "./sentryRuntime.ts";

Deno.test("SDK 11: isolated requests, redaction, spans and terminal cron check-ins", async () => {
  const fetchOriginal = globalThis.fetch;
  const envelopes: string[] = [];
  Deno.env.set("SENTRY_DSN_EDGE", "https://mock@mock.invalid/1");
  Deno.env.set("SENTRY_RELEASE_EDGE", "mock-contract");
  Deno.env.set("SENTRY_CRON_MONITOR_SLUG", "mock-cron");
  globalThis.fetch = (_url, options) => {
    const body = (options as { body?: unknown } | undefined)?.body;
    envelopes.push(typeof body === "string" ? body : new TextDecoder().decode(body as Uint8Array));
    return Promise.resolve(new Response("", { status: 200 }));
  };
  const sdk = await loadSentryEdge();
  assert(sdk);
  sdk.getClient()!.getOptions().tracesSampleRate = 1;
  const incoming = "0123456789abcdef0123456789abcdef-0123456789abcdef-1";
  try {
    await Promise.all(["alpha", "beta"].map((name) => wrapEdgeHandler(name, async () => {
      await Promise.resolve();
      await captureEdgeMessage(`${name}: mock@example.invalid RFC XAXX010101000 Bearer MOCK_TOKEN`, "error", {
        fn: name, extra: { accessToken: "MOCK_ACCESS", customerEmail: "mock@example.invalid" },
      });
      return new Response("ok");
    })(new Request("https://mock.invalid/function", { headers: {
      "x-request-id": name, "sentry-trace": incoming,
    } }))));
    const response = await withCronMonitor("cron", "mock-cron", () => new Response("retry", { status: 503 }),
      { schedule: { type: "interval", value: 1, unit: "hour" } })(new Request("https://mock.invalid/cron"));
    assertEquals(response.status, 503);
    await assertRejects(() => wrapEdgeHandler("throws", () => { throw new Error("MOCK_BUG"); })(
      new Request("https://mock.invalid/throws")), Error, "MOCK_BUG");
    await sdk.flush(2000);
    const json = envelopes.join("\n");
    assert(!/mock@example.invalid|XAXX010101000|MOCK_TOKEN|MOCK_ACCESS/.test(json));
    assert(json.includes("libre-carga-edge@mock-contract"));
    assert(json.includes('"status":"in_progress"') && json.includes('"status":"error"'));
    const events = envelopes.flatMap((text) => text.split("\n").filter((line) => line.startsWith("{"))
      .flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } }));
    for (const name of ["alpha", "beta"]) {
      const event = events.find((item) => item.message?.startsWith(`${name}:`));
      assert(event, `missing ${name} event`);
      assertEquals(event.tags.fn, name);
      assertEquals(event.tags.request_id, name);
    }
    assert(json.includes("http.server"));
    assert(json.includes("0123456789abcdef0123456789abcdef"));
    // The final monitor envelope must have reached transport before the wrapper returns.
    assert(envelopes.some((text) => text.includes('"status":"error"')));
  } finally {
    await sdk.close(2000);
    // SDK streaming schedules unref'ed 500 ms segment flushes. Deno 2.6's
    // leak detector still tracks them; drain them, keeping sanitizers enabled.
    await new Promise((resolve) => setTimeout(resolve, 550));
    globalThis.fetch = fetchOriginal;
    for (const key of ["SENTRY_DSN_EDGE", "SENTRY_RELEASE_EDGE", "SENTRY_CRON_MONITOR_SLUG"]) Deno.env.delete(key);
  }
});
